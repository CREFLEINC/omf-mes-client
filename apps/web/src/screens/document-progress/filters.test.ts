import { describe, expect, it } from 'vitest';

import { DOCUMENT_TYPES } from './document-types';
import {
  DEFAULT_PROGRESS_FILTERS,
  readDateFilter,
  readFilters,
  readFlagFilter,
  readNumberFilter,
  readPage,
  toListQuery,
  toSearchParams,
  type ProgressFilters,
} from './filters';
import { documentTypeFixtures } from './fixtures';

const filters = (overrides: Partial<ProgressFilters> = {}): ProgressFilters => ({
  ...DEFAULT_PROGRESS_FILTERS,
  documentType: 'SYN_DOC_TYPE_A',
  ...overrides,
});

describe('DEFAULT_PROGRESS_FILTERS', () => {
  /*
   * 기본 기간도 기본 유형도 심지 않는다. 심으면 사용자가 확인하지 않은 조건으로 첫 요청이
   * 나가고, 왜 그 결과만 보이는지 화면 어디에서도 읽을 수 없다.
   */
  it('아무 조건도 걸려 있지 않다', () => {
    expect(DEFAULT_PROGRESS_FILTERS).toEqual({
      documentType: '',
      status: '',
      from: '',
      to: '',
      item: '',
      lot: '',
      warehouse: '',
      cancellableOnly: false,
      q: '',
    });
  });
});

describe('readNumberFilter', () => {
  it('양의 정수만 조건으로 받는다', () => {
    expect(readNumberFilter('9301')).toBe('9301');
  });

  it('0과 음수와 소수는 조건이 아니다', () => {
    expect(readNumberFilter('0')).toBe('');
    expect(readNumberFilter('-3')).toBe('');
    expect(readNumberFilter('1.5')).toBe('');
  });

  /* `NaN`이 요청 URL에 실리면 조회 전체가 실패하고 사용자에게는 「늘 안 된다」로만 보인다. */
  it('숫자가 아닌 값은 조건이 아니다', () => {
    expect(readNumberFilter('창고')).toBe('');
    expect(readNumberFilter('')).toBe('');
  });

  /* 상한이 없으면 `1e+21`이 URL에 실린다 — 막겠다고 적은 결함이 상한 쪽에서 되살아난다. */
  it('16자리 이상은 조건이 아니다', () => {
    expect(readNumberFilter('999999999999999')).toBe('999999999999999');
    expect(readNumberFilter('1000000000000000')).toBe('');
  });
});

describe('readDateFilter', () => {
  it('있는 날짜만 조건으로 받는다', () => {
    expect(readDateFilter('2026-08-06')).toBe('2026-08-06');
  });

  /* 자릿수만 보면 통과하는 없는 날 — 보내면 조회가 늘 실패하는데 조건은 걸린 것처럼 보인다. */
  it('없는 날짜는 조건이 아니다', () => {
    expect(readDateFilter('2026-02-31')).toBe('');
    expect(readDateFilter('2026-13-01')).toBe('');
  });

  it('모양이 다른 값은 조건이 아니다', () => {
    expect(readDateFilter('2026/08/06')).toBe('');
    expect(readDateFilter('')).toBe('');
  });
});

describe('readFlagFilter', () => {
  /*
   * 「참으로 읽히는 아무 값」을 켬으로 받으면 `?conly=false`가 켜진 상태가 되어
   * 주소가 화면과 반대를 말한다.
   */
  it("'1'만 켬으로 본다", () => {
    expect(readFlagFilter('1')).toBe(true);
    expect(readFlagFilter('false')).toBe(false);
    expect(readFlagFilter('true')).toBe(false);
    expect(readFlagFilter('0')).toBe(false);
    expect(readFlagFilter('')).toBe(false);
  });
});

