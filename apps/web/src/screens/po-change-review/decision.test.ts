import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import {
  decisionLockReason,
  decisionWarnings,
  EMPTY_DECISION,
  reasonError,
  toAcknowledgeBody,
  type DecisionDraft,
  type DecisionGateInput,
} from './decision';
import type { AffectedWorkOrder, ChangeNotification } from './types';

const t = messages.poChangeReview;

const selected: ChangeNotification = {
  productionOrderId: 31,
  productionOrderNo: 'SYNTH-PO-0031',
  itemId: 5001,
  orderQty: 4000,
  uomId: 7001,
  dueDate: '2026-08-20',
  statusCode: 'CODE-A',
  acknowledgedAt: null,
};

const workOrder = (id: number, producedQty: number | null): AffectedWorkOrder => ({
  workOrderId: id,
  workOrderNo: `SYNTH-WO-${String(id)}`,
  orderQty: 3000,
  statusCode: 'CODE-B',
  producedQty,
  poMismatch: false,
  versionNo: 1,
});

const input = (overrides: Partial<DecisionGateInput> = {}): DecisionGateInput => ({
  selected,
  draft: { decision: 'APPLY', reason: '' },
  isSaving: false,
  ...overrides,
});

const draft = (over: Partial<DecisionDraft> = {}): DecisionDraft => ({
  ...EMPTY_DECISION,
  ...over,
});

describe('reasonError', () => {
  /*
   * ⛔ **강행일 때만 필수다**(§6) — 반영에 사유를 요구하면 정상 흐름이 매번 글쓰기를 요구받는다.
   */
  it('⛔ 강행에만 사유를 요구한다 — 반영에는 요구하지 않는다', () => {
    expect(reasonError(draft({ decision: 'PROCEED', reason: '' }))).toBe(t.decision.reasonRequired);
    expect(reasonError(draft({ decision: 'APPLY', reason: '' }))).toBeUndefined();
  });

  it('공백만으로는 통과하지 못한다', () => {
    expect(reasonError(draft({ decision: 'PROCEED', reason: '   ' }))).toBe(
      t.decision.reasonRequired,
    );
  });

  it('너무 길면 막는다', () => {
    expect(reasonError(draft({ decision: 'PROCEED', reason: '가'.repeat(501) }))).toBe(
      t.decision.reasonTooLong,
    );
    expect(reasonError(draft({ decision: 'PROCEED', reason: '가'.repeat(500) }))).toBeUndefined();
  });

  it('아직 고르지 않았으면 사유를 묻지 않는다', () => {
    expect(reasonError(EMPTY_DECISION)).toBeUndefined();
  });
});

describe('decisionLockReason', () => {
  it('반영은 사유 없이도 열린다', () => {
    expect(decisionLockReason(input())).toBeUndefined();
  });

  it('강행은 사유가 있어야 열린다', () => {
    expect(decisionLockReason(input({ draft: draft({ decision: 'PROCEED' }) }))).toBe(
      t.lock.reason,
    );
    expect(
      decisionLockReason(input({ draft: draft({ decision: 'PROCEED', reason: '납기 우선' }) })),
    ).toBeUndefined();
  });

  it('대상·판정을 고르기 전에는 그것부터 말한다', () => {
    expect(decisionLockReason(input({ selected: null }))).toBe(t.lock.selectNone);
    expect(decisionLockReason(input({ draft: EMPTY_DECISION }))).toBe(t.lock.decisionNone);
  });

  it('진행 중이 맨 앞이다 — 고쳐서 풀 것이 아니라 기다려야 할 것이다', () => {
    expect(decisionLockReason(input({ isSaving: true, selected: null }))).toBe(t.lock.saving);
  });
});

