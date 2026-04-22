import { createRootRoute, createRoute, createRouter, Outlet } from '@tanstack/react-router';
import { IndexPage } from './routes/index';

const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: IndexPage,
  validateSearch: (search: Record<string, unknown>) => ({
    deployment: typeof search.deployment === 'string' ? search.deployment : undefined,
  }),
});

const routeTree = rootRoute.addChildren([indexRoute]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
