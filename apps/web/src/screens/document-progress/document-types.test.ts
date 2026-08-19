import { describe, expect, it } from 'vitest';

import {
  describeDisabledTypes,
  DOCUMENT_TYPES,
  findDocumentType,
  findSelectableDocumentType,
  isDocumentTypeListPending,
  toDocumentTypeOptions,
} from './document-types';
import { documentTypeFixtures } from './fixtures';

describe('DOCUMENT_TYPES — 자리표시', () => {
  /*
   * **비어 있는 것이 지금의 사실이다.** 하나라도 심으면 사용자가 그것으로 조회하는데
   * 서버는 그 유형을 모르고, 계약은 그때 400을 돌려준다.
   */
  it('비어 있다', () => {
    expect(DOCUMENT_TYPES).toEqual([]);
  });

  it('비어 있는 동안 「값 목록이 오지 않았다」로 판정된다', () => {
    expect(isDocumentTypeListPending(DOCUMENT_TYPES)).toBe(true);
  });

  /* 표를 인자로 받는 것이 자리표시 규율의 핵심이다 — 채우면 판정이 뒤집힌다. */
  it('채운 표를 넘기면 판정이 뒤집힌다', () => {
    expect(isDocumentTypeListPending(documentTypeFixtures)).toBe(false);
  });
});

describe('findDocumentType', () => {
  it('표에 있는 코드의 줄을 준다', () => {
    expect(findDocumentType('SYN_DOC_TYPE_B', documentTypeFixtures)?.label).toBe('합성 유형 나');
  });

  it('표에 없는 코드는 null이다', () => {
    expect(findDocumentType('SYN_DOC_TYPE_Z', documentTypeFixtures)).toBeNull();
  });

  /* 표가 비어 있으면 어떤 코드로도 찾을 수 없다 — 주소를 손으로 고쳐도 마찬가지다. */
  it('빈 표에서는 어떤 코드도 찾지 못한다', () => {
    expect(findDocumentType('SYN_DOC_TYPE_A', DOCUMENT_TYPES)).toBeNull();
  });
});

describe('findSelectableDocumentType', () => {
  it('고를 수 있는 유형은 그대로 준다', () => {
    expect(findSelectableDocumentType('SYN_DOC_TYPE_A', documentTypeFixtures)?.code).toBe(
      'SYN_DOC_TYPE_A',
    );
  });

  /*
   * ⛔ **비활성 유형은 조회에 쓸 수 없다.** 주소를 손으로 고쳐 넣어도 마찬가지여야 한다 —
   * 비활성은 화면이 정한 사실이므로 화면의 어느 경로에서도 같게 지켜져야 한다.
   */
  it('고를 수 없는 유형은 null이다 — 표에 있어도 마찬가지다', () => {
    expect(findDocumentType('SYN_DOC_TYPE_C', documentTypeFixtures)).not.toBeNull();
    expect(findSelectableDocumentType('SYN_DOC_TYPE_C', documentTypeFixtures)).toBeNull();
  });

  it('표에 없는 코드도 null이다', () => {
    expect(findSelectableDocumentType('SYN_DOC_TYPE_Z', documentTypeFixtures)).toBeNull();
  });
});

describe('toDocumentTypeOptions', () => {
  it('빈 표는 빈 선택지가 된다', () => {
    expect(toDocumentTypeOptions(DOCUMENT_TYPES)).toEqual([]);
  });

  /* 차례를 바꾸지 않는다 — 값이 어떤 차례로 오는지가 뜻일 수 있다. */
  it('표의 차례 그대로 옮긴다', () => {
    expect(toDocumentTypeOptions(documentTypeFixtures).map((option) => option.value)).toEqual([
      'SYN_DOC_TYPE_A',
      'SYN_DOC_TYPE_B',
      'SYN_DOC_TYPE_C',
    ]);
  });

  /* 목록에서 빼지 않는다 — 빼면 왜 그 유형이 없는지 화면 어디에서도 읽을 수 없다. */
  it('고를 수 없는 유형을 목록에 두되 비활성한다', () => {
    const options = toDocumentTypeOptions(documentTypeFixtures);

    expect(options[2]?.disabled).toBe(true);
    expect(options[0]?.disabled).toBeUndefined();
    expect(options[1]?.disabled).toBeUndefined();
  });
});

describe('describeDisabledTypes', () => {
  it('막힌 유형이 없으면 안내를 만들지 않는다', () => {
    expect(
      describeDisabledTypes([{ code: 'SYN_DOC_TYPE_A', label: '가', disabledReason: null }]),
    ).toBeUndefined();
  });

  it('빈 표에서도 안내를 만들지 않는다', () => {
    expect(describeDisabledTypes(DOCUMENT_TYPES)).toBeUndefined();
  });

  /* 이름만 내면 왜 막혔는지, 사유만 내면 어느 유형이 막혔는지 알 수 없다 — 둘을 함께 낸다. */
  it('막힌 유형의 이름과 사유를 함께 낸다', () => {
    const note = describeDisabledTypes(documentTypeFixtures);

    expect(note).toContain('합성 유형 다');
    expect(note).toContain('이 유형에는 상태 컬럼이 없어 진행현황을 볼 수 없습니다');
    expect(note).not.toContain('합성 유형 가');
  });
});
