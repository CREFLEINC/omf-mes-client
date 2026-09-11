import { waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { renderHookWithProviders } from '../../test/api-harness';
import { toApiError } from '../../patterns/request';
import { DASHBOARD_SUMMARY_NOT_READY_REASON, useDashboardSummary } from './queries';

/**
 * `GET /app/dashboard-summary` 는 서버에 경로 자체가 없다(전달본 `manifest.json` ·
 * 대응표 P1 「미구현 5건」 — 집계 대상 도메인 완성 뒤로 미뤘다). 이 화면은 그 오퍼레이션
 * 하나만 읽으므로, 호출을 막는다는 것은 곧 「이 훅이 fetch 를 한 번도 부르지 않는다」는 뜻이다.
 */
describe('useDashboardSummary — 미구현 오퍼레이션 차단', () => {
  it('네트워크 요청을 한 번도 보내지 않고 곧바로 실패로 정착한다', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => {
      throw new Error('이 훅은 fetch를 부르면 안 된다');
    });

    const { result } = renderHookWithProviders(() => useDashboardSummary({}), { fetch });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(fetch).not.toHaveBeenCalled();
  });

  /*
   * ⛔ **화면의 실패 배너(`load-error-banner.tsx`)는 `describeLoadError` 가 `kind: 'http'` 의
   * `message` 를 그대로 보인다.** 「불러오지 못했다」는 제목 아래에도 이 사유가 실려야
   * 사용자가 «네트워크 오류»가 아니라 «준비 중»임을 읽을 수 있다.
   */
  it('실패 사유에 아직 준비되지 않았다는 사실이 담긴다', async () => {
    const { result } = renderHookWithProviders(() => useDashboardSummary({}), {
      fetch: async () => {
        throw new Error('이 훅은 fetch를 부르면 안 된다');
      },
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    const apiError = toApiError(result.current.error);
    expect(apiError).toEqual({
      kind: 'http',
      status: 501,
      message: DASHBOARD_SUMMARY_NOT_READY_REASON,
    });
  });
});
