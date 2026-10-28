import { describe, expect, it } from 'vitest';

import {
  EMPTY_ITEM_FILTERS,
  ITEM_KEY,
  hasAnyFilter,
  readItemFilters,
  readPage,
  readSelectedId,
  toItemListQuery,
  toSearchParams,
} from './filters';
import {
  DEFAULT_SUBSIDIARY_TAB_ID,
  DEFAULT_TAB_ID,
  SUBSIDIARY_TAB_KEY,
  TAB_KEY,
  resolveSubsidiaryTab,
  resolveTab,
} from './tabs';
import type { ItemFilters } from './types';

const params = (search: string): URLSearchParams => new URLSearchParams(search);

describe('readItemFilters', () => {
  it('빈 주소는 빈 조건이다', () => {
    expect(readItemFilters(params(''))).toEqual(EMPTY_ITEM_FILTERS);
  });

  it('검색어와 미사용 포함을 읽는다', () => {
    expect(readItemFilters(params('q=SYN&inactive=1'))).toEqual({
      q: 'SYN',
      itemType: 'RAW_MATERIAL',
      includeInactive: true,
      iqc: '',
    });
  });

  /* IQC 대상은 `iqc=y|n` — 그 밖의 값은 전체다. */
  it('IQC 대상을 iqc 키에서 읽는다', () => {
    expect(readItemFilters(params('iqc=y')).iqc).toBe('Y');
    expect(readItemFilters(params('iqc=n')).iqc).toBe('N');
    expect(readItemFilters(params('iqc=x')).iqc).toBe('');
  });

  /* 처음 품목유형은 원자재다 — 「전체」는 `type=all` 로 따로 적는다. */
  it('품목유형이 없으면 원자재, all 이면 전체다', () => {
    expect(readItemFilters(params('')).itemType).toBe('RAW_MATERIAL');
    expect(readItemFilters(params('type=all')).itemType).toBe('');
  });

  it('품목 유형을 type 키에서 읽는다', () => {
    expect(readItemFilters(params('type=FINISHED')).itemType).toBe('FINISHED');
  });

  /* 켜짐을 나타내는 값은 `1` 하나뿐이다 — 주소를 손으로 고쳐도 뜻이 흔들리지 않는다. */
  it('미사용 포함은 1 이외의 값을 꺼진 것으로 본다', () => {
    expect(readItemFilters(params('inactive=true')).includeInactive).toBe(false);
    expect(readItemFilters(params('inactive=0')).includeInactive).toBe(false);
    expect(readItemFilters(params('inactive=')).includeInactive).toBe(false);
  });
});

describe('readPage', () => {
  it('없으면 첫 쪽이다', () => {
    expect(readPage(params(''))).toBe(1);
  });

  it('쪽 번호를 읽는다', () => {
    expect(readPage(params('page=3'))).toBe(3);
  });

  it('이상한 값은 첫 쪽으로 본다 — 주소는 손으로 고쳐지는 자리다', () => {
    expect(readPage(params('page=0'))).toBe(1);
    expect(readPage(params('page=-2'))).toBe(1);
    expect(readPage(params('page=abc'))).toBe(1);
    expect(readPage(params('page=1.5'))).toBe(1);
  });
});

describe('readSelectedId', () => {
  it('고른 품목 번호를 읽는다', () => {
    expect(readSelectedId(params('item=1001'), ITEM_KEY)).toBe(1001);
  });

  /*
   * 식별자는 1부터 매겨진다. 걸러 내지 않으면 `?item=abc`가 경로에 `NaN`을 실은
   * 상세 조회를 내보낸다.
   */
  it('어떤 자원도 가리키지 않는 값은 고르지 않은 것으로 본다', () => {
    expect(readSelectedId(params('item=0'), ITEM_KEY)).toBeNull();
    expect(readSelectedId(params('item=-1'), ITEM_KEY)).toBeNull();
    expect(readSelectedId(params('item=abc'), ITEM_KEY)).toBeNull();
    expect(readSelectedId(params('item=1.5'), ITEM_KEY)).toBeNull();
    expect(readSelectedId(params(''), ITEM_KEY)).toBeNull();
  });
});

