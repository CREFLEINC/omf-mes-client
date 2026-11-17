import { describe, expect, it } from 'vitest';

import {
  NO_SHELL_REASON,
  printMaterialLotLabel,
  toDocumentIssueBody,
  toPrintReportBody,
} from './material-lot-label-print';
import type { RenditionShell } from './pop-print';

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

/*
 * 008(omf-all-around#289 · plan C1) — P-01-01 의 셸 인쇄 걸음을 꺼낸 것. 분할 LOT 라벨(P-01-02)도 같은 길로 찍는다.
 */
describe('printMaterialLotLabel — 셸 인쇄', () => {
  const BYTES = new Uint8Array([1, 2, 3]);
  const shellOf = (save: RenditionShell['save']): RenditionShell => ({ save });

  it('US2-2 셸 통로가 없으면 보내지 않고 실패 사유를 돌려준다 — 성공으로 보고하지 않게', async () => {
    await expect(printMaterialLotLabel(null, BYTES, 'lot-1')).resolves.toBe(NO_SHELL_REASON);
  });

  it('US2-2 보내면 null 이고, 고른 프린터가 있을 때만 다섯째 인자로 싣는다', async () => {
    const calls: unknown[][] = [];
    const shell = shellOf(async (...args) => {
      calls.push(args);

      return '/tmp/lot-1.tspl';
    });

    await expect(printMaterialLotLabel(shell, BYTES, 'lot-1')).resolves.toBeNull();
    await expect(printMaterialLotLabel(shell, BYTES, 'lot-2', 'syn-printer')).resolves.toBeNull();

    expect(calls.map((args) => [args[1], args[3], args.length, args[4]])).toEqual([
      ['lot-1', 'tspl', 4, undefined],
      ['lot-2', 'tspl', 5, 'syn-printer'],
    ]);
  });

  it('US2-2 ⛔ 셸이 실패해도 던지지 않고 사유를 돌려준다 — 결과 보고에 실린다', async () => {
    const shell = shellOf(() => Promise.reject(new Error('프린터가 응답하지 않습니다.')));

    await expect(printMaterialLotLabel(shell, BYTES, 'lot-1')).resolves.toBe(
      '프린터가 응답하지 않습니다.',
    );
  });
});
