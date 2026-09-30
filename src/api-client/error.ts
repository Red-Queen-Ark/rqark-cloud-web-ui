import type { UtilsErrorResponse } from '@/api/types.gen';

function asErrorResponse(error: unknown): UtilsErrorResponse | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }
  return error as UtilsErrorResponse;
}

/** The machine readable code the backend uses to classify the failure. */
export function apiErrorCode(error: unknown): string | undefined {
  return asErrorResponse(error)?.error?.code;
}

/** The human readable message the backend attached to the failure. */
export function apiErrorMessage(error: unknown): string | undefined {
  const message = asErrorResponse(error)?.error?.message;
  return typeof message === 'string' && message !== '' ? message : undefined;
}
