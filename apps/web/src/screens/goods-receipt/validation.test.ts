import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import {
  CODE_FIELD_NAMES,
  CODE_MAX,
  postBlockReason,
  POST_FORM_FIELDS,
  validateDraft,
  type PostGateInput,
} from './validation';
import type { ReceiptDraft } from './types';

const t = messages.goodsReceipt;

const FILLED_DRAFT: ReceiptDraft = {
  warehouse: '9701',
  location: '9802',
  codes: {
    receiptType: 'SAMPLE_RECEIPT_TYPE_A',
    sourceDocumentType: 'INBOUND_RECEIPT',
    qualityStatus: 'SAMPLE_QUALITY_A',
    inventoryStatus: 'SAMPLE_INVENTORY_A',
    reason: '',
  },
  receiptDatetime: '2026-08-06T09:12',
  remarks: '',
};

const gate = (overrides: Partial<PostGateInput> = {}): PostGateInput => ({
  isCodeListPending: false,
  draft: FILLED_DRAFT,
  ...overrides,
});

describe('postBlockReason — 무엇이 막고 있는가', () => {
  it('다 갖춰지면 막지 않는다', () => {
    expect(postBlockReason(gate())).toBeNull();
  });

  /**
   * **G1의 전환** — 코드 목록이 없으면 「고르세요」가 아니라 「고를 것이 없다」고 말해야 한다.
   * 고를 수 없는 것을 고르라고 하면 사용자는 자기가 무엇을 놓쳤는지 찾다가 화면을 고장으로 읽는다.
   */
  it('코드 목록이 확정되지 않았으면 그 사정을 먼저 말한다', () => {
    expect(postBlockReason(gate({ isCodeListPending: true }))).toBe(
      t.actionReasons.postCodeListPending,
    );
  });

  it('코드 목록이 차면 그 사유가 사라진다', () => {
    const pending = postBlockReason(gate({ isCodeListPending: true }));

    expect(postBlockReason(gate({ isCodeListPending: false }))).not.toBe(pending);
    expect(postBlockReason(gate({ isCodeListPending: false }))).toBeNull();
  });

  it('창고를 고르지 않으면 막는다', () => {
    expect(postBlockReason(gate({ draft: { ...FILLED_DRAFT, warehouse: '' } }))).toBe(
      t.actionReasons.postNeedsWarehouse,
    );
  });

  it('위치를 고르지 않으면 막는다', () => {
    expect(postBlockReason(gate({ draft: { ...FILLED_DRAFT, location: '' } }))).toBe(
      t.actionReasons.postNeedsLocation,
    );
  });

  it('입고 일시를 넣지 않으면 막는다', () => {
    expect(postBlockReason(gate({ draft: { ...FILLED_DRAFT, receiptDatetime: '' } }))).toBe(
      t.actionReasons.postNeedsReceiptDatetime,
    );
  });

  it('필수 코드가 하나라도 비면 막는다', () => {
    for (const key of [
      'receiptType',
      'sourceDocumentType',
      'qualityStatus',
      'inventoryStatus',
    ] as const) {
      const draft = { ...FILLED_DRAFT, codes: { ...FILLED_DRAFT.codes, [key]: '' } };

      expect(postBlockReason(gate({ draft }))).toBe(t.actionReasons.postNeedsCodes);
    }
  });

  /*
   * **M24** — 계약에 `minLength`가 없어 목 서버가 빈 문자열을 201로 통과시킨다(실측).
   * 막는 곳이 화면뿐이다.
   */
  it('필수 코드가 공백만이면 막는다', () => {
    const draft = { ...FILLED_DRAFT, codes: { ...FILLED_DRAFT.codes, qualityStatus: '   ' } };

    expect(postBlockReason(gate({ draft }))).toBe(t.actionReasons.postNeedsCodes);
  });

  /* 사유는 계약상 선택이다 — 비어 있다고 막으면 넣을 수 없는 값을 요구하게 된다. */
  it('사유가 비어 있어도 막지 않는다', () => {
    expect(
      postBlockReason(
        gate({ draft: { ...FILLED_DRAFT, codes: { ...FILLED_DRAFT.codes, reason: '' } } }),
      ),
    ).toBeNull();
  });

  it('사유가 다섯 갈래로 서로 다르다', () => {
    const reasons = [
      postBlockReason(gate({ isCodeListPending: true })),
      postBlockReason(gate({ draft: { ...FILLED_DRAFT, warehouse: '' } })),
      postBlockReason(gate({ draft: { ...FILLED_DRAFT, location: '' } })),
      postBlockReason(
        gate({ draft: { ...FILLED_DRAFT, codes: { ...FILLED_DRAFT.codes, receiptType: '' } } }),
      ),
      postBlockReason(gate({ draft: { ...FILLED_DRAFT, receiptDatetime: '' } })),
    ];

    expect(new Set(reasons).size).toBe(5);
  });

  /*
   * 「라인을 골랐는가」는 이 함수가 판정하지 않는다 — 확정 구획 자체가 고른 줄 아래에만
   * 그려지기 때문이다. 그 조건을 여기 두면 늘 참인 가지가 된다.
   */
  it('입력이 라인 선택 여부를 담지 않는다', () => {
    expect(Object.keys(gate()).sort()).toEqual(['draft', 'isCodeListPending']);
  });
});

