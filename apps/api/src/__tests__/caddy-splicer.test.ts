import { describe, it, expect } from 'vitest';

interface CaddyRoute {
  '@id'?: string;
  match: Array<{ path: string[] }>;
  handle: unknown[];
}

function addRoute(routes: CaddyRoute[], slug: string, ip: string, port: number): CaddyRoute[] {
  const filtered = routes.filter((r) => r['@id'] !== `bimbo-${slug}`);
  const newRoute: CaddyRoute = {
    '@id': `bimbo-${slug}`,
    match: [{ path: [`/apps/${slug}/*`] }],
    handle: [{ handler: 'reverse_proxy', upstreams: [{ dial: `${ip}:${port}` }] }],
  };
  filtered.unshift(newRoute);
  return filtered;
}

function removeRoute(routes: CaddyRoute[], slug: string): CaddyRoute[] {
  return routes.filter((r) => r['@id'] !== `bimbo-${slug}`);
}

describe('caddy config splicer', () => {
  const baseRoutes: CaddyRoute[] = [
    { '@id': 'api', match: [{ path: ['/api/*'] }], handle: [] },
    { '@id': 'web', match: [{ path: ['/*'] }], handle: [] },
  ];

  it('adds a new route with correct id and match', () => {
    const result = addRoute(baseRoutes, 'abc123', '10.0.0.1', 3000);
    const added = result.find((r) => r['@id'] === 'bimbo-abc123');
    expect(added).toBeDefined();
    expect(added!.match[0].path).toContain('/apps/abc123/*');
  });

  it('prepends the new route so it takes priority', () => {
    const result = addRoute(baseRoutes, 'xyz', '10.0.0.2', 4000);
    expect(result[0]['@id']).toBe('bimbo-xyz');
  });

  it('replaces an existing route for the same slug without duplication', () => {
    const existing = addRoute(baseRoutes, 'dup', '10.0.0.3', 3000);
    const updated = addRoute(existing, 'dup', '10.0.0.4', 4000);
    const matches = updated.filter((r) => r['@id'] === 'bimbo-dup');
    expect(matches).toHaveLength(1);
  });

  it('removes a route by slug', () => {
    const withRoute = addRoute(baseRoutes, 'rm', '10.0.0.5', 3000);
    const result = removeRoute(withRoute, 'rm');
    expect(result.find((r) => r['@id'] === 'bimbo-rm')).toBeUndefined();
    expect(result.length).toBe(baseRoutes.length);
  });

  it('removing a non-existent slug is a no-op', () => {
    const result = removeRoute(baseRoutes, 'ghost');
    expect(result).toHaveLength(baseRoutes.length);
  });
});
