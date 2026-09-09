import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import type { RouteState } from './queries';
import {
  EMPTY_DRAFT,
  issueLockReason,
  requestLockReason,
  toApprovalRequestCreate,
  toGoodsIssueCreate,
  type DisposalDraft,
  type ResolvedPlacement,
} from './request-draft';
import type { DisposalTarget } from './types';

/**
 * 게이트와 본문 조립의 시험.
 *
 * ⭐ **막는 사유를 이름으로 지목한다** — 「막힌다」만 단언하면 엉뚱한 사유로 막힌 것도 통과한다.
 */

const lock = messages.productDisposalRequest.lock;

/** 제출 순간. **영업일과 발생 시각이 여기서 갈린다.** */
const NOW = new Date('2026-09-09T10:20:30+09:00');

const TARGET: DisposalTarget = {
  dispositionDecisionId: 7001,
  nonconformanceNo: 'NC-2026-0071',
  dispositionTypeCode: 'SCRAP',
  decisionQty: 40,
  uomId: 3,
  reason: '재작업 불가 — 변형 손상',
  decidedBy: 12,
  decidedByName: '김품질',
  decidedAt: '2026-09-07T10:00:00+09:00',
  lotId: 9001,
  lotNo: 'FG-0288',
  itemId: 501,
};

const PLACEMENT: ResolvedPlacement = {
  warehouseId: 11,
  placements: [{ lotId: 9001, warehouseId: 11, locationId: 77 }],
};

const DRAFT: DisposalDraft = {
  reason: '재작업 불가 — 변형 손상',
  isSelfDisposal: true,
  partnerId: '',
  issueReasonCode: 'DEFECT_AFTER_RECEIPT',
  issueTypeCode: 'OTHER',
};

const FOUND: RouteState = { kind: 'found' };

const gate = (over: Partial<Parameters<typeof requestLockReason>[0]> = {}) => ({
  targets: [TARGET],
  draft: DRAFT,
  route: FOUND,
  isSaving: false,
  ...over,
});

const payload = (over: Partial<DisposalDraft> = {}) =>
  toGoodsIssueCreate({
    ...gate({ draft: { ...DRAFT, ...over } }),
    approval: 'unknown' as const,
    placement: PLACEMENT,
    now: NOW,
  });

describe('requestLockReason — 「승인 요청」을 막는 사유', () => {
  it('다 갖추면 막지 않는다', () => {
    expect(requestLockReason(gate())).toBeUndefined();
  });

  it('대상이 없으면 대상 선택을 사유로 낸다', () => {
    expect(requestLockReason(gate({ targets: [] }))).toBe(lock.selectNone);
  });

  it('사유가 비면 사유 입력을 사유로 낸다', () => {
    expect(requestLockReason(gate({ draft: { ...DRAFT, reason: '  ' } }))).toBe(lock.reason);
  });

  it('결재선이 없으면 결재선을 사유로 낸다', () => {
    expect(requestLockReason(gate({ route: { kind: 'missing' } }))).toBe(lock.route);
  });

  /**
   * ⛔ **사라진 「기준값 대기」로 막지 않는다.**
   *
   * 잠금 근거였던 두 값은 통지 #674 로 결말이 났다 — 원천 문서 유형은 값이 왔고, 승인 유형은
   * 화면이 보낼 값이 아니었다. 그 잠금이 남아 있으면 **아무도 이유를 못 찾는 채로 닫힌다.**
   */
  it('기준값을 기다리며 잠기지 않는다', () => {
    expect(requestLockReason(gate())).not.toBe(lock.selectNone);
    expect(requestLockReason(gate())).toBeUndefined();
  });
});

describe('issueLockReason — 「기타출고 처리」를 막는 사유', () => {
  /**
   * ⛔ **승인 «상태»로 잠그지 않는다**(통지 #674 · 설계서 §8-6).
   *
   * 상태 값을 판정할 수 없는 동안 앞질러 잠그면 **승인이 끝났는데도 열리지 않는다.**
   * 버튼을 열고 서버의 400 이 말한다(J-8).
   */
  it('승인 상태를 모르더라도 버튼을 잠그지 않는다', () => {
    expect(issueLockReason({ ...gate(), approval: 'unknown' })).toBeUndefined();
  });

  /** ⛔ 서버가 안 막는 자리라 화면이 막는다 — 안 정하고 나가면 「자체 폐기」로 저장된다. */
  it('자체 폐기도 거래처도 정하지 않았으면 도착지를 사유로 낸다', () => {
    const draft = { ...DRAFT, isSelfDisposal: false, partnerId: '' };

    expect(issueLockReason({ ...gate({ draft }), approval: 'unknown' })).toBe(lock.destination);
  });
});

