import Dockerode from 'dockerode';
import { broker } from '../logs/broker.js';

const docker = new Dockerode({ socketPath: '/var/run/docker.sock' });

/**
 * IP of a running container on `network` (used after API/Caddy restart to re-register edge routes).
 * Returns null if the container is missing, not running, or not attached to the network.
 */
export async function getContainerInternalIp(containerId: string, network: string): Promise<string | null> {
  try {
    const container = docker.getContainer(containerId);
    const info = await container.inspect();
    if (!info.State.Running) return null;
    const nets = info.NetworkSettings.Networks;
    const net = nets[network] ?? Object.values(nets)[0];
    const ip = net?.IPAddress?.trim();
    return ip || null;
  } catch (err: unknown) {
    const code = (err as { statusCode?: number })?.statusCode;
    if (code === 404) return null;
    console.warn(`[docker] inspect ${containerId.slice(0, 12)}…:`, (err as Error)?.message ?? err);
    return null;
  }
}

/** e.g. localhost:5000/brimble-abc:latest — host Docker must pull after BuildKit push. */
function looksLikeRegistryImageRef(image: string): boolean {
  const i = image.indexOf('/');
  if (i <= 0) return false;
  const host = image.slice(0, i);
  return host.includes('.') || host.includes(':');
}

async function pullImage(deploymentId: string, imageTag: string): Promise<void> {
  await broker.publish(deploymentId, 'system', `Pulling ${imageTag} into local Docker`);
  await new Promise<void>((resolve, reject) => {
    docker.pull(imageTag, (err: Error | null, stream: NodeJS.ReadableStream) => {
      if (err) return reject(err);
      docker.modem.followProgress(stream, (err2: Error | null) => {
        if (err2) reject(err2);
        else resolve();
      });
    });
  });
}

export interface RunResult {
  containerId: string;
  internalIp: string;
  port: number;
}

export async function runContainer(
  deploymentId: string,
  imageTag: string,
  slug: string,
  network: string,
  envVars: Record<string, string> = {},
): Promise<RunResult> {
  await broker.publish(deploymentId, 'system', `Starting container for image ${imageTag}`);

  if (looksLikeRegistryImageRef(imageTag)) {
    await pullImage(deploymentId, imageTag);
  }

  const baseEnv = [
    'PORT=3000',
    'NODE_ENV=production',
    'NEXT_TELEMETRY_DISABLED=1',
    // Railpack runtime images wrap Node with mise; keep logs quiet and avoid extra network work at start.
    'MISE_LOG_LEVEL=error',
  ];
  const userEnv = Object.entries(envVars).map(([k, v]) => `${k}=${v}`);

  const container = await docker.createContainer({
    Image: imageTag,
    Labels: { 'brimble.slug': slug },
    HostConfig: {
      NetworkMode: network,
    },
    Env: [...baseEnv, ...userEnv],
  });

  await container.start();

  const info = await container.inspect();
  const networks = info.NetworkSettings.Networks;
  const networkInfo = networks[network] ?? Object.values(networks)[0];
  const internalIp = networkInfo?.IPAddress ?? '';

  // Detect the exposed port from image config
  const exposedPorts = info.Config.ExposedPorts ?? {};
  const portKey = Object.keys(exposedPorts)[0] ?? '3000/tcp';
  const port = parseInt(portKey.split('/')[0], 10);

  await broker.publish(deploymentId, 'system', `Container ${container.id.slice(0, 12)} running at ${internalIp}:${port}`);

  // Tail container logs to broker (best-effort)
  tailLogs(deploymentId, container).catch(() => {});

  return { containerId: container.id, internalIp, port };
}

async function tailLogs(deploymentId: string, container: Dockerode.Container) {
  const logStream = await container.logs({
    follow: true,
    stdout: true,
    stderr: true,
    timestamps: false,
  });

  container.modem.demuxStream(
    logStream as unknown as NodeJS.ReadableStream,
    {
      write: (chunk: Buffer) => {
        const lines = chunk.toString().split('\n').filter(Boolean);
        for (const line of lines) broker.publish(deploymentId, 'stdout', line);
      },
    } as unknown as NodeJS.WritableStream,
    {
      write: (chunk: Buffer) => {
        const lines = chunk.toString().split('\n').filter(Boolean);
        for (const line of lines) broker.publish(deploymentId, 'stderr', line);
      },
    } as unknown as NodeJS.WritableStream,
  );
}

export async function stopAndRemoveContainer(containerId: string) {
  try {
    const container = docker.getContainer(containerId);
    await container.stop({ t: 5 });
    await container.remove();
  } catch (err: any) {
    if (err?.statusCode !== 404) throw err;
  }
}
