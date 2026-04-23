import { dirname, join } from 'path';
import { spawn } from 'child_process';
import { broker } from '../logs/broker.js';

/**
 * Railpack can emit a lot of lines quickly; `broker.publish` awaits Postgres each time.
 * Serialize persistence so child stdout/stderr pipes keep draining.
 */
function createLogDrainer(deploymentId: string) {
  let bufOut = '';
  let bufErr = '';
  let chain = Promise.resolve();

  const push = (stream: 'stdout' | 'stderr', chunk: Buffer) => {
    if (stream === 'stdout') bufOut += chunk.toString('utf8');
    else bufErr += chunk.toString('utf8');

    const acc = stream === 'stdout' ? bufOut : bufErr;
    const parts = acc.split('\n');
    const tail = parts.pop() ?? '';
    for (const line of parts) {
      if (!line) continue;
      chain = chain.then(() => broker.publish(deploymentId, stream, line));
    }
    if (stream === 'stdout') bufOut = tail;
    else bufErr = tail;
  };

  const flushRemainingInBackground = () => {
    if (bufOut.length) chain = chain.then(() => broker.publish(deploymentId, 'stdout', bufOut));
    if (bufErr.length) chain = chain.then(() => broker.publish(deploymentId, 'stderr', bufErr));
    bufOut = '';
    bufErr = '';
    void chain.catch((err) => {
      console.error('[railpack] deployment log persistence failed:', err);
    });
  };

  return { push, flushRemainingInBackground };
}

function spawnWithLogs(
  deploymentId: string,
  cmd: string,
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv } = {},
): Promise<void> {
  return new Promise((resolve, reject) => {
    const drainer = createLogDrainer(deploymentId);
    const proc = spawn(cmd, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: options.cwd,
      env: options.env ?? process.env,
    });

    proc.stdout.on('data', (chunk: Buffer) => {
      drainer.push('stdout', chunk);
    });
    proc.stderr.on('data', (chunk: Buffer) => {
      drainer.push('stderr', chunk);
    });

    const onDone = (code: number | null, spawnErr?: Error) => {
      drainer.flushRemainingInBackground();
      if (spawnErr) reject(spawnErr);
      else if (code === 0) resolve();
      else reject(new Error(`${cmd} exited with code ${code}`));
    };

    proc.on('close', (code) => {
      onDone(code);
    });
    proc.on('error', (err) => {
      onDone(null, err);
    });
  });
}

/**
 * Build app image. Returns the image reference the **host** Docker daemon should run.
 *
 * With registry + BuildKit (compose default): `railpack prepare` writes the plan, then
 * `buildctl` uses the Railpack gateway frontend and **pushes** (`type=image,push=true`) so we
 * never stream a tarball through the API (avoids the `docker load` stall).
 *
 * Railpack v0.23.x has **no** `railpack generate` command — do not use it here.
 */
export async function buildWithRailpack(deploymentId: string, srcPath: string, imageTag: string): Promise<string> {
  const pushHost = process.env.REGISTRY_PUSH_HOST?.trim();
  const runHost = process.env.REGISTRY_RUN_HOST?.trim();
  const frontend = process.env.RAILPACK_FRONTEND?.trim() ?? 'ghcr.io/railwayapp/railpack-frontend:v0.23.0';

  if (pushHost && runHost) {
    const workDir = dirname(srcPath);
    const planPath = join(workDir, 'railpack-plan.json');
    const infoPath = join(workDir, 'railpack-info.json');
    const pushRef = `${pushHost}/${imageTag}`;

    await broker.publish(
      deploymentId,
      'system',
      `Preparing Railpack plan, then BuildKit push to ${pushRef} (no client-side tarball).`,
    );

    const prepareArgs = ['prepare', srcPath, '--plan-out', planPath, '--info-out', infoPath];
    if (process.env.RAILPACK_VERBOSE === '1' || process.env.RAILPACK_VERBOSE === 'true') {
      prepareArgs.push('--verbose');
    }
    await spawnWithLogs(deploymentId, 'railpack', prepareArgs);

    const miseVerbose =
      process.env.MISE_VERBOSE ??
      (process.env.RAILPACK_VERBOSE === '1' || process.env.RAILPACK_VERBOSE === 'true' ? '1' : '');
    const buildctlEnv = { ...process.env, MISE_VERBOSE: miseVerbose };
    const outputOpt = `type=image,name=${pushRef},push=true`;

    await broker.publish(deploymentId, 'system', `BuildKit build + push (${pushRef})`);
    await spawnWithLogs(
      deploymentId,
      'buildctl',
      [
        'build',
        '--progress=plain',
        '--frontend=gateway.v0',
        '--opt',
        `source=${frontend}`,
        '--opt',
        'filename=railpack-plan.json',
        '--secret',
        'id=MISE_VERBOSE,env=MISE_VERBOSE',
        '--local',
        `context=${srcPath}`,
        '--local',
        `dockerfile=${workDir}`,
        '--output',
        outputOpt,
      ],
      { env: buildctlEnv },
    );

    const runRef = `${runHost}/${imageTag}`;
    await broker.publish(deploymentId, 'system', `Railpack build succeeded; run image ${runRef}`);
    return runRef;
  }

  await broker.publish(deploymentId, 'system', `Building image ${imageTag} with Railpack (docker load)`);
  const args = ['build', srcPath, '--name', imageTag];
  if (process.env.RAILPACK_VERBOSE === '1' || process.env.RAILPACK_VERBOSE === 'true') {
    args.push('--verbose');
  }
  await spawnWithLogs(deploymentId, 'railpack', args);
  await broker.publish(deploymentId, 'system', `Railpack build succeeded: ${imageTag}`);
  return imageTag;
}
