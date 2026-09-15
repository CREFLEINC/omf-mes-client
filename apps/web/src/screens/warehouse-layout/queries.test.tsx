import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createStubFetch, renderHookWithProviders, type StubRoute } from '../../test/api-harness';
import { layoutKeys, useDrawingContent } from './queries';

/**
 * 도면 그림 받기 — **그림은 `<img src>` 가 아니라 계약 클라이언트로 온다.**
 *
 * 세션 쿠키가 필요한 자원이라 주소만 걸어 두면 교차 출처에서 조용히 빈다. 여기서는 그 길이
 * 실제로 blob 을 돌려주는지, 그리고 **다시 받지 않아야 할 때 받지 않는지**를 본다.
 */

const CONTENT_PATH = `/app/attachments/${String(5001)}/content`;
const PNG_BYTES = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

const contentRoute = (calls: Request[]): StubRoute => ({
  match: (request) => new URL(request.url).pathname === CONTENT_PATH,
  respond: (request) => {
    calls.push(request);

    return new Response(PNG_BYTES, { status: 200, headers: { 'Content-Type': 'image/png' } });
  },
});

describe('useDrawingContent', () => {
  it('첨부 내용을 blob 으로 돌려준다', async () => {
    const calls: Request[] = [];
    const { result } = renderHookWithProviders(() => useDrawingContent(5001), {
      fetch: createStubFetch([contentRoute(calls)]),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const blob = result.current.data;

    expect(blob).toBeInstanceOf(Blob);
    expect(new Uint8Array(await (blob as Blob).arrayBuffer())).toEqual(PNG_BYTES);
    expect(calls).toHaveLength(1);
  });

  it('⛔ 도면이 없으면 부르지 않는다 — 첨부 0번은 없는 자원이다', async () => {
    const calls: Request[] = [];
    const { result } = renderHookWithProviders(() => useDrawingContent(null), {
      fetch: createStubFetch([contentRoute(calls)]),
    });

    await waitFor(() => {
      expect(result.current.fetchStatus).toBe('idle');
    });

    expect(result.current.isPending).toBe(true);
    expect(calls).toHaveLength(0);
  });

  /*
   * ⭐ 교체 흐름이 방금 올린 파일을 이 자리에 심는다. 첨부 내용은 불변이라 다시 받을 이유가
   * 없고, 도면은 수 MB 다 — 심어 둔 것이 그대로 나와야 그 최적화가 성립한다.
   */
  it('⭐ 심어 둔 파일이 그대로 나온다 — 방금 올린 그림을 다시 받지 않는다', async () => {
    const calls: Request[] = [];
    const file = new File([PNG_BYTES], 'layout.png', { type: 'image/png' });
    let attachmentId: number | null = null;

    const { result, rerender, queryClient } = renderHookWithProviders(
      () => useDrawingContent(attachmentId),
      { fetch: createStubFetch([contentRoute(calls)]) },
    );

    queryClient.setQueryData(layoutKeys.drawing(5001), file);
    attachmentId = 5001;
    rerender();

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBe(file);
    expect(calls).toHaveLength(0);
  });
});
