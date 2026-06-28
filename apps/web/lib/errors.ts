export type AppError =
  | { kind: "upload_failed"; message: string }
  | { kind: "user_rejected" }
  | { kind: "submit_failed"; message: string }
  | { kind: "not_configured"; missing: string };

export class MolotovError extends Error {
  constructor(public readonly appError: AppError) {
    super(appError.kind);
    this.name = "MolotovError";
  }
}

export function isMolotovError(err: unknown): err is MolotovError {
  return err instanceof MolotovError;
}
