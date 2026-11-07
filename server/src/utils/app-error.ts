// Errors thrown on purpose (bad input, missing record). The error middleware turns them into responses.
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }

  static notFound(what: string) {
    return new AppError(404, `${what} not found`);
  }
}