describe('readFilters', () => {
  it('주소의 여덟 조건을 그대로 읽는다', () => {
    const params = new URLSearchParams(
      'ty=SYN_DOC_TYPE_A&st=SYN_STATUS_A&from=2026-08-01&to=2026-08-31&item=9301&lot=9601&wh=9701&conly=1&q=SYN-GR',
    );

    expect(readFilters(params)).toEqual({
      documentType: 'SYN_DOC_TYPE_A',
      status: 'SYN_STATUS_A',
      from: '2026-08-01',
      to: '2026-08-31',
      item: '9301',
      lot: '9601',
      warehouse: '9701',
      cancellableOnly: true,
      q: 'SYN-GR',
    });
  });

  /*
   * 손으로 고친 주소가 이 자리다 — 이상한 값은 조건으로 받지 않는다.
   *
   * **코드 조건 두 축을 함께 잰다**(`ty`·`st`). 한 축만 재면 나머지의 다듬기가 빠져도
   * 하류(`toListQuery`·`toSearchParams`)의 재다듬기가 가려 주어 감지기가 침묵한다.
   */
  it('이상한 값은 조건에서 떨어뜨린다', () => {
    const params = new URLSearchParams(
      'ty=%20%20&st=%20&from=2026-02-31&item=0&lot=abc&wh=-1&conly=yes',
    );

    expect(readFilters(params)).toEqual({
      ...DEFAULT_PROGRESS_FILTERS,
      q: '',
    });
  });

  /*
   * **검색어만 원문 그대로 읽는다.** 검색칸에 그대로 서야 하므로 다듬기는 쓰는 자리가 한다 —
   * 친 공백이 말없이 사라지면 사용자가 자기가 무엇을 쳤는지 되짚을 수 없다.
   */
  it('검색어는 다듬지 않고 읽는다', () => {
    expect(readFilters(new URLSearchParams('q=%20%20')).q).toBe('  ');
  });
});

describe('readPage', () => {
  it('주소가 가리키는 쪽을 읽는다', () => {
    expect(readPage(new URLSearchParams('page=3'))).toBe(3);
  });

  it('이상한 쪽 번호는 첫 쪽으로 본다', () => {
    expect(readPage(new URLSearchParams('page=0'))).toBe(1);
    expect(readPage(new URLSearchParams('page=abc'))).toBe(1);
    expect(readPage(new URLSearchParams())).toBe(1);
  });
});

describe('toSearchParams', () => {
  it('채운 조건만 주소에 적는다', () => {
    const params = toSearchParams(filters({ status: 'SYN_STATUS_A', item: '9301' }), 1);

    expect(params.toString()).toBe('ty=SYN_DOC_TYPE_A&st=SYN_STATUS_A&item=9301');
  });

  /* 기본값을 주소에 적으면 같은 화면의 주소가 두 가지가 된다. */
  it('첫 쪽과 꺼진 취소 조건은 주소에 적지 않는다', () => {
    const params = toSearchParams(filters({ cancellableOnly: false }), 1);

    expect(params.has('page')).toBe(false);
    expect(params.has('conly')).toBe(false);
  });

  it('쪽과 취소 조건이 걸리면 주소에 적는다', () => {
    const params = toSearchParams(filters({ cancellableOnly: true }), 3);

    expect(params.get('conly')).toBe('1');
    expect(params.get('page')).toBe('3');
  });

  /* 요청 조립과 같은 판정을 쓴다 — 갈리면 조건은 안 걸리는데 주소만 걸린 것처럼 보인다. */
  it('이상한 값은 주소에도 적지 않는다', () => {
    const params = toSearchParams(filters({ from: '2026-02-31', lot: '0', q: '   ' }), 1);

    expect(params.has('from')).toBe(false);
    expect(params.has('lot')).toBe(false);
    expect(params.has('q')).toBe(false);
  });
});

