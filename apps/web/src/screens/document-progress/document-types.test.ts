import { describe, expect, it } from 'vitest';

import {
  cancelResourceOf,
  cancelTargetOf,
  describeDisabledTypes,
  DOCUMENT_TYPES,
  findDocumentType,
  findSelectableDocumentType,
  isDocumentTypeListPending,
  toDocumentTypeOptions,
} from './document-types';
import { documentTypeFixtures } from './fixtures';

describe('DOCUMENT_TYPES — 고정 OpenAPI 목록', () => {
  it('계약이 닫은 9종을 담는다', () => {
    expect(DOCUMENT_TYPES.map((entry) => entry.code)).toEqual([
      'PURCHASE_ORDER',
      'INBOUND_RECEIPT',
      'GOODS_RECEIPT',
      'MATERIAL_ISSUE_REQUEST',
      'PICKING_ORDER',
      'STOCK_TRANSFER',
      'SUBCONTRACT_ISSUE',
      'SUBCONTRACT_RECEIPT',
      'GOODS_ISSUE',
    ]);
  });

  it('더 이상 값 목록 대기로 판정하지 않는다', () => {
    expect(isDocumentTypeListPending(DOCUMENT_TYPES)).toBe(false);
  });

  /* 표를 인자로 받는 것이 자리표시 규율의 핵심이다 — 채우면 판정이 뒤집힌다. */
  it('채운 표를 넘기면 판정이 뒤집힌다', () => {
    expect(isDocumentTypeListPending(documentTypeFixtures)).toBe(false);
  });
});

describe('findDocumentType', () => {
  it('표에 있는 코드의 줄을 준다', () => {
    expect(findDocumentType('GOODS_ISSUE', documentTypeFixtures)?.label).toBe('합성 유형 나');
  });

  it('표에 없는 코드는 null이다', () => {
    expect(findDocumentType('SYN_DOC_TYPE_Z', documentTypeFixtures)).toBeNull();
  });

  it('고정 표에서 발주 유형을 찾는다', () => {
    expect(findDocumentType('PURCHASE_ORDER', DOCUMENT_TYPES)?.code).toBe('PURCHASE_ORDER');
  });
});

describe('findSelectableDocumentType', () => {
  it('고를 수 있는 유형은 그대로 준다', () => {
    expect(findSelectableDocumentType('GOODS_RECEIPT', documentTypeFixtures)?.code).toBe(
      'GOODS_RECEIPT',
    );
  });

  /*
   * ⛔ **비활성 유형은 조회에 쓸 수 없다.** 주소를 손으로 고쳐 넣어도 마찬가지여야 한다 —
   * 비활성은 화면이 정한 사실이므로 화면의 어느 경로에서도 같게 지켜져야 한다.
   */
  it('고를 수 없는 유형은 null이다 — 표에 있어도 마찬가지다', () => {
    expect(findDocumentType('INBOUND_RECEIPT', documentTypeFixtures)).not.toBeNull();
    expect(findSelectableDocumentType('INBOUND_RECEIPT', documentTypeFixtures)).toBeNull();
  });

  it('표에 없는 코드도 null이다', () => {
    expect(findSelectableDocumentType('SYN_DOC_TYPE_Z', documentTypeFixtures)).toBeNull();
  });
});

