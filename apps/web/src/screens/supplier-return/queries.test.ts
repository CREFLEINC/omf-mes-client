import { NETWORK_ERROR } from '@omf-mes/api-client';
import { act, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createStubFetch, jsonResponse, renderHookWithProviders } from '../../test/api-harness';
import { ApiRequestError } from '../../patterns/request';
import { goodsReceiptFixtures, goodsReceiptLineFixtures } from './fixtures';
import { isReceiptNotFound, useGoodsReceiptDetail } from './queries';

/**
 * 상세 조회의 **성립 조건**을 재는 자리.
 *
 * 이 감지기가 있어야 하는 이유가 있다. 「고르기 전에는 상세를 부르지 않는다」는 두 겹으로
 * 막혀 있다 — **① `enabled`**(조회 자체를 열지 않는다)와 **② `queryFn`의 가드**(그래도 불리면
 * 던진다). 화면 수준에서 요청 수만 세면 ①을 떼어도 ②가 요청을 막아 **아무 단언도 실패하지
 * 않는다.** 그러면 ①은 검사되지 않은 채 남고, 나중에 ②가 `?? 0` 같은 대체값으로 바뀌는 순간
 * **없는 전표의 경로로 요청이 나간다.**
 *
 * 그래서 여기서 **①을 단독으로** 잰다 — 조회가 아예 서지 않았는지(`fetchStatus`)와
 * 실패로 앉지 않았는지를 함께 본다.
 */

const DETAIL_PATH = '/logistics/goods-receipts/9001';

const detailRoute = {
  match: (request: Request): boolean =>
    request.method === 'GET' && new URL(request.url).pathname === DETAIL_PATH,
  respond: (): Response =>
    jsonResponse({ goodsReceipt: goodsReceiptFixtures[0], lines: goodsReceiptLineFixtures }),
};

const recordingFetch = (): { fetch: ReturnType<typeof createStubFetch>; paths: string[] } => {
  const paths: string[] = [];
  const stub = createStubFetch([detailRoute]);

  return {
    paths,
    fetch: async (request) => {
      paths.push(new URL(request.url).pathname);

      return stub(request);
    },
  };
};

/**
 * 던져진 실패가 상태로 앉을 시간을 준다.
 *
 * **동기로 곧바로 단언하면 놓친다** — `queryFn`이 던져도 그 실패는 마이크로태스크를 한 바퀴
 * 돈 뒤에야 쿼리 상태가 된다. 기다리지 않고 재면 「아직 실패하지 않았다」를 「실패하지
 * 않는다」로 읽는다.
 */
const settle = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
};

describe('useGoodsReceiptDetail', () => {
  it('고르지 않았으면 조회가 서지 않는다', async () => {
    const { fetch, paths } = recordingFetch();
    const { result } = renderHookWithProviders(() => useGoodsReceiptDetail(null), { fetch });

    await settle();

    expect(paths).toEqual([]);
    /* 조회가 **아예 서지 않았다** — 섰다가 가드에 막힌 것이 아니다. */
    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.isError).toBe(false);
  });

  /**
   * **다시 부르기는 `enabled`를 보지 않는다**(설치본 실측) — 「다시 조회」가 성립하지 않는
   * 조회를 불러도 요청이 나가서는 안 되고, 그것을 막는 것은 `queryFn`의 가드뿐이다.
   * 마운트만 재는 앞 감지기는 이 경로를 지나가지 않으므로 **여기서 단독으로 잰다.**
   *
   * 실패 상태로 앉는 것까지 막는 것은 이 가드의 몫이 아니다 — 그것은 부르는 쪽이 막고,
   * 화면 수준 감지기가 「쓸모없는 실패를 만들지 않는다」로 잰다.
   */
  it('고르지 않은 채 다시 불러도 요청이 나가지 않는다', async () => {
    const { fetch, paths } = recordingFetch();
    const { result } = renderHookWithProviders(() => useGoodsReceiptDetail(null), { fetch });

    await settle();

    await act(async () => {
      await result.current.refetch();
    });
    await settle();

    expect(paths).toEqual([]);
  });

  /** 짝 방향 — 고르면 실제로 나간다(아무것도 안 불러서 통과한 것이 아니다). */
  it('고르면 그 전표의 경로로 한 번 나간다', async () => {
    const { fetch, paths } = recordingFetch();
    const { result } = renderHookWithProviders(() => useGoodsReceiptDetail(9001), { fetch });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(paths).toEqual([DETAIL_PATH]);
    expect(result.current.data?.lines).toHaveLength(goodsReceiptLineFixtures.length);
  });
});

describe('isReceiptNotFound', () => {
  /**
   * 없는 전표는 다시 시도해도 나타나지 않는다 — 「다시 시도」가 아니라 **다시 고르기**로
   * 안내해야 하므로 다른 실패와 갈린다.
   */
  it('404만 없는 전표로 본다', () => {
    expect(isReceiptNotFound(new ApiRequestError({ kind: 'http', status: 404 }))).toBe(true);
    expect(isReceiptNotFound(new ApiRequestError({ kind: 'http', status: 500 }))).toBe(false);
    expect(isReceiptNotFound(new ApiRequestError(NETWORK_ERROR))).toBe(false);
  });

  /* 요청 경로 밖에서 생긴 오류를 없는 전표로 읽으면 고른 번호를 까닭 없이 지운다. */
  it('요청 경로 밖의 오류는 없는 전표가 아니다', () => {
    expect(isReceiptNotFound(new Error('렌더 중 예외'))).toBe(false);
  });
});
