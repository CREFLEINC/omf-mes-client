import { describe, expect, it } from 'vitest';

import { toDocumentIssueBody, toPrintReportBody } from './issue-request';

describe('toDocumentIssueBody — 발행 기록', () => {
  it('대상은 고른 LOT 하나이고 대상 식별자와 LOT 식별자가 같다', () => {
    const body = toDocumentIssueBody({
      lotId: 9001,
      printerName: null,
      reissueReasonCode: null,
    });

    expect(body.targets).toEqual([{ targetTypeCode: 'LOT', targetId: 9001, lotId: 9001 }]);
  });

  it('⛔ 단말 번호를 싣지 않는다 — 계약에서 삭제됐고 서버가 토큰에서 푼다', () => {
    const body = toDocumentIssueBody({
      lotId: 9001,
      printerName: 'syn-label-printer',
      reissueReasonCode: null,
    });

    expect(body).not.toHaveProperty('terminalId');
  });

  it('신규 발행에는 재발행 사유를 붙이지 않는다 — 붙으면 이력이 거짓이 된다', () => {
    const body = toDocumentIssueBody({
      lotId: 9001,
      printerName: null,
      reissueReasonCode: null,
    });

    expect(body).not.toHaveProperty('reissueReasonCode');
  });

  it('재인쇄에는 사유를 싣는다 — 회차가 2 이상이면 없을 때 422다', () => {
    const body = toDocumentIssueBody({
      lotId: 9001,
      printerName: null,
      reissueReasonCode: 'SYN_REISSUE_01',
    });

    expect(body.reissueReasonCode).toBe('SYN_REISSUE_01');
  });

  it('프린터를 고르지 않았으면 키를 싣지 않는다 — 서버 기본값에 맡긴다', () => {
    const body = toDocumentIssueBody({
      lotId: 9001,
      printerName: null,
      reissueReasonCode: null,
    });

    expect(body).not.toHaveProperty('printerName');
  });
});

describe('toPrintReportBody — 인쇄 결과 보고', () => {
  it('사유가 없으면 성공 보고다', () => {
    expect(toPrintReportBody(null)).toEqual({ outcome: 'SUCCEEDED' });
  });

  it('⛔ 실패는 사유와 «함께» 보고한다 — 사유 없는 FAILED는 422다', () => {
    expect(toPrintReportBody('프린터가 응답하지 않습니다.')).toEqual({
      outcome: 'FAILED',
      failureReason: '프린터가 응답하지 않습니다.',
    });
  });
});