describe('toDocumentTypeOptions', () => {
  it('고정 표는 9개 선택지가 된다', () => {
    expect(toDocumentTypeOptions(DOCUMENT_TYPES)).toHaveLength(9);
  });

  /* 차례를 바꾸지 않는다 — 값이 어떤 차례로 오는지가 뜻일 수 있다. */
  it('표의 차례 그대로 옮긴다', () => {
    expect(toDocumentTypeOptions(documentTypeFixtures).map((option) => option.value)).toEqual([
      'GOODS_RECEIPT',
      'GOODS_ISSUE',
      'INBOUND_RECEIPT',
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
      describeDisabledTypes([
        { code: 'PURCHASE_ORDER', label: '가', cancelResource: null, disabledReason: null },
      ]),
    ).toBeUndefined();
  });

  it('고정 표에는 막힌 유형 안내가 없다', () => {
    expect(describeDisabledTypes(DOCUMENT_TYPES)).toBeUndefined();
  });

  /* 이름만 내면 왜 막혔는지, 사유만 내면 어느 유형이 막혔는지 알 수 없다 — 둘을 함께 낸다. */
  it('막힌 유형의 이름과 사유를 함께 낸다', () => {
    const note = describeDisabledTypes(documentTypeFixtures);

    expect(note).toContain('합성 유형 다');
    expect(note).toContain('이 유형에는 상태 컬럼이 없어 진행현황을 볼 수 없습니다');
    expect(note).not.toContain('합성 유형 가');
  });

  /*
   * 둘 이상 막히면 앞 사유의 끝과 뒤 이름의 시작이 한 문장처럼 붙어 읽힌다 —
   * 경계를 눈에 보이는 표식으로 가른다.
   */
  it('막힌 유형이 둘이면 경계가 보이게 가른다', () => {
    const note = describeDisabledTypes([
      { code: 'PURCHASE_ORDER', label: '가', cancelResource: null, disabledReason: '사유 하나' },
      { code: 'GOODS_RECEIPT', label: '나', cancelResource: null, disabledReason: '사유 둘' },
    ]);

    expect(note).toBe('가: 사유 하나 · 나: 사유 둘');
  });
});

describe('cancelResourceOf', () => {
  /**
   * ⭐ **표가 비어 있는 동안 어떤 유형에서도 취소가 서지 않는다.** 유형↔취소 리소스 규약을
   * 계약이 내려 주지 않아 표가 비어 있는 것이 지금의 사실이고, 그 상태에서 리소스를 지어내면
   * 화면이 **없는 주소로 취소 요청을 보낸다.**
   */
  it('고정 표에서 입고 취소 리소스를 얻는다', () => {
    expect(cancelResourceOf('GOODS_RECEIPT', DOCUMENT_TYPES)).toBe('goods-receipts');
  });

  /* ⭐ 표에 값이 생기면 **그것만으로** 취소 경로가 정해진다 — 다른 자리는 바뀌지 않는다. */
  it('표를 채우면 그 유형의 리소스를 낸다', () => {
    expect(cancelResourceOf('GOODS_ISSUE', documentTypeFixtures)).toBe('goods-receipts');
  });

  /**
   * 계약의 취소 경로는 셋뿐이라 **덮는 유형 중 일부에는 취소가 없다.** 없음을 없음으로 낸다 —
   * 아무 리소스나 채워 넣으면 취소가 없는 문서에 취소 요청이 나간다.
   */
  it('취소 리소스가 없는 유형은 null이다', () => {
    expect(cancelResourceOf('GOODS_RECEIPT', documentTypeFixtures)).toBeNull();
  });

  /* 표에 아예 없는 코드도 마찬가지다 — 이 화면이 다루는 유형이 아니다. */
  it('표에 없는 코드는 null이다', () => {
    expect(cancelResourceOf('SYN_DOC_TYPE_ZZ', documentTypeFixtures)).toBeNull();
  });

  /**
   * ⭐ **고를 수 없는 유형은 리소스가 적혀 있어도 내지 않는다** — 목록·상세와 **같은 잣대**다.
   * 갈리면 손으로 고친 주소(`?ty=…`)가 비활성 유형으로 취소 요청을 내보내는 길이 된다.
   *
   * 픽스처의 「합성 유형 다」가 **비활성인데 리소스를 갖고 있어** 이 가드가 실제로 재어진다.
   */
  it('고를 수 없는 유형은 리소스가 있어도 null이다', () => {
    expect(findDocumentType('INBOUND_RECEIPT', documentTypeFixtures)?.cancelResource).toBe(
      'goods-issues',
    );
    expect(cancelResourceOf('INBOUND_RECEIPT', documentTypeFixtures)).toBeNull();
  });
});

describe('cancelTargetOf', () => {
  it('고를 수 있고 취소 가능한 유형이면 유형 코드와 잠금 조회 리소스를 함께 낸다', () => {
    expect(cancelTargetOf('GOODS_RECEIPT', DOCUMENT_TYPES)).toEqual({
      documentTypeCode: 'GOODS_RECEIPT',
      resource: 'goods-receipts',
    });
  });

  it('취소 리소스가 없거나 고를 수 없는 유형이면 null이다', () => {
    expect(cancelTargetOf('GOODS_RECEIPT', documentTypeFixtures)).toBeNull();
    expect(cancelTargetOf('INBOUND_RECEIPT', documentTypeFixtures)).toBeNull();
  });
});
