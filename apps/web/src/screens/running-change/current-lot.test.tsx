import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderHookWithProviders,
  type StubRoute,
} from '../../test/api-harness';

import { NEW_LOT_ID, NEW_LOT_NO, makeLot } from './fixtures';
import { useCurrentLot } from './queries';
import { LOT_PARAM, readLotId } from './screen-params';

/**
 * 《현재 생산LOT》의 원천 — **주소가 정하고 진척은 상세가 준다**(스펙 §3 · 2026-09-06 게이트 승인).
 *
 * 화면 시험이 닿지 못하는 자리다: 화면은 「320/500」만 보여 주므로 **진척을 실제로 요청했는지**와
 * 「진척이 비어 온 것」을 0 으로 적지 않았는지가 보이지 않는다. 둘 다 조용히 틀린다 —
 * 앞은 목표만 그리고, 뒤는 만든 것이 없다고 말한다.
 */

const seen: { withProgress: string | null }[] = [];

const routes = (lot: ReturnType<typeof makeLot>): StubRoute[] => [
  {
    match: (request) => new URL(request.url).pathname === `/trace/lots/${NEW_LOT_ID}`,
    respond: (request) => {
      seen.push({ withProgress: new URL(request.url).searchParams.get('withProgress') });

      return jsonResponse({ lot, externalIdentifiers: [], holds: [] });
    },
  },
];

describe('주소가 실은 생산LOT', () => {
  it('양의 정수만 읽는다 — 없거나 0 이하면 조회 자체가 서지 않는다', () => {
    expect(readLotId(new URLSearchParams(`${LOT_PARAM}=90202`))).toBe(90202);
    expect(readLotId(new URLSearchParams())).toBeNull();
    expect(readLotId(new URLSearchParams(`${LOT_PARAM}=0`))).toBeNull();
    expect(readLotId(new URLSearchParams(`${LOT_PARAM}=-3`))).toBeNull();
    expect(readLotId(new URLSearchParams(`${LOT_PARAM}=abc`))).toBeNull();
  });
});

describe('현재 생산LOT 진척', () => {
  it('진척을 함께 달라고 요청하고 양품·목표를 그대로 든다', async () => {
    seen.length = 0;
    const lot = makeLot({ progress: { goodQty: 320, achievementRate: 0.64, varianceQty: -180, completionJudgmentCode: 'UNDER' } });

    const { result } = renderHookWithProviders(() => useCurrentLot(NEW_LOT_ID), {
      fetch: createStubFetch(routes(lot)),
    });

    await waitFor(() => {
      expect(result.current.lot).not.toBeNull();
    });

    expect(seen).toEqual([{ withProgress: 'true' }]);
    expect(result.current.lot).toEqual({ lotNo: NEW_LOT_NO, goodQty: 320, targetQty: 500 });
  });

  it('진척이 비어 오면 양품을 0 으로 적지 않는다', async () => {
    seen.length = 0;

    const { result } = renderHookWithProviders(() => useCurrentLot(NEW_LOT_ID), {
      fetch: createStubFetch(routes(makeLot())),
    });

    await waitFor(() => {
      expect(result.current.lot).not.toBeNull();
    });

    expect(result.current.lot?.goodQty).toBeNull();
  });

  it('주소에 LOT 이 없으면 조회가 나가지 않는다', () => {
    seen.length = 0;

    const { result } = renderHookWithProviders(() => useCurrentLot(null), {
      fetch: createStubFetch(routes(makeLot())),
    });

    expect(seen).toEqual([]);
    expect(result.current.isPending).toBe(false);
    expect(result.current.lot).toBeNull();
  });
});
