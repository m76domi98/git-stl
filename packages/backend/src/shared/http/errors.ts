export class AppError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: unknown,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export const badRequest = (message: string, details?: unknown): AppError =>
  new AppError(400, message, details)

export const notFound = (what: string): AppError => new AppError(404, `${what} not found`)

export const conflict = (message: string): AppError => new AppError(409, message)
