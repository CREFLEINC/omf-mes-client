import { describe, expect, it } from 'vitest';

import { DELIVERY_LABEL, PACKING_LABEL } from './codes';
import { toDocumentIssueBody, toPrintReportBody } from './issue-request';
import type { TargetRow } from './types';

const deliveryRow: TargetRow = {
  targetId: 7001,
  /** 납품 라벨은 **마감된 출하 단위**를 대상으로 발행한다(SHIP-UNIT-01). */
  issueTargetId: 7001,
  displayName: 'SU-20260917-0001',
  /** ⛔ 한 단위에 여러 LOT 이 섞인다 — 서버도 이 대상 유형에 `lotId` 를 `null` 로 둔다. */
  lotId: null,
  isIssuable: true,
  statusLabel: '마감',
};

const packingRow: TargetRow = {
  targetId: 9601,
  issueTargetId: 9601,
  displayName: 'SYN-CTN-0001',
  lotId: null,
  isIssuable: true,
  statusLabel: 'SYN_HU_STATUS',
};

describe('toDocumentIssueBody', () => {
  it('라벨 종류가 문서 유형과 대상 유형을 함께 정한다', () => {
    const body = toDocumentIssueBody({
      kind: DELIVERY_LABEL,
      rows: [deliveryRow],
      printerName: null,
      reissueReasonCode: null,
    });

    expect(body.documentTypeCode).toBe(DELIVERY_LABEL);
    /*
     * ⛔ **배분으로 되돌리지 않는다.** 서버가 `SHIPMENT_LOT_ALLOCATION` 대상을 **422 INVALID** 로
     *    거부한다(전달본 v4) — 되돌리면 납품 라벨이 한 장도 나가지 않고, 화면은 그것을 그저
     *    「발행 실패」로만 보인다.
     */
    expect(body.targets).toEqual([{ targetTypeCode: 'SHIPPING_UNIT', targetId: 7001 }]);
    expect(body.targets[0]).not.toHaveProperty('lotId');
  });

  it('포장 라벨은 LOT 을 싣지 않는다 — 한 포장에 여러 LOT 이 섞여 하나로 정할 수 없다', () => {
    const body = toDocumentIssueBody({
      kind: PACKING_LABEL,
      rows: [packingRow],
      printerName: null,
      reissueReasonCode: null,
    });

    expect(body.targets).toEqual([{ targetTypeCode: 'HANDLING_UNIT', targetId: 9601 }]);
    expect(body.targets[0]).not.toHaveProperty('lotId');
  });

  it('회차와 단말을 싣지 않는다 — 서버가 매기고 서버가 푼다', () => {
    const body = toDocumentIssueBody({
      kind: DELIVERY_LABEL,
      rows: [deliveryRow],
      printerName: 'SYN-PRN-01',
      reissueReasonCode: 'SYN_REASON',
    });

    expect(body).not.toHaveProperty('issueSeq');
    expect(body).not.toHaveProperty('terminalId');
  });

  it('사유와 프린터는 있을 때만 키가 선다 — 빈 값을 「있다」로 보내지 않는다', () => {
    const bare = toDocumentIssueBody({
      kind: DELIVERY_LABEL,
      rows: [deliveryRow],
      printerName: null,
      reissueReasonCode: null,
    });

    expect(bare).not.toHaveProperty('reissueReasonCode');
    expect(bare).not.toHaveProperty('printerName');

    const filled = toDocumentIssueBody({
      kind: DELIVERY_LABEL,
      rows: [deliveryRow],
      printerName: 'SYN-PRN-01',
      reissueReasonCode: 'SYN_REASON',
    });

    expect(filled.reissueReasonCode).toBe('SYN_REASON');
    expect(filled.printerName).toBe('SYN-PRN-01');
  });

  it('출하 단위가 둘이면 납품 라벨 대상도 둘이다', () => {
    const body = toDocumentIssueBody({
      kind: DELIVERY_LABEL,
      rows: [deliveryRow, { ...deliveryRow, targetId: 7002, issueTargetId: 7002 }],
      printerName: null,
      reissueReasonCode: null,
    });

    expect(body.targets).toHaveLength(2);
    expect(body.targets[0]).toMatchObject({
      targetTypeCode: 'SHIPPING_UNIT',
      targetId: 7001,
    });
  });

  it('고른 대상 전부가 한 본문에 실린다 — 한 트랜잭션이다', () => {
    const body = toDocumentIssueBody({
      kind: PACKING_LABEL,
      rows: [packingRow, { ...packingRow, targetId: 9602, issueTargetId: 9602 }],
      printerName: null,
      reissueReasonCode: null,
    });

    expect(body.targets).toHaveLength(2);
  });
});

describe('toPrintReportBody', () => {
  it('사유가 없으면 성공 보고다', () => {
    expect(toPrintReportBody(null)).toEqual({ outcome: 'SUCCEEDED' });
  });

  it('실패에는 사유가 반드시 함께 실린다 — 없으면 서버가 422 로 막는다', () => {
    expect(toPrintReportBody('프린터 응답 없음')).toEqual({
      outcome: 'FAILED',
      failureReason: '프린터 응답 없음',
    });
  });
});
