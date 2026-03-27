import { LLMChunk, LLMErrorCode } from "./types";

export class LLMError extends Error {
  readonly code: LLMErrorCode;

  constructor(code: LLMErrorCode, message: string) {
    super(message);
    this.name = "LLMError";
    this.code = code;
  }

  toChunk(): LLMChunk {
    return { type: "error" as const, code: this.code, message: this.message };
  }
}

/**
 * Maps a fetch Response to an LLMError based on HTTP status.
 * Providers call this when they receive a non-ok response.
 */
export async function responseToError(res: Response): Promise<LLMError> {
  let body = "";
  try { body = await res.text(); } catch { /* ignore */ }

  switch (res.status) {
    case 401: return new LLMError(LLMErrorCode.Unauthorized, body || "Unauthorized");
    case 403: return new LLMError(LLMErrorCode.Forbidden, body || "Forbidden");
    case 404: return new LLMError(LLMErrorCode.ModelNotFound, body || "Model not found");
    case 429: return new LLMError(LLMErrorCode.RateLimited, body || "Rate limited");
    case 400: return new LLMError(LLMErrorCode.InvalidRequest, body || "Invalid request");
    case 503: return new LLMError(LLMErrorCode.ProviderUnavailable, body || "Provider unavailable");
    default:  return new LLMError(LLMErrorCode.ProviderError, body || `HTTP ${res.status}`);
  }
}