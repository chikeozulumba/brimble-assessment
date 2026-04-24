import { config } from "../config.js";

const CADDY_API = config.caddyAdminUrl;

const caddyAdminHeaders = { Origin: "http://caddy:2019" } as const;

interface CaddyRoute {
  "@id"?: string;
  match?: Array<{ path: string[] }>;
  handle: unknown[];
}

async function getConfig(): Promise<any> {
  const res = await fetch(`${CADDY_API}/config/apps/http/servers/srv0`, {
    headers: { ...caddyAdminHeaders },
  });
  if (!res.ok) throw new Error(`Caddy config fetch failed: ${res.status}`);
  return res.json();
}

async function patchRoutes(routes: CaddyRoute[]) {
  const res = await fetch(`${CADDY_API}/config/apps/http/servers/srv0/routes`, {
    method: "PATCH",
    headers: {
      ...caddyAdminHeaders,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(routes),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Caddy PATCH routes failed: ${res.status} ${text}`);
  }
}

export async function addRoute(slug: string, ip: string, port: number) {
  const srv = await getConfig();
  const routes: CaddyRoute[] = srv.routes ?? [];

  const filtered = routes.filter(
    (r: CaddyRoute) => r["@id"] !== `bimbo-${slug}`,
  );

  const newRoute: CaddyRoute = {
    "@id": `bimbo-${slug}`,
    match: [{ path: [`/apps/${slug}/*`] }],
    handle: [
      {
        handler: "subroute",
        routes: [
          {
            handle: [
              {
                handler: "rewrite",
                strip_path_prefix: `/apps/${slug}`,
              },
            ],
          },
          {
            handle: [
              {
                handler: "reverse_proxy",
                upstreams: [{ dial: `${ip}:${port}` }],
                headers: {
                  request: {
                    set: {
                      Host: ["{http.request.host}"],
                      "X-Forwarded-Host": ["{http.request.host}"],
                      "X-Forwarded-Proto": ["{http.request.scheme}"],
                      "X-Forwarded-Prefix": [`/apps/${slug}`],
                    },
                  },
                },
              },
            ],
          },
        ],
      },
    ],
  };

  filtered.unshift(newRoute);
  await patchRoutes(filtered);
}

export async function removeRoute(slug: string) {
  const srv = await getConfig();
  const routes: CaddyRoute[] = srv.routes ?? [];
  const filtered = routes.filter(
    (r: CaddyRoute) => r["@id"] !== `bimbo-${slug}`,
  );
  await patchRoutes(filtered);
}
