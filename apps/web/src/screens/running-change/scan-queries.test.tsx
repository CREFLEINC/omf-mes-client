import { act } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderHookWithProviders,
  type StubRoute,
} from '../../test/api-harness';

import { NEW_LOT_NO, makeLot } from './fixtures';
import type { ScanOutcome } from './scan';
import { useScanLookup } from './scan-queries';

/**
 * 스캔 한 번이 무엇을 집는가 — **순서가 뜻을 정한다**(omf-mes#254 회신).
 *
 * 화면 시험이 닿지 못하는 자리다: 화면은 결과만 보여 주므로 「정확 일치로 걸린 것」과
 * 「부분 검색으로 걸린 것」이 같은 모양이 된다. 여기서 재는 것은 **어떤 질의가 어떤
 * 순서로 나갔는가**다.
 *
 * ⭐ 부분 검색이 앞에 서면 여러 건 중 하나를 화면이 임의로 고르게 되고, 다른 범위의 LOT 을
 * 가리켜도 아무 오류가 나지 않는다. 교체는 지우지 않고 잇는 것이라(§5-2) 그 잘못이 그대로
 * 계보에 남는다.
 */

interface Query {
  lotNo: string | null;
  q: string | null;
}

/** 나간 질의를 순서대로 담는다. `exact`가 있으면 1단계에서만 돌려준다. */
const routes = (seen: Query[], found: { exact?: unknown[]; partial?: unknown[] }): StubRoute[] => [
  {
    match: (request) => new URL(request.url).pathname === '/trace/lots',
    respond: (request) => {
      const query = new URL(request.url).searchParams;
      seen.push({ lotNo: query.get('lotNo'), q: query.get('q') });

      const items = query.get('lotNo') === null ? (found.partial ?? []) : (found.exact ?? []);

      return jsonResponse({
        items,
        page: { page: 1, size: 20, total: items.length },
      });
    },
  },
];

/**
 * 스캔 한 번을 태우고 그 결과를 돌려준다.
 *
 * 결과를 배열에 담는 것은 의도다 — 지역 변수에 넣으면 콜백 안의 대입을 타입 검사가 보지
 * 못해 이후 판정이 성립하지 않는다.
 */
const lookup = async (
  seen: Query[],
  found: { exact?: unknown[]; partial?: unknown[] },
  code: string = NEW_LOT_NO,
): Promise<ScanOutcome | undefined> => {
  const { result } = renderHookWithProviders(() => useScanLookup(), {
    fetch: createStubFetch(routes(seen, found)),
  });

  const outcomes: ScanOutcome[] = [];

  await act(async () => {
    outcomes.push(await result.current.mutateAsync(code));
  });

  return outcomes[0];
};

describe('스캔 판정 순서', () => {
  it('LOT 번호 정확 일치로 걸리면 부분 검색을 부르지 않는다', async () => {
    const seen: Query[] = [];

    const outcome = await lookup(seen, { exact: [makeLot()] });

    expect(outcome).toEqual({
      kind: 'part',
      code: NEW_LOT_NO,
      part: expect.objectContaining({ lotNo: NEW_LOT_NO }),
    });
    /* 질의가 한 번만 나갔고, 그것이 정확 일치다. */
    expect(seen).toEqual([{ lotNo: NEW_LOT_NO, q: null }]);
  });

  it('정확 일치가 비면 그 다음에 부분 검색을 부른다', async () => {
    const seen: Query[] = [];

    await lookup(seen, { exact: [], partial: [makeLot()] });

    expect(seen).toEqual([
      { lotNo: NEW_LOT_NO, q: null },
      { lotNo: null, q: NEW_LOT_NO },
    ]);
  });

  /* ⛔ 여러 건이면 화면이 고르지 않는다 — 고를 근거가 없다. */
  it('부분 검색에 여러 건이 걸리면 고르지 않고 건수만 말한다', async () => {
    const seen: Query[] = [];

    const outcome = await lookup(seen, {
      exact: [],
      partial: [makeLot(), makeLot({ lotId: 90203, lotNo: 'LOT-SAMPLE-0032' })],
    });

    expect(outcome).toEqual({ kind: 'ambiguous', count: 2 });
  });

  /* 정확 일치 쪽에도 같은 규율을 둔다 — 「유일하다」가 깨진 것이면 더욱 고를 근거가 없다. */
  it('정확 일치에 여러 건이 걸려도 고르지 않는다', async () => {
    const outcome = await lookup([], {
      exact: [makeLot(), makeLot({ lotId: 90204, lotNo: NEW_LOT_NO })],
    });

    expect(outcome).toEqual({ kind: 'ambiguous', count: 2 });
  });

  it('부분 검색에 한 건이면 그것을 담는다', async () => {
    const outcome = await lookup([], { exact: [], partial: [makeLot()] });

    expect(outcome).toEqual({
      kind: 'part',
      code: NEW_LOT_NO,
      part: expect.objectContaining({ lotNo: NEW_LOT_NO }),
    });
  });

  it('둘 다 비면 읽은 코드를 그대로 들고 「찾지 못함」이 된다', async () => {
    const outcome = await lookup([], { exact: [], partial: [] }, 'LOT-SAMPLE-NONE');

    expect(outcome).toEqual({ kind: 'not-found', code: 'LOT-SAMPLE-NONE' });
  });

  /* ⛔ 대소문자 규칙이 계약에 없다(omf-mes#254 — 미결). 화면이 정하지 않는다. */
  it('읽은 코드를 대소문자 그대로 실어 보낸다', async () => {
    const seen: Query[] = [];

    await lookup(seen, { exact: [], partial: [] }, 'lot-sample-0031');

    expect(seen).toEqual([
      { lotNo: 'lot-sample-0031', q: null },
      { lotNo: null, q: 'lot-sample-0031' },
    ]);
  });

  it('보류 중인 LOT 도 담는다 — 교체 가부는 서버가 정한다', async () => {
    const outcome = await lookup([], {
      exact: [makeLot({ statusCode: 'HOLD', held: true })],
    });

    expect(outcome).toEqual({
      kind: 'part',
      code: NEW_LOT_NO,
      part: expect.objectContaining({ isHeld: true, statusCode: 'HOLD' }),
    });
  });
});