describe('toSearchParams', () => {
  it('빈 조건은 키 자체를 두지 않는다', () => {
    expect(
      toSearchParams(DEFAULT_TAB_ID, DEFAULT_SUBSIDIARY_TAB_ID, EMPTY_ITEM_FILTERS, 1).toString(),
    ).toBe('');
  });

  it('걸린 조건만 주소에 남는다', () => {
    expect(
      toSearchParams(
        DEFAULT_TAB_ID,
        DEFAULT_SUBSIDIARY_TAB_ID,
        { q: 'SYN', itemType: '', includeInactive: true, iqc: '' },
        3,
      ).toString(),
    ).toBe('q=SYN&type=all&inactive=1&page=3');
  });

  it('IQC 대상은 걸렸을 때만 소문자로 쓴다', () => {
    expect(
      toSearchParams(
        DEFAULT_TAB_ID,
        DEFAULT_SUBSIDIARY_TAB_ID,
        { ...EMPTY_ITEM_FILTERS, iqc: 'N' },
        1,
      ).toString(),
    ).toBe('iqc=n');
  });

  it('처음 품목유형(원자재)은 주소에 쓰지 않는다', () => {
    expect(
      toSearchParams(DEFAULT_TAB_ID, DEFAULT_SUBSIDIARY_TAB_ID, EMPTY_ITEM_FILTERS, 1).toString(),
    ).toBe('');
  });

  /* 선택은 조건이 아니다 — 보이는 행이 달라지면 선택이 자연히 사라져야 한다. */
  it('고른 품목을 담지 않는다', () => {
    expect(
      toSearchParams(
        DEFAULT_TAB_ID,
        DEFAULT_SUBSIDIARY_TAB_ID,
        { q: 'SYN', itemType: '', includeInactive: false, iqc: '' },
        2,
      ).has(ITEM_KEY),
    ).toBe(false);
  });

  /* 「빈 조건·기본값은 키 자체를 두지 않는다」를 탭에도 그대로 적용한다. */
  it('기본 탭·기본 하위 탭은 주소에 쓰지 않는다', () => {
    const written = toSearchParams(
      DEFAULT_TAB_ID,
      DEFAULT_SUBSIDIARY_TAB_ID,
      EMPTY_ITEM_FILTERS,
      1,
    );

    expect(written.has(TAB_KEY)).toBe(false);
    expect(written.has(SUBSIDIARY_TAB_KEY)).toBe(false);
  });

  /*
   * 조건이 바뀌어도 「같은 품목의 어느 면을 보고 있는가」는 달라지지 않는다.
   * 여기서 탭을 떨구면 조건을 고칠 때마다 첫 탭으로 튕긴다.
   */
  it('기본이 아닌 탭은 조건이 바뀌어도 남는다', () => {
    expect(
      toSearchParams(
        'sub',
        DEFAULT_SUBSIDIARY_TAB_ID,
        { q: 'SYN', itemType: '', includeInactive: false, iqc: '' },
        1,
      ).get(TAB_KEY),
    ).toBe('sub');
  });

  /* 하위 탭도 같은 규칙이다 — 층이 다르다고 규칙을 달리하면 주소가 두 가지 말을 한다. */
  it('기본이 아닌 하위 탭도 조건이 바뀌어도 남는다', () => {
    expect(
      toSearchParams(
        'sub',
        'ext',
        { q: 'SYN', itemType: '', includeInactive: false, iqc: '' },
        1,
      ).get(SUBSIDIARY_TAB_KEY),
    ).toBe('ext');
  });
});

/**
 * M13 — 주소 왕복이 같은 조건을 낸다.
 * 이 왕복이 깨지면 새로고침·공유가 다른 결과를 낸다.
 */
