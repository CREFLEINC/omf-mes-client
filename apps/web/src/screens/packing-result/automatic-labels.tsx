import { AlertBanner, Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useMemo } from 'react';

import { PACKING_LABEL } from '../shipping-packing-label/codes';
import { useLabelIssue, type LabelIssueHandle } from '../shipping-packing-label/mutations';
import {
  usePackingLabelCommand,
  usePackingLabelDrawer,
} from '../shipping-packing-label/packing-label-drawer';
import { useIssueSummaries, usePrinters } from '../shipping-packing-label/queries';
import { toDefaultPrinterName, type TargetRow } from '../shipping-packing-label/types';

import type { OpenHandlingUnit } from './mutations';
import type { ShipmentLotAllocation } from './types';

const t = messages.packingResult.automaticLabels;

export interface AutomaticLabelRun {
  handlingUnit: OpenHandlingUnit;
  /** 이 상자에 담긴 것 — **라벨의 수량 줄이 쓴다.** 발행 대상은 상자 하나다. */
  allocations: ShipmentLotAllocation[];
  /**
   * 포장 라벨이 찍는 값이다(설계 §8) — 이 화면이 이미 쥐고 있으므로 함께 넘긴다.
   *
   * ⛔ **모르면 `null` 이다.** 빈 문자열로 떨어뜨리면 출하 번호 칸이 빈 라벨이 종이로 나가고
   *    그것은 되돌릴 수 없다. `null` 이면 그리는 자리가 그 사실을 말하며 멈춘다.
   */
  shipmentNo: string | null;
}

interface AutomaticLabelsProps {
  run: AutomaticLabelRun;
  workerNo: string;
  onOpenManagement: () => void;
  /** 라벨 출력이 끝났는지 — 화면이 따로 세우던 확정 띠를 이때 거둔다(사용자 지시 2026-09-17). */
  onCompleteChange?: (isComplete: boolean) => void;
}

const packingRow = (handlingUnit: OpenHandlingUnit): TargetRow => ({
  targetId: handlingUnit.handlingUnitId,
  issueTargetId: handlingUnit.handlingUnitId,
  displayName: handlingUnit.handlingUnitNo,
  lotId: null,
  isIssuable: true,
  statusLabel: t.packingConfirmed,
});

const useAutomaticPrint = (issue: LabelIssueHandle): void => {
  useEffect(() => {
    if (issue.phase === 'issued' && issue.labels.length > 0) issue.print();
  }, [issue]);
};

const failureText = (issue: LabelIssueHandle): string | null => {
  if (issue.result.failedAt === null) return null;
  if (issue.result.failedAt === 'issue') return t.failures.issue;
  if (issue.result.failedAt === 'render') return t.failures.render;
  if (issue.result.failedAt === 'print') return t.failures.print;

  return t.failures.report;
};

/**
 * 포장 확정 뒤 **포장 라벨만** 자동 발행·인쇄한다.
 *
 * ⭐ **납품 라벨은 여기서 나가지 않는다**(사용자 결정 2026-09-16 · SHIP-UNIT-01).
 *    납품 라벨의 주인이 출하 LOT 배분에서 **출하 단위**(상자 1개 이상 묶음)로 바뀌었다.
 *    상자 하나를 확정한 시점에는 그 상자가 어느 출하 단위에 들어갈지 아직 정해지지 않았으므로,
 *    **여기서 발행할 대상 자체가 없다.** 납품 라벨은 출하 단위를 마감할 때 나간다(P-04-05).
 *
 * ⭐ **OQC 대기 배너도 함께 걷었다.** 그 배너는 「합격하지 않아 납품 라벨을 못 찍는 배분이
 *    몇 건 있다」는 말이었는데, 이 화면이 납품 라벨을 찍지 않으므로 할 말이 아니다. 출하검사는
 *    출하 처리 관문에서 이미 걸러진다.
 *
 * ⛔ **포장 라벨과 납품 라벨을 잇던 게이트도 없앴다.** 「포장 라벨이 인쇄까지 성공해야 납품
 *    라벨을 시작한다」는 규칙이었는데, 이을 것이 없어졌다.
 */
