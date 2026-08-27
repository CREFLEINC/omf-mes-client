import { describe, expect, it } from 'vitest';

import {
  EMPTY_FILTERS,
  FIXED_AXES,
  PAGE_SIZE,
  readFilters,
  readPage,
  readSelectedId,
  toListQuery,
  toPageParams,
  toSearchParams,
} from './filters';

const paramsOf = (search: string): URLSearchParams => new URLSearchParams(search);

describe('readPage', () => {
  it('쪽 키가 없으면 첫 쪽이다', () => {
    expect(readPage(paramsOf(''))).toBe(1);
  });

  it('쪽 번호를 읽는다', () => {
    expect(readPage(paramsOf('page=3'))).toBe(3);
  });

  it.each(['0', '-1', '1.5', 'abc', ''])(
    '쪽 번호가 아닌 값(%s)은 첫 쪽으로 읽는다 — 주소를 손으로 고쳐도 화면이 선다',
    (raw) => {
      expect(readPage(paramsOf(`page=${raw}`))).toBe(1);
    },
  );
});

describe('readSelectedId', () => {
  it('고른 의뢰를 읽는다', () => {
    expect(readSelectedId(paramsOf('ir=1001'))).toBe(1001);
  });

  it.each(['0', '-3', '2.5', 'x'])('식별자가 아닌 값(%s)은 고르지 않은 것으로 읽는다', (raw) => {
    expect(readSelectedId(paramsOf(`ir=${raw}`))).toBeNull();
  });
});

describe('readFilters', () => {
  it('조건이 없으면 아무것도 좁히지 않는다', () => {
    expect(readFilters(paramsOf(''))).toEqual(EMPTY_FILTERS);
  });

  it('세 조건을 읽는다', () => {
    expect(readFilters(paramsOf('wo=1001&lot=2002&q=IR-2026'))).toEqual({
      workOrderId: 1001,
      lotId: 2002,
      keyword: 'IR-2026',
    });
  });

  it.each(['wo', 'lot'])(
    '%s 가 식별자가 아니면 좁히지 않는다 — 어떤 자원도 가리키지 않는 값이다',
    (key) => {
      expect(readFilters(paramsOf(`${key}=0`))).toEqual(EMPTY_FILTERS);
    },
  );
});

describe('toListQuery', () => {
  it('고정 축 둘을 늘 싣는다 — 이 화면이 무엇인지의 정의라 사용자가 끌 수 없다', () => {
    const query = toListQuery(EMPTY_FILTERS, 1);

    expect(query.inspectionTypeCode).toBe(FIXED_AXES.inspectionTypeCode);
    expect(query.pendingOnly).toBe(true);
  });

  it('조건이 없으면 고정 축과 쪽·크기만 보낸다 — 빈 문자열은 조건이 아니다', () => {
    expect(toListQuery(EMPTY_FILTERS, 1)).toEqual({
      inspectionTypeCode: 'PQC',
      pendingOnly: true,
      page: 1,
      size: PAGE_SIZE,
    });
  });

  it('기간을 보내지 않는다 — 계약에서 사라졌고, 작업 대기열이라 심었다면 밀린 의뢰가 숨었을 자리다', () => {
    const query = toListQuery(EMPTY_FILTERS, 1);

    expect(query).not.toHaveProperty('requestedFrom');
    expect(query).not.toHaveProperty('requestedTo');
  });

  it('상태를 보내지 않는다 — 값 목록을 화면에 고정하지 않는다. 대기·진행은 pendingOnly 가 덮는다', () => {
    expect(toListQuery(EMPTY_FILTERS, 1)).not.toHaveProperty('statusCode');
  });

  it('채운 조건만 싣는다', () => {
    expect(toListQuery({ workOrderId: 7, lotId: null, keyword: '' }, 2)).toEqual({
      inspectionTypeCode: 'PQC',
      pendingOnly: true,
      workOrderId: 7,
      page: 2,
      size: PAGE_SIZE,
    });
  });

  it('공급사를 식별자로 싣는다 — 조인은 서버가 푼다', () => {
    expect(toListQuery({ ...EMPTY_FILTERS, lotId: 2002 }, 1).lotId).toBe(2002);
  });

  it('의뢰번호 검색은 q 로 간다', () => {
    expect(toListQuery({ ...EMPTY_FILTERS, keyword: 'IR-1' }, 1).q).toBe('IR-1');
  });
});

describe('toSearchParams', () => {
  it('기본값은 주소에 적지 않는다 — 첫 쪽과 「좁히지 않음」은 키가 없는 것으로 표현한다', () => {
    expect(toSearchParams(EMPTY_FILTERS, 1).toString()).toBe('');
  });

  it('첫 쪽이 아니면 쪽을 적는다', () => {
    expect(toSearchParams(EMPTY_FILTERS, 4).get('page')).toBe('4');
  });

  it('고른 의뢰를 싣지 않는다 — 조건이 바뀌면 그 의뢰가 목록에서 사라질 수 있다', () => {
    const params = toSearchParams({ ...EMPTY_FILTERS, workOrderId: 9 });

    expect(params.has('ir')).toBe(false);
  });

  it('채운 조건을 적는다', () => {
    const params = toSearchParams({ workOrderId: 12, lotId: 34, keyword: 'IR' });

    expect(Object.fromEntries(params)).toEqual({ wo: '12', lot: '34', q: 'IR' });
  });

  it('고정 축을 주소에 적지 않는다 — 지울 수 없는 것을 조건처럼 보이면 안 된다', () => {
    const params = toSearchParams({ workOrderId: 12, lotId: null, keyword: '' });

    expect(params.has('ty')).toBe(false);
    expect(params.has('pd')).toBe(false);
  });
});

describe('toPageParams', () => {
  it('조건과 고른 의뢰를 그대로 둔 채 쪽만 옮긴다 — 조건이 안 바뀌었으니 선택을 버릴 이유가 없다', () => {
    const next = toPageParams(paramsOf('wo=7&ir=1001'), 3);

    expect(Object.fromEntries(next)).toEqual({ wo: '7', ir: '1001', page: '3' });
  });

  it('첫 쪽으로 돌아가면 쪽 키를 지운다', () => {
    const next = toPageParams(paramsOf('wo=7&page=5'), 1);

    expect(next.has('page')).toBe(false);
    expect(next.get('wo')).toBe('7');
  });
});
