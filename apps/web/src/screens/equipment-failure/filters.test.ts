import { describe, expect, it } from 'vitest';

import {
  DEFAULT_FILTERS,
  DEFAULT_OPEN_ONLY,
  ELAPSED_DESC_SORT,
  periodLockReason,
  readFilters,
  readPage,
  readSelected,
  toListQuery,
  toSearchParams,
} from './filters';

const params = (search: string): URLSearchParams => new URLSearchParams(search);

describe('readFilters', () => {
  /**
   * ⭐ 기본이 **켜짐**이다 — 이 화면은 적체를 보는 자리다. 형제 화면들의 boolean 조건은
   * 기본이 꺼짐이라 `params.get(key) === '1'` 한 줄로 읽는데, 그 줄을 그대로 베끼면
   * **기본값이 조용히 뒤집힌다.**
   */
  it('키가 없으면 「미처리만」이 켜져 있다', () => {
    expect(readFilters(params('')).openOnly).toBe(true);
    expect(DEFAULT_OPEN_ONLY).toBe(true);
  });

  it('모르는 값이면 기본값이다 — 사용자가 만들지 않은 조건을 걸지 않는다', () => {
    expect(readFilters(params('open=maybe')).openOnly).toBe(true);
  });

  it('끄면 꺼진다', () => {
    expect(readFilters(params('open=0')).openOnly).toBe(false);
  });

  it('모르는 상태 코드는 조건이 아니다 — 넘기면 결과가 늘 비고 이유를 알 수 없다', () => {
    expect(readFilters(params('status=SYN_UNKNOWN')).status).toBe('');
    expect(readFilters(params('status=DONE')).status).toBe('DONE');
  });

  it('달력에 없는 날은 조건이 아니다', () => {
    expect(readFilters(params('from=2026-02-31')).from).toBe('');
  });
});

describe('readSelected', () => {
  it('없거나 이상하면 고른 것이 없다', () => {
    expect(readSelected(params(''))).toBeNull();
    expect(readSelected(params('breakdown=0'))).toBeNull();
    expect(readSelected(params('breakdown=abc'))).toBeNull();
  });

  it('있으면 그 건이다 — 주소가 소유해 새로고침·공유가 같은 건을 연다', () => {
    expect(readSelected(params('breakdown=9001'))).toBe(9001);
  });
});

describe('toSearchParams', () => {
  it('기본값과 같은 조건은 싣지 않는다', () => {
    expect(toSearchParams(DEFAULT_FILTERS, 1, null).toString()).toBe('');
  });

  it('기본값과 다르면 싣는다', () => {
    expect(toSearchParams({ ...DEFAULT_FILTERS, openOnly: false }, 1, null).get('open')).toBe('0');
  });

  it('읽기와 쓰기가 서로를 되돌린다', () => {
    const filters = {
      equipment: '8101',
      status: 'HANDLING',
      openOnly: false,
      withoutOrder: true,
      from: '2026-08-01',
      to: '2026-08-18',
    };
    const written = toSearchParams(filters, 2, 9001);

    expect(readFilters(written)).toEqual(filters);
    expect(readPage(written)).toBe(2);
    expect(readSelected(written)).toBe(9001);
  });
});

describe('periodLockReason', () => {
  it('비어 있으면 막지 않는다', () => {
    expect(periodLockReason(DEFAULT_FILTERS)).toBeNull();
  });

  it('뒤집힌 기간을 막는다', () => {
    expect(
      periodLockReason({ ...DEFAULT_FILTERS, from: '2026-08-18', to: '2026-08-01' }),
    ).toContain('앞섭니다');
  });
});

describe('toListQuery', () => {
  /**
   * ⭐ 정렬을 늘 싣는다. 서버 기본값이 바뀌는 날 화면이 조용히 다른 차례를 보이고
   * **적체를 보는 화면이 아니게 된다.**
   */
  it('정렬을 늘 싣는다', () => {
    expect(toListQuery(DEFAULT_FILTERS, 1).sort).toBe(ELAPSED_DESC_SORT);
  });

  it('켜진 boolean만 싣는다 — 꺼진 것은 키 자체를 싣지 않는다', () => {
    expect(toListQuery(DEFAULT_FILTERS, 1)).toEqual({ openOnly: true, sort: ELAPSED_DESC_SORT });
    expect(toListQuery({ ...DEFAULT_FILTERS, openOnly: false }, 1)).toEqual({
      sort: ELAPSED_DESC_SORT,
    });
  });

  it('내부 번호를 수로 옮긴다', () => {
    expect(toListQuery({ ...DEFAULT_FILTERS, equipment: '8101' }, 1).equipmentId).toBe(8101);
  });
});
