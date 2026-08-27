import { createApiClient, type ApiClient } from '@omf-mes/api-client';

/**
 * 기준 URL이 주어지지 않았을 때의 기본값 — 이 저장소의 로컬 목 서버 주소다.
 * 에뮬레이터·실기에서는 이 주소가 단말 자신을 가리키므로 VITE_API_BASE_URL을 준다.
 */
const DEFAULT_BASE_URL = 'http://127.0.0.1:4010';

const resolveBaseUrl = (): string => {
  const configured: unknown = import.meta.env.VITE_API_BASE_URL;
  return typeof configured === 'string' && configured !== '' ? configured : DEFAULT_BASE_URL;
};

export const apiClient: ApiClient = createApiClient({ baseUrl: resolveBaseUrl() });
