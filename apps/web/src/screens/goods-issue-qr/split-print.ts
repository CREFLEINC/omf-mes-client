import { createIdempotencyKey, isForbidden } from '@omf-mes/api-client';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import {
  createMaterialLotLabelIssue,
  drawMaterialLotLabel,
  printMaterialLotLabel,
  reportMaterialLotLabelPrint,
} from '../../patterns/material-lot-label-print';
import { renditionShell } from '../../patterns/pop-print';
import { toApiError } from '../../patterns/request';
import { serverReasonOf } from '../../patterns/server-reason';
import { needsReissueReason, splitLotKeys, toLabelLot, type SplitMaterialLot } from './split-lots';

/**
 * 분할 LOT 라벨 찍기(008 · omf-all-around#289) — P-01-01 과 같은 네 걸음(`patterns/material-lot-label-print`):
 * 발행 기록 → 라벨 짜기 → 셸 인쇄 → 결과 보고.
 *
 * ⭐ 발행은 `MATERIAL_LOT_LABEL` · 대상 `LOT` 그대로다(contracts §5). 분할 LOT 은 늘 정상으로 태어나 IQC 라벨은 없다.
 * ⛔ **인쇄에 실패해도 발행 기록을 되돌리지 않는다.** 실패로 보고하면 서버가 그 LOT 을 미발행으로 되돌려 보인다
 *    (마지막 인쇄 결과 `FAILED`). 다음 찍기는 2회차라 재발행 사유가 필요하다.
 */

/** 한 장의 끝. */
export type SplitPrintOutcome =
  /** 인쇄까지 나갔다. 보고가 실패했어도 종이는 나왔다(같은 라벨을 또 찍지 않게). */
  | 'printed'
  /** 발행 기록은 남았으나 셸 인쇄가 실패했다 — 미발행으로 남는다. */
  | 'printFailed'
  /** 발행 기록부터 실패했다(자격 · 연결). */
  | 'issueFailed'
  /** 이 단말·작업자에게 발행 권한이 없다(403). */
  | 'issueForbidden'
  /** 앞 장에서 프린터가 서거나 권한이 없어 보내지 않았다. */
  | 'notSent';

export interface SplitPrintResult {
  lotId: number;
  outcome: SplitPrintOutcome;
  /** 실패 까닭 — 서버 거절 문구 또는 셸 문구. */
  message: string | null;
}

export interface SplitPrintOptions {
  /** 서버 발행 기록에 실을 프린터. 모르면 서버 기본값. */
  printerName: string | null;
  /** 셸에게 «이 프린터로» 실을 이름 — 셸이 고른 프린터를 받을 때만. */
  shellPrinterName: string | null;
  /** 재발행 사유 — 발행 기록이 있는 LOT 에만 싣는다(첫 발행에 사유가 붙으면 이력이 거짓이 된다). */
  reissueReasonCode: string | null;
}

export interface SplitPrintHandle {
  run: (
    lots: readonly SplitMaterialLot[],
    options: SplitPrintOptions,
  ) => Promise<SplitPrintResult[]>;
  isRunning: boolean;
  /** 지금 보내는 장(1부터) · 모두 몇 장. */
  progress: { done: number; total: number } | null;
}

/**
 * 고른 분할 LOT 을 **한 장씩 차례로** 찍는다(오래된 순 — 부르는 쪽이 정렬한다).
 *
 * ⛔ **한 번에 하나만 돈다** — 장갑 낀 손이 같은 렌더에서 두 번 누르면 같은 LOT 의 발행 기록이 두 번 남는다.
 * ⛔ **사번을 모르면 아무것도 부르지 않는다**(공유계약 D-5).
 * ⭐ 프린터가 서거나(셸 실패 · 통로 없음) 발행 권한이 없으면 남은 장을 보내지 않는다 — 다음 장도 같은 답이다.
 */
export const useSplitLabelPrint = (workerNo: string | null): SplitPrintHandle => {
  const { client } = useApiClient();
  const queryClient = useQueryClient();
  const running = useRef(false);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const run = useCallback(
    async (lots: readonly SplitMaterialLot[], options: SplitPrintOptions) => {
      if (workerNo === null || lots.length === 0 || running.current) return [];

      running.current = true;
      setIsRunning(true);

      const results: SplitPrintResult[] = [];
      let halted = false;

      try {
        for (const [index, lot] of lots.entries()) {
          setProgress({ done: index, total: lots.length });

          if (halted) {
            results.push({ lotId: lot.lotId, outcome: 'notSent', message: null });
            continue;
          }

          const result = await printOne(client, workerNo, lot, options);

          results.push(result);
          halted = result.outcome === 'printFailed' || result.outcome === 'issueForbidden';
        }
      } finally {
        running.current = false;
        setIsRunning(false);
        setProgress(null);
        // 발행 여부가 바뀌었다 — 끝나면 언제나 목록을 다시 읽는다.
        await queryClient.invalidateQueries({ queryKey: splitLotKeys.all });
      }

      return results;
    },
    [client, queryClient, workerNo],
  );

  return { run, isRunning, progress };
};

type Client = ReturnType<typeof useApiClient>['client'];

const printOne = async (
  client: Client,
  workerNo: string,
  lot: SplitMaterialLot,
  options: SplitPrintOptions,
): Promise<SplitPrintResult> => {
  let issue;

  try {
    issue = await createMaterialLotLabelIssue(
      client,
      {
        lotId: lot.lotId,
        printerName: options.printerName,
        reissueReasonCode: needsReissueReason(lot) ? options.reissueReasonCode : null,
      },
      workerNo,
      createIdempotencyKey(),
    );
  } catch (cause) {
    const error = toApiError(cause);

    return {
      lotId: lot.lotId,
      outcome: isForbidden(error) ? 'issueForbidden' : 'issueFailed',
      message: serverReasonOf(error),
    };
  }

  const bytes = drawMaterialLotLabel({ lot: toLabelLot(lot), issue });
  const failureReason = await printMaterialLotLabel(
    renditionShell(),
    bytes,
    `lot-${String(issue.documentIssueLogId)}`,
    options.shellPrinterName,
  );

  try {
    await reportMaterialLotLabelPrint(client, issue.documentIssueLogId, failureReason, workerNo);
  } catch {
    // 결과 보고만 실패했다 — 종이가 나왔으면 「나오지 않았다」고 말하지 않는다(재인쇄로 한 장 더 나간다).
  }

  return failureReason === null
    ? { lotId: lot.lotId, outcome: 'printed', message: null }
    : { lotId: lot.lotId, outcome: 'printFailed', message: failureReason };
};
