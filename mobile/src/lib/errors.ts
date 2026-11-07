/** Reported (as a captured error, not a crash) when someone lands on a route that doesn't exist. */
export class RouteNotFoundError extends Error {
  constructor(readonly pathname: string) {
    super(`Route not found: ${pathname}`);
    this.name = 'RouteNotFoundError';
  }
}
