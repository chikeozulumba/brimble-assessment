import { dirname, join } from 'path';
import { spawn } from 'child_process';
import { broker } from '../logs/broker.js';

function spawnWithLogs(
  deploymentId: string,
  cmd: string,
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv } = {},
): Promise<void> {
  return new Promise((resolve, reject) => {
    let bufOut = '';
    let bufErr = '';

    const proc = spawn(cmd, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: options.cwd,
      env: options.env ?? process.env,
    });

    const flush = (buf: string, stream: 'stdout' | 'stderr'): string => {
      const parts = buf.split('\n');
      const tail = parts.pop() ?? '';
      for (const line of parts) if (line) broker.publish(deploymentId, stream, line);
      return tail;
    };

    proc.stdout.on('data', (chunk: Buffer) => { bufOut = flush(bufOut + chunk.toString('utf8'), 'stdout'); });
    proc.stderr.on('data', (chunk: Buffer) => { bufErr = flush(bufErr + chunk.toString('utf8'), 'stderr'); });

    proc.on('close', (code) => {
      if (bufOut) broker.publish(deploymentId, 'stdout', bufOut);
      if (bufErr) broker.publish(deploymentId, 'stderr', bufErr);
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited with code ${code}`));
    });
    proc.on('error', reject);
  });
}

export async function buildWithRailpack(deploymentId: string, srcPath: string, imageTag: string): Promise<string> {
  const pushHost = process.env.REGISTRY_PUSH_HOST?.trim();
  const runHost = process.env.REGISTRY_RUN_HOST?.trim();
  const frontend = process.env.RAILPACK_FRONTEND?.trim() ?? 'ghcr.io/railwayapp/railpack-frontend:v0.23.0';

  if (pushHost && runHost) {
    const workDir = dirname(srcPath);
    const planPath = join(workDir, 'railpack-plan.json');
    const infoPath = join(workDir, 'railpack-info.json');
    const pushRef = `${pushHost}/${imageTag}`;

    broker.publish(deploymentId, 'system', `Preparing Railpack plan, then BuildKit push to ${pushRef} (no client-side tarball).`);

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

    broker.publish(deploymentId, 'system', `BuildKit build + push (${pushRef})`);
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
    broker.publish(deploymentId, 'system', `Railpack build succeeded; run image ${runRef}`);
    return runRef;
  }

  broker.publish(deploymentId, 'system', `Building image ${imageTag} with Railpack (docker load)`);
  const args = ['build', srcPath, '--name', imageTag];
  if (process.env.RAILPACK_VERBOSE === '1' || process.env.RAILPACK_VERBOSE === 'true') {
    args.push('--verbose');
  }
  await spawnWithLogs(deploymentId, 'railpack', args);
  broker.publish(deploymentId, 'system', `Railpack build succeeded: ${imageTag}`);
  return imageTag;
}
