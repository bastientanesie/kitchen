export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly extra?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function problemDetails(error: AppError, instance: string) {
  return {
    type: `https://kitchen.internal/errors/${error.code}`,
    title: error.message,
    status: error.status,
    detail: error.message,
    instance,
    code: error.code,
  };
}
