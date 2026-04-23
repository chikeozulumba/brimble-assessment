export const config = {
  databaseUrl: process.env.DATABASE_URL!,
  caddyAdminUrl: process.env.CADDY_ADMIN_URL ?? 'http://caddy:2019',
  appsNetwork: process.env.APPS_NETWORK ?? 'brimble_apps',
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? 'http://localhost:8080',
  port: parseInt(process.env.PORT ?? '3000', 10),
  /** PAT or fine-grained token: used only to clone private repos from github.com (never logged). */
  githubToken: process.env.GITHUB_TOKEN?.trim() || undefined,
};
