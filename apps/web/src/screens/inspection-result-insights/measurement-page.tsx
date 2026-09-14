import {
  AlertBanner,
  Button,
  type Column,
  EmptyState,
  Select,
  SkeletonText,
  Table,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { lookupDisplayLabelWithInactive, type LookupSource } from '../../patterns/lookup-display';
import {
  useInspectionMeasurements,
  useInspectionResultDetail,
  useMeasurementSummary,
  type InspectionMeasurement,
} from './queries';

type CalibrationFilter = '' | 'only' | 'exclude';
const t = messages.inspectionResultInsights.measurement;
const EMPTY = t.unknown;
const dateTime = (value: string): string => {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(value);
  return match === null ? value : `${match[1]} ${match[2]}`;
};
const measuredValue = (row: InspectionMeasurement): string => {
  if (row.numericValue !== undefined) return String(row.numericValue);
  if (row.textValue !== undefined) return row.textValue;
  if (row.booleanValue !== undefined) return row.booleanValue ? t.booleanTrue : t.booleanFalse;
  return t.unmeasured;
};

interface MeasurementPageProps {
  inspectionResultId: number;
  page: number;
  calibrationExpired: CalibrationFilter;
  judgmentSource: LookupSource;
  onPageChange: (page: number) => void;
  onCalibrationChange: (value: CalibrationFilter) => void;
}

export const MeasurementPage = ({
  inspectionResultId,
  page,
  calibrationExpired,
  judgmentSource,
  onPageChange,
  onCalibrationChange,
}: MeasurementPageProps) => {
  const detail = useInspectionResultDetail(inspectionResultId);
  const summary = useMeasurementSummary(inspectionResultId);
  const measurements = useInspectionMeasurements(inspectionResultId, page, calibrationExpired);
  const itemNames = new Map(
    summary.isError
      ? []
      : (summary.data?.items.map((item) => [item.inspectionItemSpecId, item.itemName]) ?? []),
  );
  const columns: Column<InspectionMeasurement>[] = [
    {
      key: 'item',
      header: t.columns.item,
      render: (row) => itemNames.get(row.inspectionItemSpecId) ?? t.itemNameUnknown,
    },
    { key: 'sampleNo', header: t.columns.sampleNo, align: 'end' },
    { key: 'value', header: t.columns.value, render: measuredValue },
    {
      key: 'judgmentCode',
      header: t.columns.judgment,
      render: (row) => lookupDisplayLabelWithInactive(judgmentSource, row.judgmentCode),
    },
    { key: 'measuredAt', header: t.columns.measuredAt, render: (row) => dateTime(row.measuredAt) },
    {
      key: 'calibration',
      header: t.columns.calibration,
      render: (row) =>
        row.calibrationExpiredAtMeasurement === true
          ? t.calibrationExpired
          : row.calibrationExpiredAtMeasurement === false
            ? t.calibrationNormal
            : EMPTY,
    },
  ];
  const retry = (label: string, refetch: () => unknown) => (
    <Button variant="outlined" size="sm" onClick={() => void refetch()}>
      {t.retryOf(label)}
    </Button>
  );
  const totalPages = Math.max(
    1,
    Math.ceil((measurements.data?.page.total ?? 0) / (measurements.data?.page.size ?? 50)),
  );
  const isBeyondLast = measurements.data !== undefined && page > totalPages;

  return (
    <section aria-labelledby="measurement-page-title">
      <h2 id="measurement-page-title">{t.title}</h2>
      {detail.isPending && <SkeletonText lines={1} />}
      {detail.isError && (
        <AlertBanner
          variant="error"
          title={t.detailFailed}
          action={retry(t.detailRetryTarget, detail.refetch)}
        />
      )}
      {!detail.isError && detail.data !== undefined && <p>{detail.data.inspectionResultNo}</p>}
      <Select
        aria-label={t.calibrationFilter}
        value={calibrationExpired}
        options={[
          { value: '', label: t.all },
          { value: 'only', label: t.calibrationOnly },
          { value: 'exclude', label: t.calibrationExclude },
        ]}
        onChange={(value) => onCalibrationChange(value as CalibrationFilter)}
      />
      {summary.isError && (
        <AlertBanner
          variant="error"
          title={t.summaryFailed}
          action={retry(t.summaryRetryTarget, summary.refetch)}
        />
      )}
      {(measurements.isPending || measurements.isPlaceholderData) && (
        <div role="status" aria-label={t.loading}>
          <SkeletonText lines={3} />
        </div>
      )}
      {measurements.isError && (
        <AlertBanner
          variant="error"
          title={t.failed}
          action={retry(t.retryTarget, measurements.refetch)}
        />
      )}
      {!measurements.isError &&
        !measurements.isPlaceholderData &&
        measurements.data !== undefined && (
          <>
            {isBeyondLast ? (
              <EmptyState size="sm" title={t.beyondLast} description={t.beyondLastDescription} />
            ) : (
              <Table
                density="compact"
                caption={t.caption}
                columns={columns}
                rows={[...measurements.data.items]}
                getRowId={(row) => String(row.inspectionMeasurementId)}
                empty={<EmptyState size="sm" title={t.empty} />}
              />
            )}
            <nav className="form-actions" aria-label={t.pagination}>
              <Button
                variant="outlined"
                disabled={page <= 1}
                onClick={() => onPageChange(page - 1)}
              >
                {t.previous}
              </Button>
              <span>
                {isBeyondLast
                  ? t.beyondLastPosition(page, totalPages)
                  : t.position(page, totalPages)}
              </span>
              <Button
                variant="outlined"
                disabled={page >= totalPages}
                onClick={() => onPageChange(page + 1)}
              >
                {t.next}
              </Button>
            </nav>
          </>
        )}
    </section>
  );
};
