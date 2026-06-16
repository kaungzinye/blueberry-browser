type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}

export function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;

  if (isRecord(error)) {
    const nested = isRecord(error.error) ? error.error : error;
    const message =
      typeof nested.message === "string"
        ? nested.message
        : typeof error.message === "string"
          ? error.message
          : null;
    const code =
      typeof nested.code === "string"
        ? nested.code
        : typeof error.code === "string"
          ? error.code
          : null;
    const requestId =
      typeof nested.request_id === "string"
        ? nested.request_id
        : typeof nested.requestId === "string"
          ? nested.requestId
          : null;

    if (message && code && requestId) {
      return `${message} (${code}, ${requestId})`;
    }
    if (message && code) return `${message} (${code})`;
    if (message) return message;

    try {
      return JSON.stringify(error);
    } catch {
      return "Unexpected error";
    }
  }

  return "Unexpected error";
}
