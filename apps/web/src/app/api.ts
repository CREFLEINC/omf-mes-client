import { createApiClient, type ApiClient } from '@omf-mes/api-client';

/**
 * 기준 URL이 주어지지 않았을 때의 기본값 — 이 저장소의 로컬 목 서버 주소다.
 * tools/mock/serve.mjs가 같은 호스트·포트로 띄운다. 배포 대상의 주소가 아니다.
 */
const DEFAULT_BASE_URL = 'http://127.0.0.1:4010';

const resolveBaseUrl = (): string => {
  const configured: unknown = import.meta.env.VITE_API_BASE_URL;
  return typeof configured === 'string' && configured !== '' ? configured : DEFAULT_BASE_URL;
};

/**
 * 앱 전역에서 공유하는 계약 클라이언트.
 * ETag 보관소를 함께 들고 있으므로 인스턴스를 여러 개 만들면 낙관적 잠금 토큰이 흩어진다.
 */
export const apiClient: ApiClient = createApiClient({ baseUrl: resolveBaseUrl() });
