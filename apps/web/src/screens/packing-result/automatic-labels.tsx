import { AlertBanner, Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useMemo } from 'react';

import { DELIVERY_LABEL, PACKING_LABEL } from '../shipping-packing-label/codes';
import { useLabelIssue, type LabelIssueHandle } from '../shipping-packing-label/mutations';
import { usePrinters } from '../shipping-packing-label/queries';
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
  const deliveryRows = useMemo(
    () =>
      run.allocations
        .filter((allocation) => allocation.oqcPassed)
        .map((allocation) =>
          toDeliveryRow(toAllocationView(allocation), t.oqcPassed, t.oqcWaiting, t.lotUnavailable),
        ),
    [run.allocations],
  );
  const waiting = run.allocations.filter((allocation) => !allocation.oqcPassed);

  useEffect(() => {
    if (packing.phase !== 'idle' || packing.result.failedAt !== null) return;

    packing.issue({
      kind: PACKING_LABEL,
      rows: packingRows,
      printerName: toDefaultPrinterName(packingPrinters.data ?? []),
      reissueReasonCode: null,
    });
  }, [packing, packingPrinters.data, packingRows]);

  useAutomaticPrint(packing);
  useAutomaticPrint(delivery);

  useEffect(() => {
    if (packing.phase !== 'printed' || packing.result.failedAt !== null) return;
    if (deliveryRows.length === 0 || delivery.phase !== 'idle') return;

    delivery.issue({
      kind: DELIVERY_LABEL,
      rows: deliveryRows,
      printerName: toDefaultPrinterName(deliveryPrinters.data ?? []),
      reissueReasonCode: null,
    });
  }, [delivery, deliveryPrinters.data, deliveryRows, packing.phase, packing.result.failedAt]);

  const packingFailure = failureText(packing);
  const deliveryFailure = failureText(delivery);
  const isComplete =
    packing.phase === 'printed' &&
    packing.result.failedAt === null &&
    (deliveryRows.length === 0 ||
      (delivery.phase === 'printed' && delivery.result.failedAt === null));

  return (
    <section className="packing-label-status" aria-label={t.region}>
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
              rows: packingRows,
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
              rows: deliveryRows,
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
      delivery.result.failedAt === 'report' ? (
        <Button type="button" variant="outlined" size="md" onClick={onOpenManagement}>
          {t.openReissue}
        </Button>
      ) : null}
    </section>
  );
};
