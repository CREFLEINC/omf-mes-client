import { AlertBanner, Button, Chip, type Column, SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import { lookupDisplayLabelWithInactive, type LookupSource } from '../../patterns/lookup-display';
import { ManagedTable } from '../../patterns/managed-table';
import { formatPlantDateTime } from '../../patterns/plant-time';
import { Select } from '../../patterns/select';
import { useInspectionMeasurements, type InspectionMeasurement } from './queries';

const t = messages.inspectionResultInsights.measurement;
type CalibrationFilter = '' | 'only' | 'exclude';

const measuredValue = (row: InspectionMeasurement): string => {
  if (row.numericValue !== undefined) return String(row.numericValue);
  if (row.textValue !== undefined) return row.textValue;
  if (row.booleanValue !== undefined) return row.booleanValue ? t.booleanTrue : t.booleanFalse;
  return t.unmeasured;
};

interface MeasurementSectionProps {
  inspectionResultId: number;
  /** 검사 항목 번호 → 이름(측정 요약에서). */
  itemNames: ReadonlyMap<number, string>;
  judgmentSource: LookupSource;
}

/**
 * 항목별 측정 결과 — 검사 결과 상세의 「검사 상세 및 이력」 탭 안에 측정치 표를 바로 둔다(사용자 시안 2026-11-02). 창을 따로
 * 열지 않고 검사 결과와 측정값을 이어 본다. 오른쪽 위 「교정 상태」로 측정 장비 교정 상태를 거른다. 판정은 합격 초록 · 불합격 빨강 표식.
 */
export const MeasurementSection = ({
  inspectionResultId,
  itemNames,
  judgmentSource,
}: MeasurementSectionProps) => {
  const [page, setPage] = useState(1);
  const [calibration, setCalibration] = useState<CalibrationFilter>('');
  const measurements = useInspectionMeasurements(inspectionResultId, page, calibration);
  const totalPages = Math.max(
    1,
    Math.ceil((measurements.data?.page.total ?? 0) / (measurements.data?.page.size ?? 50)),
  );
  const columns: Column<InspectionMeasurement>[] = [
    {
      key: 'item',
      header: t.columns.item,
      render: (row) => itemNames.get(row.inspectionItemSpecId) ?? t.itemNameUnknown,
    },
    { key: 'sampleNo', header: t.columns.sampleNo, align: 'center' },
    { key: 'value', header: t.columns.value, align: 'end', render: measuredValue },
    {
      key: 'judgmentCode',
      header: t.columns.judgment,
      align: 'center',
      render: (row) => (
        <Chip
          variant="status"
          size="sm"
          status={
            row.judgmentCode === 'ACCEPTED'
              ? 'success'
              : row.judgmentCode === 'REJECTED'
                ? 'error'
                : 'warning'
          }
        >
          {lookupDisplayLabelWithInactive(judgmentSource, row.judgmentCode)}
        </Chip>
      ),
    },
    {
      key: 'measuredAt',
      header: t.columns.measuredAt,
      render: (row) => formatPlantDateTime(row.measuredAt) ?? row.measuredAt,
    },
    {
      key: 'calibration',
      header: t.columns.calibration,
      align: 'center',
      render: (row) =>
        row.calibrationExpiredAtMeasurement === true
          ? t.calibrationExpired
          : row.calibrationExpiredAtMeasurement === false
            ? t.calibrationNormal
            : t.unknown,
    },
  ];

  return (
    <section className="measurement-section" aria-label={t.sectionTitle}>
      <div className="measurement-section-tools">
        <span aria-hidden="true">{t.columns.calibration}</span>
        <Select
          aria-label={t.calibrationFilter}
          size="sm"
          value={calibration}
          options={[
            { value: '', label: t.all },
            { value: 'only', label: t.calibrationOnly },
            { value: 'exclude', label: t.calibrationExclude },
          ]}
          onChange={(value) => {
            setCalibration(value as CalibrationFilter);
            setPage(1);
          }}
        />
      </div>
      {(measurements.isPending || measurements.isPlaceholderData) && <SkeletonText lines={3} />}
      {measurements.isError && (
        <AlertBanner
          variant="error"
          title={t.failed}
          action={
            <Button variant="outlined" size="sm" onClick={() => void measurements.refetch()}>
              {t.retryOf(t.retryTarget)}
            </Button>
          }
        />
      )}
      {!measurements.isError &&
        !measurements.isPlaceholderData &&
        measurements.data !== undefined && (
          <>
            <ManagedTable
              storageKey="omf-mes:inspection-results:columns:measurements"
              className="result-detail-table"
              caption={t.caption}
              columns={columns}
              rows={[...measurements.data.items]}
              getRowId={(row) => String(row.inspectionMeasurementId)}
              empty={<p className="field-note">{t.empty}</p>}
            />
            {/* 쪽이 둘 이상일 때만 이동 단추. */}
            {totalPages > 1 && (
              <nav className="form-actions" aria-label={t.pagination}>
                <Button
                  variant="outlined"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  {t.previous}
                </Button>
                <span>{t.position(page, totalPages)}</span>
                <Button
                  variant="outlined"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  {t.next}
                </Button>
              </nav>
            )}
          </>
        )}
    </section>
  );
};
