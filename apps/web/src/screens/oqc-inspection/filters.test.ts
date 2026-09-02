import { describe, expect, it } from 'vitest';

import {
  EMPTY_FILTERS,
  PAGE_SIZE,
  readFilters,
  readPage,
  readSelectedId,
  toListQuery,
  toPageParams,
  toSearchParams,
} from './filters';

/**
 * 「틀려도 조용한 것」만 잰다.
 *
 * ⭐ 이 화면에서 가장 조용히 틀리는 자리가 **`pendingOnly` 의 기본값**이다 — 주소에 적히지
 * 않으면서 질의에는 실려야 하고, 뒤집히면 화면이 「할 일」 대신 「한 일」을 보인다.
 */
describe('readFilters', () => {
  it('주소에 아무것도 없으면 대기·진행만 보기가 켜진 상태로 읽는다', () => {
    expect(readFilters(new URLSearchParams())).toEqual(EMPTY_FILTERS);
  });

  it('pd=0 일 때만 꺼진 것으로 읽는다 — 그 밖의 값은 기본값(켜짐)이다', () => {
    expect(readFilters(new URLSearchParams('pd=0')).pendingOnly).toBe(false);
    expect(readFilters(new URLSearchParams('pd=1')).pendingOnly).toBe(true);
    expect(readFilters(new URLSearchParams('pd=maybe')).pendingOnly).toBe(true);
  });

  it('번호가 아닌 품목은 조건이 되지 않는다 — 서버에 실어 보내면 무엇을 가리키는지 알 수 없다', () => {
    expect(readFilters(new URLSearchParams('it=0')).itemId).toBeNull();
    expect(readFilters(new URLSearchParams('it=-3')).itemId).toBeNull();
    expect(readFilters(new URLSearchParams('it=2.5')).itemId).toBeNull();
    expect(readFilters(new URLSearchParams('it=2101')).itemId).toBe(2101);
  });
});

describe('readPage · readSelectedId', () => {
  it('쪽이 없거나 1 미만이면 첫 쪽이다 — 주소를 손으로 고쳐도 화면이 선다', () => {
    expect(readPage(new URLSearchParams())).toBe(1);
    expect(readPage(new URLSearchParams('page=0'))).toBe(1);
    expect(readPage(new URLSearchParams('page=3'))).toBe(3);
  });

  it('고른 의뢰가 식별자가 아니면 아무것도 고르지 않은 상태다', () => {
    expect(readSelectedId(new URLSearchParams())).toBeNull();
    expect(readSelectedId(new URLSearchParams('ir=abc'))).toBeNull();
    expect(readSelectedId(new URLSearchParams('ir=4101'))).toBe(4101);
  });
});

describe('toListQuery', () => {
  it('고정 축 OQC 를 늘 싣고 기간을 싣지 않는다', () => {
    const query = toListQuery(EMPTY_FILTERS, 1);

    expect(query).toEqual({
      inspectionTypeCode: 'OQC',
      pendingOnly: true,
      page: 1,
      size: PAGE_SIZE,
    });
  });

  it('대기·진행만 보기를 꺼도 질의에는 값을 싣는다 — 빼면 계약 기본값(전부)으로 읽힌다', () => {
    expect(toListQuery({ ...EMPTY_FILTERS, pendingOnly: false }, 1).pendingOnly).toBe(false);
  });

  it('비어 있는 조건은 키 자체를 싣지 않는다', () => {
    const query = toListQuery({ itemId: 2101, keyword: 'IR-OQC', pendingOnly: true }, 2);

    expect(query.itemId).toBe(2101);
    expect(query.q).toBe('IR-OQC');
    expect(query.page).toBe(2);
    expect(Object.keys(toListQuery(EMPTY_FILTERS, 1))).not.toContain('q');
  });
});

describe('toSearchParams', () => {
  it('기본값을 주소에 적지 않는다 — 첫 쪽과 켜진 토글은 흔적을 남기지 않는다', () => {
    expect(toSearchParams(EMPTY_FILTERS, 1).toString()).toBe('');
  });

  it('토글을 껐을 때만 pd=0 을 적는다', () => {
    expect(toSearchParams({ ...EMPTY_FILTERS, pendingOnly: false }).get('pd')).toBe('0');
  });

  it('고른 의뢰를 싣지 않는다 — 조건이 바뀌면 그 의뢰가 목록에 없을 수 있다', () => {
    const params = toSearchParams({ itemId: 2101, keyword: 'IR', pendingOnly: true }, 3);

    expect(params.get('it')).toBe('2101');
    expect(params.get('q')).toBe('IR');
    expect(params.get('page')).toBe('3');
    expect(params.has('ir')).toBe(false);
  });
});

describe('toPageParams', () => {
  it('쪽만 옮기고 조건과 고른 의뢰는 그대로 둔다', () => {
    const next = toPageParams(new URLSearchParams('it=2101&ir=4101&pd=0'), 2);

    expect(next.get('it')).toBe('2101');
    expect(next.get('ir')).toBe('4101');
    expect(next.get('pd')).toBe('0');
    expect(next.get('page')).toBe('2');
  });

  it('첫 쪽으로 가면 쪽 키를 지운다 — 기본값을 주소에 남기지 않는다', () => {
    expect(toPageParams(new URLSearchParams('page=4'), 1).has('page')).toBe(false);
  });
});