describe('validateDraft — 보내기 전에 화면이 잡는 것', () => {
  it('갖춰진 초안에는 오류가 없다', () => {
    expect(validateDraft(FILLED_DRAFT)).toEqual({});
  });

  /* 계약이 코드에 `maxLength: 50`을 둔다. 상한을 넘긴 값은 보내지 않고 사유를 낸다. */
  it('코드가 상한을 넘으면 그 칸의 오류가 된다', () => {
    const long = 'S'.repeat(CODE_MAX + 1);
    const errors = validateDraft({
      ...FILLED_DRAFT,
      codes: { ...FILLED_DRAFT.codes, receiptType: long },
    });

    expect(errors[CODE_FIELD_NAMES.receiptType]).toBe(t.errors.codeTooLong(CODE_MAX));
  });

  it('상한과 같은 길이는 통과한다', () => {
    const exact = 'S'.repeat(CODE_MAX);

    expect(
      validateDraft({ ...FILLED_DRAFT, codes: { ...FILLED_DRAFT.codes, receiptType: exact } }),
    ).toEqual({});
  });

  /* 보낼 값의 길이를 잰다 — 요청 조립이 앞뒤 공백을 떼고 보내므로 여기서도 뗀 값을 잰다. */
  it('앞뒤 공백을 뗀 길이로 잰다', () => {
    const padded = `  ${'S'.repeat(CODE_MAX)}  `;

    expect(
      validateDraft({ ...FILLED_DRAFT, codes: { ...FILLED_DRAFT.codes, receiptType: padded } }),
    ).toEqual({});
  });

  it('여러 코드가 상한을 넘으면 각각 오류가 된다', () => {
    const long = 'S'.repeat(CODE_MAX + 1);
    const errors = validateDraft({
      ...FILLED_DRAFT,
      codes: { ...FILLED_DRAFT.codes, qualityStatus: long, reason: long },
    });

    expect(Object.keys(errors).sort()).toEqual(
      [CODE_FIELD_NAMES.qualityStatus, CODE_FIELD_NAMES.reason].sort(),
    );
  });
});

describe('서버 오류를 인라인으로 낼 필드', () => {
  it('화면에 입력칸이 있는 이름만 담는다', () => {
    for (const name of Object.values(CODE_FIELD_NAMES)) {
      expect(POST_FORM_FIELDS).toContain(name);
    }

    expect(POST_FORM_FIELDS).toContain('warehouseId');
    expect(POST_FORM_FIELDS).toContain('destinationLocationId');
    expect(POST_FORM_FIELDS).toContain('receiptDatetime');
    expect(POST_FORM_FIELDS).toContain('remarks');
  });

  /* 화면이 값을 정하지 않는 필드는 인라인으로 낼 자리가 없다 — 배너로 올려야 보인다. */
  it('화면에 입력칸이 없는 이름은 담지 않는다', () => {
    for (const name of ['plantId', 'sourceDocumentId', 'businessDate', 'lotId', 'receiptQty']) {
      expect(POST_FORM_FIELDS).not.toContain(name);
    }
  });
});
