import { describe, expect, it } from 'vitest';

import { DELIVERY_LABEL, PACKING_LABEL } from './codes';
import { toDocumentIssueBody, toPrintReportBody } from './issue-request';
import type { TargetRow } from './types';

const deliveryRow: TargetRow = {
  targetId: 9401,
  /** 납품 라벨은 서버에 LOT 으로 묻는다 — 줄은 배분이지만 대상은 LOT 이다. */
  issueTargetId: 9501,
  displayName: 'SYN-LOT-0001',
  lotId: 9501,
  isIssuable: true,
  statusLabel: '합격',
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
    expect(body.targets).toEqual([{ targetTypeCode: 'LOT', targetId: 9501, lotId: 9501 }]);
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

  it('고른 대상 전부가 한 본문에 실린다 — 한 트랜잭션이다', () => {
    const body = toDocumentIssueBody({
      kind: PACKING_LABEL,
      rows: [packingRow, { ...packingRow, targetId: 9602 }],
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