export const AutomaticLabels = ({
  run,
  workerNo,
  onOpenManagement,
  onCompleteChange,
}: AutomaticLabelsProps) => {
  /* 포장 라벨은 POP 이 그린다 — 재발행 화면과 **같은 손**을 쓴다(경로마다 라벨이 갈리지 않게). */
  const drawLabel = usePackingLabelDrawer({
    shipmentNo: run.shipmentNo,
    allocations: run.allocations,
  });
  /* 종이는 80 × 30 mm TSPL 로 나간다(사용자 지시 2026-09-17) — 그림은 크기가 어긋났다. */
  const drawCommand = usePackingLabelCommand({
    shipmentNo: run.shipmentNo,
    allocations: run.allocations,
  });
  const packing = useLabelIssue({ workerNo, drawLabel, drawCommand });
  const packingPrinters = usePrinters(PACKING_LABEL);
  const packingRows = useMemo(() => [packingRow(run.handlingUnit)], [run.handlingUnit]);
  const packingSummaries = useIssueSummaries(
    PACKING_LABEL,
    packingRows.map((row) => row.issueTargetId),
  );
  const missingPackingRows = packingRows.filter((row) =>
    packingSummaries.data?.some(
      (summary) => summary.targetId === row.issueTargetId && summary.issueCount === 0,
    ),
  );
  const packingHistoryComplete =
    packingSummaries.data !== undefined &&
    packingRows.every((row) =>
      packingSummaries.data.some(
        (summary) =>
          summary.targetId === row.issueTargetId &&
          summary.issueCount > 0 &&
          summary.lastPrintOutcome === 'SUCCEEDED',
      ),
    );
  const historyRecoveryCount = (packingSummaries.data ?? []).filter(
    (summary) => summary.issueCount > 0 && summary.lastPrintOutcome !== 'SUCCEEDED',
  ).length;

  useEffect(() => {
    if (
      packingSummaries.isPending ||
      packingSummaries.isError ||
      packingHistoryComplete ||
      historyRecoveryCount > 0 ||
      packing.phase !== 'idle' ||
      packing.result.failedAt !== null
    ) {
      return;
    }

    packing.issue({
      kind: PACKING_LABEL,
      rows: missingPackingRows,
      printerName: toDefaultPrinterName(packingPrinters.data ?? []),
      reissueReasonCode: null,
    });
  }, [
    historyRecoveryCount,
    missingPackingRows,
    packing,
    packingHistoryComplete,
    packingPrinters.data,
    packingSummaries,
  ]);

  useAutomaticPrint(packing);

  const packingFailure = failureText(packing);
  const isComplete =
    (packingHistoryComplete || (packing.phase === 'printed' && packing.result.failedAt === null)) &&
    historyRecoveryCount === 0;

  useEffect(() => {
    onCompleteChange?.(isComplete);
  }, [isComplete, onCompleteChange]);

  return (
    <section className="packing-label-status" aria-label={t.region}>
      {packingSummaries.isError ? (
        <AlertBanner variant="error">{t.failures.summary}</AlertBanner>
      ) : null}
      {historyRecoveryCount > 0 ? (
        <AlertBanner variant="warning">{t.reissueRequired(historyRecoveryCount)}</AlertBanner>
      ) : null}
      {packingFailure !== null ? (
        <AlertBanner variant="error">{t.packingFailure(packingFailure)}</AlertBanner>
      ) : null}
      {/* ⭐ 확정과 라벨 출력을 한 띠로 말한다(사용자 지시 2026-09-17) — 화면의 확정 띠는 이때 서지 않는다. */}
      {isComplete ? (
        <AlertBanner variant="success">{t.complete(run.handlingUnit.handlingUnitNo)}</AlertBanner>
      ) : null}
      {packing.result.failedAt === 'issue' ? (
        <Button
          type="button"
          variant="outlined"
          size="md"
          onClick={() => {
            packing.issue({
              kind: PACKING_LABEL,
              rows: missingPackingRows,
              printerName: toDefaultPrinterName(packingPrinters.data ?? []),
              reissueReasonCode: null,
            });
          }}
        >
          {t.retryPackingIssue}
        </Button>
      ) : null}
      {packing.result.failedAt === 'render' ? (
        <Button type="button" variant="outlined" size="md" onClick={packing.retryRendition}>
          {t.retryPackingRendition}
        </Button>
      ) : null}
      {packing.result.failedAt === 'print' ||
      packing.result.failedAt === 'report' ||
      historyRecoveryCount > 0 ? (
        <Button type="button" variant="outlined" size="md" onClick={onOpenManagement}>
          {t.openReissue}
        </Button>
      ) : null}
    </section>
  );
};
