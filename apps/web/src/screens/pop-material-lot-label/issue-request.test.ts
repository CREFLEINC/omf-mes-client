import { describe, expect, it } from 'vitest';

import { toDocumentIssueBody, toLotCreateBody, toPrintReportBody } from './issue-request';
import type { TargetRow } from './types';

/** 합성값이다 — 계약의 예시값을 쓰지 않는다(공개 저장소 경계). */
const row: TargetRow = {
  inboundReceiptLineId: 8501,
  inboundReceiptId: 8101,
  inboundReceiptNo: 'SYN-IB-0001',
  supplierId: 8201,
  plantId: 8301,
  receiptDatetime: '2026-08-27T09:12:30Z',
  itemId: 8601,
  receivedQty: 500,
  uomId: 8401,
  lotId: null,
};

describe('toLotCreateBody — 원천 짝', () => {
  it('원천 유형이 「입하 라인」이고 원천 식별자가 «라인» 번호다', () => {
    const body = toLotCreateBody(row, '2026-08-27T09:12:30+09:00');

    expect(body.sourceTypeCode).toBe('INBOUND_RECEIPT_LINE');
    expect(body.sourceId).toBe(row.inboundReceiptLineId);
  });

  it('⛔ 입하 «건» 번호를 원천 식별자로 싣지 않는다 — 계보의 출발점이 갈린다', () => {
    const body = toLotCreateBody(row, '2026-08-27T09:12:30+09:00');

    expect(body.sourceId).not.toBe(row.inboundReceiptId);
  });

  it('⛔ 번호를 화면이 싣지 않는다 — 서버가 매기고, 보내면 400이다', () => {
    const body = toLotCreateBody(row, '2026-08-27T09:12:30+09:00');

    expect(body.numberSourceCode).toBe('MES');
    expect(body.lotNo).toBeUndefined();
  });

  it('품목·수량·단위·공장을 입하 라인에서 그대로 승계한다', () => {
    const body = toLotCreateBody(row, '2026-08-27T09:12:30+09:00');

    expect(body).toMatchObject({
      itemId: row.itemId,
      initialQty: row.receivedQty,
      uomId: row.uomId,
      plantId: row.plantId,
    });
  });

  it('업무일자는 발생 시각에서 뗀다 — 실행 시각의 날짜를 따로 만들지 않는다', () => {
    const body = toLotCreateBody(row, '2026-08-27T23:40:00+09:00');

    expect(body.occurredAt).toBe('2026-08-27T23:40:00+09:00');
    expect(body.businessDate).toBe('2026-08-27');
  });
});

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