describe('toAcknowledgeBody', () => {
  /*
   * ⚠ **반영에는 사유를 싣지 않는다.** 계약이 「강행이면 사유가 필요하다」로 적었고, 빈 글자를
   * 실어 보내면 서버가 「사유를 적었는데 비어 있다」로 읽는다.
   */
  it('⚠ 반영에는 사유 칸을 싣지 않는다', () => {
    const body = toAcknowledgeBody(
      input({ draft: draft({ decision: 'APPLY', reason: '무시됨' }) }),
    );

    expect(body).toEqual({ decisionCode: 'APPLY' });
    expect(body).not.toHaveProperty('reason');
  });

  it('강행에는 사유를 다듬어 싣는다', () => {
    expect(
      toAcknowledgeBody(input({ draft: draft({ decision: 'PROCEED', reason: '  납기 우선  ' }) })),
    ).toEqual({ decisionCode: 'PROCEED', reason: '납기 우선' });
  });

  /* ⭐ 게이트와 본문이 «같은 입력»에서 갈리지 않아야 한다. */
  it('게이트가 열린 것과 본문이 만들어지는 것이 언제나 같이 간다', () => {
    const cases: DecisionGateInput[] = [
      input(),
      input({ selected: null }),
      input({ draft: EMPTY_DECISION }),
      input({ draft: draft({ decision: 'PROCEED' }) }),
      input({ draft: draft({ decision: 'PROCEED', reason: '사유' }) }),
      input({ isSaving: true }),
    ];

    for (const one of cases) {
      expect(toAcknowledgeBody(one) === null).toBe(decisionLockReason(one) !== undefined);
    }
  });
});

describe('decisionWarnings', () => {
  /*
   * ⭐ **저장 «전»에 파급을 말한다**(G-19). 되돌릴 수 없는 판정이라 무엇이 남는지를 누르기
   * 전에 보여야 한다 — 막지는 않는다(A-9 ⓑ).
   */
  it('⭐ 강행하면 불일치 표식이 남는다고 미리 말한다', () => {
    expect(decisionWarnings(draft({ decision: 'PROCEED', reason: 'x' }), [], 4000).mismatch).toBe(
      true,
    );
    expect(decisionWarnings(draft({ decision: 'APPLY' }), [], 4000).mismatch).toBe(false);
  });

  /*
   * ⚠ 지금은 조정을 «보낼 수가» 없어 반영을 고르면 언제나 참이다 — 그 사실을 화면이 말한다.
   * 조정 칸이 계약에 앉으면 「하나도 지정하지 않았을 때만」으로 좁아진다.
   */
  it('⚠ 반영인데 영향 W/O가 있으면 조정 파급을 말한다', () => {
    expect(
      decisionWarnings(draft({ decision: 'APPLY' }), [workOrder(13, 0)], 4000)
        .applyWithoutAdjustment,
    ).toBe(true);
    /* 영향 W/O가 없으면 조정할 것도 없다 — 쓸데없는 경고를 내지 않는다. */
    expect(decisionWarnings(draft({ decision: 'APPLY' }), [], 4000).applyWithoutAdjustment).toBe(
      false,
    );
  });

  /*
   * ⛔ **실적을 못 받은 것과 0인 것을 가른다**(G-9). 0으로 접으면 「이미 생산됨」 경고가
   * 사라진다 — 반영하면 계획이 실적보다 작아지는 바로 그 경우다.
   */
  it('⛔ 실적이 변경 후 수량을 넘는 W/O만 경고 대상이다', () => {
    const warnings = decisionWarnings(
      draft({ decision: 'APPLY' }),
      [workOrder(13, 5000), workOrder(14, 1200), workOrder(15, null)],
      4000,
    );

    expect(warnings.overProduced.map((one) => one.workOrderId)).toEqual([13]);
  });

  it('변경 후 수량을 모르면 실적 경고를 내지 않는다 — 견줄 것이 없다', () => {
    expect(
      decisionWarnings(draft({ decision: 'APPLY' }), [workOrder(13, 5000)], null).overProduced,
    ).toEqual([]);
  });
});
