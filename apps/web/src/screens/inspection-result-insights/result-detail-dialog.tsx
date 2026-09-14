import { AlertBanner, Button, Dialog, EmptyState, SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { lookupDisplayLabelWithInactive } from '../../patterns/lookup-display';
import {
  useInspectionRequestDetail,
  useInspectionResultDetail,
  useMeasurementSummary,
  type MeasurementItemSummary,
} from './queries';
import type { ResultLabels } from './result-overview';

const t = messages.inspectionResultInsights.detail;
const EMPTY = t.unknown;
/* 기준 미등록은 「없는 값」이다 — 「모르는 값」(EMPTY)과 같은 모양으로 그리지 않는다(공유계약 G-9 · client#589). */
const NO_PLAN_VERSION = t.noPlanVersion;
const dateTime = (value: string): string => {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(value);
  return match === null ? value : `${match[1]} ${match[2]}`;
};
const count = (value: number | undefined): string => String(value ?? 0);
const remainingOutOfSpecCount = (item: MeasurementItemSummary): number => {
  const shown = item.outOfSpecValues?.length ?? 0;
  const total =
    'outOfSpecTotalCount' in item && typeof item.outOfSpecTotalCount === 'number'
      ? item.outOfSpecTotalCount
      : shown;
  return Math.max(0, total - shown);
};

interface ResultDetailDialogProps {
  inspectionResultId: number;
  labels: ResultLabels;
  onClose: () => void;
  onViewMeasurements: (inspectionResultId: number) => void;
}

const MeasurementSummaryRow = ({ item }: { item: MeasurementItemSummary }) => {
  const outOfSpecValues = item.outOfSpecValues ?? [];
  const remaining = remainingOutOfSpecCount(item);

  return (
    <li>
      <h4>{item.itemName}</h4>
      <p>{item.specText ?? t.specUnknown}</p>
      <p>
        {t.measuredCounts(
          count(item.measuredCount),
          count(item.acceptedCount),
          count(item.rejectedCount),
          count(item.unmeasuredCount),
        )}
      </p>
      {(outOfSpecValues.length > 0 || remaining > 0) && (
        <p>
          {t.outOfSpecExamples(
            outOfSpecValues.join(', '),
            remaining > 0
              ? t.outOfSpecRemaining(outOfSpecValues.length > 0 ? ' · ' : '', remaining)
              : '',
          )}
        </p>
      )}
      <p>{t.equipment(item.equipmentName ?? EMPTY)}</p>
      {item.equipmentCalibrationExpired === true && (
        <AlertBanner variant="warning">
          {item.equipmentCalibrationDueDate === null ||
          item.equipmentCalibrationDueDate === undefined
            ? t.calibrationExpired
            : t.calibrationExpiredWithDue(item.equipmentCalibrationDueDate)}
        </AlertBanner>
      )}
    </li>
  );
};

export const ResultDetailDialog = ({
  inspectionResultId,
  labels,
  onClose,
  onViewMeasurements,
}: ResultDetailDialogProps) => {
  const detail = useInspectionResultDetail(inspectionResultId);
  const request = useInspectionRequestDetail(detail.data?.inspectionRequestId ?? null);
  const summary = useMeasurementSummary(inspectionResultId);
  const planVersion =
    request.data === undefined
      ? EMPTY
      : (request.data.inspectionPlanVersionId ?? null) === null
        ? NO_PLAN_VERSION
        : String(request.data.inspectionPlanVersionId);
  const retry = (label: string, refetch: () => Promise<unknown>) => (
    <Button
      aria-label={t.retryOf(label)}
      size="sm"
      variant="outlined"
      onClick={() => void refetch()}
    >
      {t.retry}
    </Button>
  );
  const fields =
    detail.data === undefined
      ? []
      : [
          [t.fields.inspectionRequestNo, detail.data.inspectionRequestNo ?? EMPTY],
          [t.fields.planVersion, planVersion],
          [t.fields.item, lookupDisplayLabelWithInactive(labels.item, detail.data.itemId)],
          [t.fields.lotNo, detail.data.lotNo ?? EMPTY],
          [t.fields.process, detail.data.processName ?? EMPTY],
          [
            t.fields.quantities,
            `${detail.data.inspectedQty} / ${detail.data.acceptedQty} / ${detail.data.rejectedQty} / ${detail.data.heldQty}`,
          ],
          [
            t.fields.judgment,
            lookupDisplayLabelWithInactive(labels.judgment, detail.data.overallJudgmentCode),
          ],
          [
            t.fields.inspectedAt,
            t.inspectedAtWithRound(dateTime(detail.data.inspectedAt), detail.data.inspectionRound),
          ],
        ];

  return (
    <Dialog
      open
      size="lg"
      title={t.title}
      onClose={onClose}
      footer={
        <>
          <Button variant="outlined" onClick={onClose}>
            {t.close}
          </Button>
          <Button onClick={() => onViewMeasurements(inspectionResultId)}>
            {t.viewMeasurements}
          </Button>
        </>
      }
    >
      {detail.isPending && <SkeletonText lines={3} />}
      {detail.isError && (
        <AlertBanner
          variant="error"
          title={t.failed}
          action={retry(t.failedRetryTarget, detail.refetch)}
        />
      )}
      {!detail.isError && detail.data !== undefined && (
        <dl className="filter-bar" aria-label={t.fieldsLabel}>
          {fields.map(([label, value]) => (
            <div className="field-cell" key={label}>
              <dt className="field-label">{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}
      <h3>{t.summaryTitle}</h3>
      {summary.isPending && <SkeletonText lines={3} />}
      {summary.isError && (
        <AlertBanner
          variant="error"
          title={t.summaryFailed}
          action={retry(t.summaryRetryTarget, summary.refetch)}
        />
      )}
      {!summary.isError &&
        summary.data !== undefined &&
        (summary.data.items.length === 0 ? (
          <EmptyState size="sm" title={t.summaryEmpty} />
        ) : (
          <ul>
            {summary.data.items.map((item) => (
              <MeasurementSummaryRow key={item.inspectionItemSpecId} item={item} />
            ))}
          </ul>
        ))}
      {!summary.isError && summary.data !== undefined && (
        <p className="field-note">{t.asOf(dateTime(summary.data.asOf))}</p>
      )}
    </Dialog>
  );
};
