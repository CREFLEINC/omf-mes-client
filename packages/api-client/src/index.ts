export { createApiClient, type ApiClient, type ApiClientOptions } from './client';
export { createEtagStore, type EtagStore } from './etag-store';
export { createIdempotencyKey } from './idempotency';
export {
  NETWORK_ERROR,
  isTransientStatus,
  isUnauthenticated,
  normalizeApiError,
  type ApiError,
  type ConflictCause,
  type ErrorItem,
  STATE_LOCKED_CODE,
} from './errors';
export type { components, paths } from './generated/api';
export type {
  TerminalRegistrationConfirmation,
  TerminalRegistrationStatusCode,
} from './forward-contract';