describe('toListQuery — 조회가 성립하는가', () => {
  /*
   * ⭐ **표가 비어 있는 동안에는 어떤 주소로도 질의가 만들어지지 않는다.**
   * 그것이 「목록 조회를 한 번도 부르지 않는다」의 구현이며, 표를 인자로 받기 때문에 잴 수 있다.
   */
  it('유형 표가 비어 있으면 질의를 만들지 않는다', () => {
    expect(toListQuery(filters(), DOCUMENT_TYPES, 1)).toBeNull();
  });

  it('유형을 고르지 않았으면 질의를 만들지 않는다', () => {
    expect(toListQuery(filters({ documentType: '' }), documentTypeFixtures, 1)).toBeNull();
  });

  it('표에 없는 유형이면 질의를 만들지 않는다', () => {
    expect(
      toListQuery(filters({ documentType: 'SYN_DOC_TYPE_Z' }), documentTypeFixtures, 1),
    ).toBeNull();
  });

  /* ⛔ 비활성 유형으로는 요청이 나가지 않는다 — 주소를 손으로 고쳐도 마찬가지다. */
  it('고를 수 없는 유형이면 질의를 만들지 않는다', () => {
    expect(
      toListQuery(filters({ documentType: 'SYN_DOC_TYPE_C' }), documentTypeFixtures, 1),
    ).toBeNull();
  });

  /* **표를 채우면 저절로 살아난다** — 다른 자리는 하나도 바뀌지 않는다. */
  it('표를 채우면 같은 조건으로 질의가 만들어진다', () => {
    expect(toListQuery(filters(), documentTypeFixtures, 1)).toEqual({
      documentTypeCode: 'SYN_DOC_TYPE_A',
      cancellableOnly: false,
    });
  });
});

describe('toListQuery — 조건 옮기기', () => {
  it('채운 조건만 질의에 싣는다', () => {
    const query = toListQuery(
      filters({
        status: 'SYN_STATUS_A',
        from: '2026-08-01',
        to: '2026-08-31',
        item: '9301',
        lot: '9601',
        warehouse: '9701',
        q: 'SYN-GR',
      }),
      documentTypeFixtures,
      2,
    );

    expect(query).toEqual({
      documentTypeCode: 'SYN_DOC_TYPE_A',
      statusCode: 'SYN_STATUS_A',
      documentDateFrom: '2026-08-01',
      documentDateTo: '2026-08-31',
      itemId: 9301,
      lotId: 9601,
      warehouseId: 9701,
      cancellableOnly: false,
      q: 'SYN-GR',
      page: 2,
    });
  });

  /*
   * ⭐ **`cancellableOnly`만 늘 실린다.** 계약의 기본값을 화면이 알 수 없는데 이 조건은 결과
   * 집합을 통째로 가른다 — 끈 상태에서 키를 빼면 화면은 껐다고 말하는데 서버는 켠 채로 답할 수 있다.
   */
  it('취소 가능 조건을 끄면 거짓을 싣는다 — 빼지 않는다', () => {
    const query = toListQuery(filters({ cancellableOnly: false }), documentTypeFixtures, 1);

    expect(query).toHaveProperty('cancellableOnly', false);
    expect(Object.keys(query ?? {})).toContain('cancellableOnly');
  });

  it('취소 가능 조건을 켜면 참을 싣는다', () => {
    expect(
      toListQuery(filters({ cancellableOnly: true }), documentTypeFixtures, 1)?.cancellableOnly,
    ).toBe(true);
  });

  it('첫 쪽이면 쪽을 싣지 않는다 — 서버 기본값이 1이다', () => {
    expect(toListQuery(filters(), documentTypeFixtures, 1)).not.toHaveProperty('page');
  });

  it('이상한 값은 질의에 싣지 않는다', () => {
    const query = toListQuery(
      filters({ from: '2026-13-01', item: '0', warehouse: 'abc', q: '   ' }),
      documentTypeFixtures,
      1,
    );

    expect(query).toEqual({ documentTypeCode: 'SYN_DOC_TYPE_A', cancellableOnly: false });
  });

  /* 번호는 문자열이 아니라 정수로 실린다 — 계약이 정수를 요구한다. */
  it('번호 조건을 정수로 옮긴다', () => {
    const query = toListQuery(filters({ item: '9301' }), documentTypeFixtures, 1);

    expect(query?.itemId).toBe(9301);
  });

  /* 유형 코드는 **표의 값**을 그대로 싣는다 — 주소의 공백은 다듬고 값은 지어내지 않는다. */
  it('유형 코드를 표에 있는 값 그대로 싣는다', () => {
    expect(
      toListQuery(filters({ documentType: ' SYN_DOC_TYPE_B ' }), documentTypeFixtures, 1)
        ?.documentTypeCode,
    ).toBe('SYN_DOC_TYPE_B');
  });
});
