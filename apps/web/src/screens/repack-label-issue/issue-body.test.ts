import { describe, expect, it } from 'vitest';

import { HANDLING_UNIT_ID, REASON_CODE, readyPrinter } from './fixtures';
import { issueBody } from './issue-body';
import { DOCUMENT_TYPE_CODE, TARGET_TYPE_CODE, needsReason } from './types';

const base = {
  handlingUnitId: HANDLING_UNIT_ID,
  printerName: readyPrinter.printerName,
  reasonCode: '',
  reasonRequired: false,
};

describe('발행 요청 본문', () => {
  it('대상은 포장 단위 하나이고 포장 라벨을 찍는다', () => {
    const body = issueBody(base);

    expect(body.documentTypeCode).toBe(DOCUMENT_TYPE_CODE);
    expect(body.targets).toHaveLength(1);
    expect(body.targets[0]?.targetTypeCode).toBe(TARGET_TYPE_CODE);
    expect(body.targets[0]?.targetId).toBe(HANDLING_UNIT_ID);
  });

  /*
   * ⛔ 스펙 §4-B 가 「대상 LOT 을 비운다」로 못박은 자리다. 한 포장에 LOT 이 여럿이라 아무
   * LOT 이나 채우면 이력이 그 LOT 의 것으로 굳는다.
   */
  it('소속 LOT 을 싣지 않는다', () => {
    expect(issueBody(base).targets[0]).not.toHaveProperty('lotId');
  });

  it('고른 프린터를 싣는다 — 단말·프린터가 기록에 남아야 한다(K-3)', () => {
    expect(issueBody(base).printerName).toBe(readyPrinter.printerName);
  });

  it('프린터를 못 고른 상태에서는 빈 값을 싣지 않는다', () => {
    expect(issueBody({ ...base, printerName: '' })).not.toHaveProperty('printerName');
  });

  /* ⛔ 최초 기록에 재발행 사유가 붙으면 이력이 거짓이 된다(계약). */
  it('최초 발행이면 사유를 싣지 않는다 — 사유를 골라 뒀더라도', () => {
    const body = issueBody({ ...base, reasonCode: REASON_CODE, reasonRequired: false });

    expect(body).not.toHaveProperty('reissueReasonCode');
  });

  it('재발행이면 고른 사유를 싣는다', () => {
    const body = issueBody({ ...base, reasonCode: REASON_CODE, reasonRequired: true });

    expect(body.reissueReasonCode).toBe(REASON_CODE);
  });

  it('재발행인데 사유를 아직 안 골랐으면 빈 값을 싣지 않는다 — 서버가 422 로 막는다', () => {
    const body = issueBody({ ...base, reasonCode: '', reasonRequired: true });

    expect(body).not.toHaveProperty('reissueReasonCode');
  });

  /* ⛔ 회차는 서버가 매긴다(계약 · 스펙 §6) — 화면이 세지 않는다. */
  it('회차를 싣지 않는다', () => {
    expect(issueBody(base)).not.toHaveProperty('issueSeq');
  });
});

describe('재발행 사유가 필요한가', () => {
  it('발행한 적이 있으면 필요하다', () => {
    expect(needsReason({ issueCount: 1, lastIssuedAt: null, lastPrintOutcome: null })).toBe(true);
  });

  it('발행한 적이 없으면 필요 없다', () => {
    expect(needsReason({ issueCount: 0, lastIssuedAt: null, lastPrintOutcome: null })).toBe(false);
  });

  /*
   * ⛔ 모를 때 요구하면 최초 발행조차 막힌다. 집행은 서버의 422 이고, 화면은 그 말을 사유 칸
   * 아래에 놓는다.
   */
  it('발행 현황을 모르면 요구하지 않는다', () => {
    expect(needsReason({ issueCount: null, lastIssuedAt: null, lastPrintOutcome: null })).toBe(
      false,
    );
  });
});