describe('주소 왕복 (M13)', () => {
  const cases: { filters: ItemFilters; page: number }[] = [
    { filters: EMPTY_ITEM_FILTERS, page: 1 },
    { filters: { q: 'SYN-ITEM', itemType: '', includeInactive: false, iqc: '' }, page: 1 },
    { filters: { q: '', itemType: '', includeInactive: true, iqc: '' }, page: 4 },
    { filters: { q: '합성 품목', itemType: '', includeInactive: true, iqc: '' }, page: 12 },
  ];

  it.each(cases)('$filters / $page 쪽이 왕복해도 같다', ({ filters, page }) => {
    const written = toSearchParams(DEFAULT_TAB_ID, DEFAULT_SUBSIDIARY_TAB_ID, filters, page);

    expect(readItemFilters(written)).toEqual(filters);
    expect(readPage(written)).toBe(page);
    expect(resolveTab(written.get(TAB_KEY)).id).toBe(DEFAULT_TAB_ID);
    expect(resolveSubsidiaryTab(written.get(SUBSIDIARY_TAB_KEY)).id).toBe(
      DEFAULT_SUBSIDIARY_TAB_ID,
    );
  });

  /* 기본이 아닌 탭 조합도 왕복해야 한다 — 기본값만 왕복하면 규칙의 절반만 검사된다. */
  it.each([
    { tab: 'sub', sub: 'bu' },
    { tab: 'sub', sub: 'uom' },
    { tab: 'sub', sub: 'ext' },
  ] as const)('탭 $tab / 하위 탭 $sub 가 왕복해도 같다', ({ tab, sub }) => {
    const written = toSearchParams(tab, sub, EMPTY_ITEM_FILTERS, 1);

    expect(resolveTab(written.get(TAB_KEY)).id).toBe(tab);
    expect(resolveSubsidiaryTab(written.get(SUBSIDIARY_TAB_KEY)).id).toBe(sub);
  });
});

describe('toItemListQuery', () => {
  /*
   * 계약의 기본값이 false라 끈 상태를 값으로 실어 보내면
   * 「보내지 않음」과 「false를 보냄」 두 상태가 생겨 캐시 키가 갈린다.
   */
  it('빈 조건·꺼진 확인칸·첫 쪽은 싣지 않는다', () => {
    expect(toItemListQuery({ q: '', itemType: '', includeInactive: false, iqc: '' }, 1)).toEqual(
      {},
    );
  });

  /* 서버 조건 이름은 inspectionRequired(요청함 · hasBom 과 같은 모양). 전체면 싣지 않는다. */
  it('IQC 대상은 inspectionRequired 로 싣는다', () => {
    expect(toItemListQuery({ ...EMPTY_ITEM_FILTERS, iqc: 'Y' }, 1)).toEqual({
      itemTypeCode: 'RAW_MATERIAL',
      inspectionRequired: true,
    });
    expect(toItemListQuery({ ...EMPTY_ITEM_FILTERS, iqc: 'N' }, 1)).toMatchObject({
      inspectionRequired: false,
    });
  });

  it('처음 조건은 원자재만 싣는다', () => {
    expect(toItemListQuery(EMPTY_ITEM_FILTERS, 1)).toEqual({ itemTypeCode: 'RAW_MATERIAL' });
  });

  it('걸린 조건만 싣는다', () => {
    expect(toItemListQuery({ q: 'SYN', itemType: '', includeInactive: true, iqc: '' }, 2)).toEqual({
      q: 'SYN',
      includeInactive: true,
      page: 2,
    });
  });

  it('품목 유형은 걸렸을 때만 itemTypeCode 로 싣는다', () => {
    expect(
      toItemListQuery({ q: '', itemType: 'FINISHED', includeInactive: false, iqc: '' }, 1),
    ).toEqual({
      itemTypeCode: 'FINISHED',
    });
    expect(
      toItemListQuery({ q: '', itemType: '', includeInactive: false, iqc: '' }, 1),
    ).not.toHaveProperty('itemTypeCode');
  });

  /* 화면에 없는 조건을 요청에 실으면 사용자가 되돌릴 수단이 없다. */
  it('화면에 없는 Routing 보유 조건을 싣지 않는다', () => {
    const query = toItemListQuery({ q: 'SYN', itemType: '', includeInactive: true, iqc: '' }, 2);

    expect(query).not.toHaveProperty('hasRouting');
  });
});

describe('hasAnyFilter', () => {
  it('조건이 하나라도 걸리면 참이다', () => {
    expect(hasAnyFilter(EMPTY_ITEM_FILTERS)).toBe(false);
    expect(hasAnyFilter({ q: 'SYN', itemType: '', includeInactive: false, iqc: '' })).toBe(true);
    expect(hasAnyFilter({ q: '', itemType: '', includeInactive: true, iqc: '' })).toBe(true);
  });
});
