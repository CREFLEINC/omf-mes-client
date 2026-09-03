import { describe, expect, it } from 'vitest';

import {
  DETAIL_SELECTION_KEY,
  readSelectedDocumentId,
  toDetailSelection,
  withoutSelection,
  withSelection,
} from './detail-selection';
import type { DocumentTypeEntry } from './document-types';
import { DEFAULT_PROGRESS_FILTERS, toSearchParams, type ProgressFilters } from './filters';

const SELECTABLE = 'GOODS_RECEIPT';
const DISABLED = 'INBOUND_RECEIPT';

const entries: readonly DocumentTypeEntry[] = [
  { code: SELECTABLE, label: '합성 유형 가', cancelResource: null, disabledReason: null },
  {
    code: DISABLED,
    label: '합성 유형 다',
    cancelResource: null,
    disabledReason: '이 유형은 볼 수 없습니다',
  },
];

const filtersWith = (documentType: string): ProgressFilters => ({
  ...DEFAULT_PROGRESS_FILTERS,
  documentType,
});

const params = (search: string): URLSearchParams => new URLSearchParams(search);

describe('readSelectedDocumentId', () => {
  it('주소의 번호를 읽는다', () => {
    expect(readSelectedDocumentId(params('sel=9001'))).toBe(9001);
  });

  it('키가 없으면 null이다', () => {
    expect(readSelectedDocumentId(params(''))).toBeNull();
  });

  /**
   * 주소는 손으로 고쳐지는 자리다. 이상한 값을 그대로 `Number()`에 넘기면 `NaN`이나 `1e+21`이
   * **경로 조각으로** 실려 나가, 상세 조회가 늘 실패하는데 화면에는 무언가 고른 것처럼 보인다.
   */
  it.each([
    ['빈 값', 'sel='],
    ['0', 'sel=0'],
    ['음수', 'sel=-1'],
    ['소수', 'sel=9001.5'],
    ['글자', 'sel=abc'],
    ['공백', 'sel=%20'],
    ['16자리', 'sel=1234567890123456'],
  ])('%s은 고르지 않은 것으로 본다', (_label, search) => {
    expect(readSelectedDocumentId(params(search))).toBeNull();
  });
});

describe('toDetailSelection', () => {
  /**
   * ⭐ **유형과 번호가 둘 다 있어야 상세를 가리킬 수 있다**(계약 경로가 둘을 열쇠로 쓴다).
   * 유형은 조회 조건에서 오고 번호는 고른 행에서 온다 — 목록 응답이 오기 전에도 정해진다.
   */
  it('고를 수 있는 유형과 번호가 있으면 짝을 낸다', () => {
    expect(toDetailSelection(filtersWith(SELECTABLE), entries, params('sel=9001'))).toEqual({
      documentTypeCode: SELECTABLE,
      documentId: 9001,
    });
  });

  it('번호가 없으면 null이다', () => {
    expect(toDetailSelection(filtersWith(SELECTABLE), entries, params(''))).toBeNull();
  });

  /**
   * ⭐ **유형 표가 비어 있는 동안에는 상세도 부르지 않는다.** 목록과 같은 잣대를 쓴다 —
   * 갈리면 목록은 못 부르는데 상세만 나가는 화면이 된다.
   */
  it('유형 표가 비어 있으면 null이다', () => {
    expect(toDetailSelection(filtersWith(SELECTABLE), [], params('sel=9001'))).toBeNull();
  });

  it('표에 없는 유형이면 null이다', () => {
    expect(toDetailSelection(filtersWith('SYN_UNKNOWN'), entries, params('sel=9001'))).toBeNull();
  });

  /* 고를 수 없는 유형은 목록도 못 부른다 — 그 유형의 상세만 열리는 길을 두지 않는다. */
  it('고를 수 없는 유형이면 null이다', () => {
    expect(toDetailSelection(filtersWith(DISABLED), entries, params('sel=9001'))).toBeNull();
  });

  it('유형이 비어 있으면 null이다', () => {
    expect(toDetailSelection(filtersWith(''), entries, params('sel=9001'))).toBeNull();
  });
});

describe('withSelection · withoutSelection', () => {
  it('조건을 유지한 채 고른 번호만 덧붙인다', () => {
    const base = toSearchParams({ ...filtersWith(SELECTABLE), q: 'SYN-GR' }, 2);

    const next = withSelection(base, 9001);

    expect(next.get(DETAIL_SELECTION_KEY)).toBe('9001');
    expect(next.get('ty')).toBe(SELECTABLE);
    expect(next.get('q')).toBe('SYN-GR');
    expect(next.get('page')).toBe('2');
  });

  it('원본을 바꾸지 않는다', () => {
    const base = toSearchParams(filtersWith(SELECTABLE), 1);

    withSelection(base, 9001);

    expect(base.has(DETAIL_SELECTION_KEY)).toBe(false);
  });

  it('선택만 뗀다 — 조건은 그대로다', () => {
    const next = withoutSelection(params(`ty=${SELECTABLE}&q=SYN-GR&${DETAIL_SELECTION_KEY}=9001`));

    expect(next.has(DETAIL_SELECTION_KEY)).toBe(false);
    expect(next.get('ty')).toBe(SELECTABLE);
    expect(next.get('q')).toBe('SYN-GR');
  });

  /**
   * ⭐ **조건·쪽을 다시 쓰는 길이 선택을 저절로 비운다.** `toSearchParams`가 선택 키를
   * 만들지 않는 것이 그 규칙의 구현이다 — 조건이 바뀌면 고른 문서가 새 결과에 없을 수 있는데,
   * 남겨 두면 아래 구획이 위에 보이지 않는 문서를 가리킨 채 열려 있다.
   */
  it('조건 주소를 다시 만들면 선택 키가 없다', () => {
    const next = toSearchParams({ ...filtersWith(SELECTABLE), q: 'SYN-GR' }, 3);

    expect(next.has(DETAIL_SELECTION_KEY)).toBe(false);
  });
});
