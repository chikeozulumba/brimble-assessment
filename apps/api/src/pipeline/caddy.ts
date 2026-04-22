import { config } from '../config.js';

const CADDY_API = config.caddyAdminUrl;

interface CaddyRoute {
  '@id'?: string;
  match?: Array<{ path: string[] }>;
  handle: unknown[];
}

async function getConfig(): Promise<any> {
  const res = await fetch(`${CADDY_API}/config/apps/http/servers/srv0`);
  if (!res.ok) throw new Error(`Caddy config fetch failed: ${res.status}`);
  return res.json();
}

async function putRoutes(routes: CaddyRoute[]) {
  const res = await fetch(`${CADDY_API}/config/apps/http/servers/srv0/routes`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(routes),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Caddy PUT routes failed: ${res.status} ${text}`);
  }
}

export async function addRoute(slug: string, ip: string, port: number) {
  const srv = await getConfig();
  const routes: CaddyRoute[] = srv.routes ?? [];

  const filtered = routes.filter((r: CaddyRoute) => r['@id'] !== `brimble-${slug}`);

  const newRoute: CaddyRoute = {
    '@id': `brimble-${slug}`,
    match: [{ path: [`/apps/${slug}/*`] }],
    handle: [
      {
        handler: 'subroute',
        routes: [
          {
            handle: [
              {
                handler: 'rewrite',
                strip_path_prefix: `/apps/${slug}`,
              },
            ],
          },
          {
            handle: [
              {
                handler: 'reverse_proxy',
                upstreams: [{ dial: `${ip}:${port}` }],
              },
            ],
          },
        ],
      },
    ],
  };

  filtered.unshift(newRoute);
  await putRoutes(filtered);
}

export async function removeRoute(slug: string) {
  const srv = await getConfig();
  const routes: CaddyRoute[] = srv.routes ?? [];
  const filtered = routes.filter((r: CaddyRoute) => r['@id'] !== `brimble-${slug}`);
  await putRoutes(filtered);
}
