import { AlertBanner, Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useMemo } from 'react';

import {
  DELIVERY_LABEL,
  DELIVERY_LABEL_ISSUE_LOCKED,
  PACKING_LABEL,
} from '../shipping-packing-label/codes';
import { useLabelIssue, type LabelIssueHandle } from '../shipping-packing-label/mutations';
import { useIssueSummaries, usePrinters } from '../shipping-packing-label/queries';
import {
  toAllocationView,
  toDefaultPrinterName,
  toDeliveryRow,
  type TargetRow,
} from '../shipping-packing-label/types';

import type { OpenHandlingUnit } from './mutations';
import type { ShipmentLotAllocation } from './types';

const t = messages.packingResult.automaticLabels;

export interface AutomaticLabelRun {
  handlingUnit: OpenHandlingUnit;
  allocations: ShipmentLotAllocation[];
}

interface AutomaticLabelsProps {
  run: AutomaticLabelRun;
  workerNo: string;
  onOpenManagement: () => void;
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

/** 포장 확정 뒤 포장 라벨과 OQC 통과 납품 라벨을 순서대로 자동 발행·인쇄한다. */
export const AutomaticLabels = ({ run, workerNo, onOpenManagement }: AutomaticLabelsProps) => {
  const packing = useLabelIssue({ workerNo });
  const delivery = useLabelIssue({ workerNo });
  const packingPrinters = usePrinters(PACKING_LABEL);
  const deliveryPrinters = usePrinters(DELIVERY_LABEL);
  const packingRows = useMemo(() => [packingRow(run.handlingUnit)], [run.handlingUnit]);
  /*
   * ⛔⛔ **`DELIVERY_LABEL` 발행은 서버가 항상 422 `INVALID` 로 거부한다**(대응표 P1 「공용
   * 문서 발행」· I-27 마감 결정 · `shipping-packing-label/codes.ts` 의
   * `DELIVERY_LABEL_ISSUE_LOCKED`). 그 화면의 수동 발행 단추(`screen.tsx`)가 이 플래그를
   * 보고 요청 자체를 막는 것과 같은 결로, 자동 출력도 대상을 아예 만들지 않는다 — 그러지
   * 않으면 «저장 실패»만 영원히 반복해 보인다. 서버가 지원을 시작하면 이 잠금만 걷어내면
   * 포장 확정 뒤 자동 발행이 다시 납품 라벨까지 잇는다.
   */
  const deliveryRows = useMemo(
    () =>
      DELIVERY_LABEL_ISSUE_LOCKED
        ? []
        : run.allocations
            .filter((allocation) => allocation.oqcPassed)
            .map((allocation) =>
              toDeliveryRow(
                toAllocationView(allocation),
                t.oqcPassed,
                t.oqcWaiting,
                t.lotUnavailable,
              ),
            ),
    [run.allocations],
  );
  const packingSummaries = useIssueSummaries(
    PACKING_LABEL,
    packingRows.map((row) => row.issueTargetId),
  );
  const deliverySummaries = useIssueSummaries(
    DELIVERY_LABEL,
    deliveryRows.map((row) => row.issueTargetId),
  );
  const missingPackingRows = packingRows.filter((row) =>
    packingSummaries.data?.some(
      (summary) => summary.targetId === row.issueTargetId && summary.issueCount === 0,
    ),
  );
  const missingDeliveryRows = deliveryRows.filter((row) =>
    deliverySummaries.data?.some(
      (summary) => summary.targetId === row.issueTargetId && summary.issueCount === 0,
    ),
  );
  const waiting = run.allocations.filter((allocation) => !allocation.oqcPassed);
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
  const deliveryHistoryComplete =
    deliverySummaries.data !== undefined &&
    deliveryRows.every((row) =>
      deliverySummaries.data.some(
        (summary) =>
          summary.targetId === row.issueTargetId &&
          summary.issueCount > 0 &&
          summary.lastPrintOutcome === 'SUCCEEDED',
      ),
    );
  const packingHistoryRecoveryCount = (packingSummaries.data ?? []).filter(
    (summary) => summary.issueCount > 0 && summary.lastPrintOutcome !== 'SUCCEEDED',
  ).length;
  const deliveryHistoryRecoveryCount = (deliverySummaries.data ?? []).filter(
    (summary) => summary.issueCount > 0 && summary.lastPrintOutcome !== 'SUCCEEDED',
  ).length;
  const historyRecoveryCount = packingHistoryRecoveryCount + deliveryHistoryRecoveryCount;

  useEffect(() => {
    if (
      packingSummaries.isPending ||
      packingSummaries.isError ||
      packingHistoryComplete ||
      packingHistoryRecoveryCount > 0 ||
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
    missingPackingRows,
    packing,
    packingHistoryRecoveryCount,
    packingHistoryComplete,
    packingPrinters.data,
    packingSummaries,
  ]);

  useAutomaticPrint(packing);
  useAutomaticPrint(delivery);

  useEffect(() => {
    const packingFinished =
      packingHistoryComplete || (packing.phase === 'printed' && packing.result.failedAt === null);
    if (!packingFinished || deliverySummaries.isPending || deliverySummaries.isError) return;
    if (
      deliveryHistoryComplete ||
      deliveryHistoryRecoveryCount > 0 ||
      missingDeliveryRows.length === 0 ||
      delivery.phase !== 'idle'
    ) {
      return;
    }

    delivery.issue({
      kind: DELIVERY_LABEL,
      rows: missingDeliveryRows,
      printerName: toDefaultPrinterName(deliveryPrinters.data ?? []),
      reissueReasonCode: null,
    });
  }, [
    delivery,
    deliveryPrinters.data,
    deliverySummaries.isError,
    deliverySummaries.isPending,
    deliveryHistoryComplete,
    deliveryHistoryRecoveryCount,
    missingDeliveryRows,
    packing.phase,
    packing.result.failedAt,
    packingHistoryComplete,
  ]);

  const packingFailure = failureText(packing);
  const deliveryFailure = failureText(delivery);
  const packingComplete =
    packingHistoryComplete || (packing.phase === 'printed' && packing.result.failedAt === null);
  const deliveryComplete =
    deliveryRows.length === 0 ||
    deliveryHistoryComplete ||
    (delivery.phase === 'printed' && delivery.result.failedAt === null);
  const isComplete = packingComplete && deliveryComplete && historyRecoveryCount === 0;
  const isSummaryError = packingSummaries.isError || deliverySummaries.isError;

  return (
    <section className="packing-label-status" aria-label={t.region}>
      {isSummaryError ? <AlertBanner variant="error">{t.failures.summary}</AlertBanner> : null}
      {historyRecoveryCount > 0 ? (
        <AlertBanner variant="warning">{t.reissueRequired(historyRecoveryCount)}</AlertBanner>
      ) : null}
      {packingFailure !== null ? (
        <AlertBanner variant="error">{t.packingFailure(packingFailure)}</AlertBanner>
      ) : null}
      {deliveryFailure !== null ? (
        <AlertBanner variant="error">{t.deliveryFailure(deliveryFailure)}</AlertBanner>
      ) : null}
      {isComplete ? <AlertBanner variant="success">{t.complete}</AlertBanner> : null}
      {waiting.length > 0 ? (
        <AlertBanner variant="warning">{t.waiting(waiting.length)}</AlertBanner>
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
      {delivery.result.failedAt === 'issue' ? (
        <Button
          type="button"
          variant="outlined"
          size="md"
          onClick={() => {
            delivery.issue({
              kind: DELIVERY_LABEL,
              rows: missingDeliveryRows,
              printerName: toDefaultPrinterName(deliveryPrinters.data ?? []),
              reissueReasonCode: null,
            });
          }}
        >
          {t.retryDeliveryIssue}
        </Button>
      ) : null}
      {delivery.result.failedAt === 'render' ? (
        <Button type="button" variant="outlined" size="md" onClick={delivery.retryRendition}>
          {t.retryDeliveryRendition}
        </Button>
      ) : null}
      {packing.result.failedAt === 'print' ||
      packing.result.failedAt === 'report' ||
      delivery.result.failedAt === 'print' ||
      delivery.result.failedAt === 'report' ||
      historyRecoveryCount > 0 ? (
        <Button type="button" variant="outlined" size="md" onClick={onOpenManagement}>
          {t.openReissue}
        </Button>
      ) : null}
    </section>
  );
};