describe('toGoodsIssueCreate — 전표 본문', () => {
  it('원천이 처분 결정이고 그 식별자를 짝으로 싣는다', () => {
    expect(payload()?.sourceDocumentTypeCode).toBe('DISPOSITION_DECISION');
    expect(payload()?.sourceDocumentId).toBe(7001);
  });

  /** ⛔ 참으로 새면 **승인 없이 재고가 빠진다.** 상수로 «싣는다» — 생략에 기대지 않는다. */
  it('즉시 전기하지 않는다', () => {
    expect(payload()?.postImmediately).toBe(false);
  });

  /** ⚠ `toISOString()` 은 UTC 라 자정 근처에서 하루가 밀린다 — 로컬 날짜를 쓴다. */
  it('영업일이 누른 순간의 로컬 날짜다', () => {
    expect(payload()?.businessDate).toBe('2026-09-09');
  });

  it('출고 줄이 고른 대상의 품목·LOT·수량·단위와 푼 위치를 싣는다', () => {
    expect(payload()?.lines).toEqual([
      { itemId: 501, lotId: 9001, issueQty: 40, uomId: 3, sourceLocationId: 77 },
    ]);
    expect(payload()?.sourceWarehouseId).toBe(11);
  });

  /** ⭐ 자체 폐기면 도착지 짝을 «함께» 비운다 — 한쪽만 비우면 다형 참조를 판별할 수 없다. */
  it('자체 폐기면 도착지 두 칸을 함께 비운다', () => {
    const body = payload({ isSelfDisposal: true });

    expect(body?.destinationTypeCode).toBeNull();
    expect(body?.destinationId).toBeNull();
  });

  it('폐기 거래처를 고르면 도착지 짝을 함께 싣는다', () => {
    const body = payload({ isSelfDisposal: false, partnerId: '303' });

    expect(body?.destinationTypeCode).toBe('DISPOSAL_SITE');
    expect(body?.destinationId).toBe(303);
  });

  /**
   * ⛔ **요청 사유를 전표 비고에 넣지 않는다**(통지 #675 §3).
   *
   * 그 칸은 전표 «비고»라 **결재함 목록 요약이 빈 채로 올라간다.** 사유는 둘째 호출의 본문이다.
   */
  it('요청 사유를 전표 비고에 싣지 않는다', () => {
    const body = payload();

    expect(body?.remarks).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain('재작업 불가 — 변형 손상');
  });

  /** ⛔ 자리를 못 찾은 대상이 섞이면 통째로 만들지 않는다 — 일부만 폐기되면 안 된다. */
  it('푼 자리에 없는 LOT 이 섞이면 본문을 만들지 않는다', () => {
    const other: DisposalTarget = { ...TARGET, dispositionDecisionId: 7002, lotId: 9002 };

    const body = toGoodsIssueCreate({
      ...gate({ targets: [TARGET, other] }),
      approval: 'unknown',
      placement: PLACEMENT,
      now: NOW,
    });

    expect(body).toBeNull();
  });

  it('막을 사유가 있으면 본문을 만들지 않는다', () => {
    const body = toGoodsIssueCreate({
      ...gate({ targets: [] }),
      approval: 'unknown',
      placement: PLACEMENT,
      now: NOW,
    });

    expect(body).toBeNull();
  });
});

describe('toApprovalRequestCreate — 상신 본문', () => {
  /** ⭐ 계약이 `reason` 한 칸이고 필수다. 그 문장이 결재함에서 목록 요약을 겸한다. */
  it('사유만 싣는다', () => {
    expect(toApprovalRequestCreate(DRAFT)).toEqual({ reason: '재작업 불가 — 변형 손상' });
  });

  it('앞뒤 공백을 걷어 낸다', () => {
    expect(toApprovalRequestCreate({ ...DRAFT, reason: '  변형 손상  ' })).toEqual({
      reason: '변형 손상',
    });
  });

  /** ⛔ 계약이 `minLength 1` 로 강제한다 — 빈 사유로 상신하지 않는다. */
  it('사유가 비면 만들지 않는다', () => {
    expect(toApprovalRequestCreate(EMPTY_DRAFT)).toBeNull();
    expect(toApprovalRequestCreate({ ...DRAFT, reason: '   ' })).toBeNull();
  });
});
