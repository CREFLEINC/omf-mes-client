import {
  AlertBanner,
  Button,
  type Column,
  EmptyState,
  Select,
  SkeletonText,
  Table,
} from '@crefle/web-ui';

import {
  useInspectionMeasurements,
  useInspectionResultDetail,
  useMeasurementSummary,
  type InspectionMeasurement,
} from './queries';

type CalibrationFilter = '' | 'only' | 'exclude';
const EMPTY = '미확인';
const dateTime = (value: string): string => {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(value);
  return match === null ? value : `${match[1]} ${match[2]}`;
};
const measuredValue = (row: InspectionMeasurement): string => {
  if (row.numericValue !== undefined) return String(row.numericValue);
  if (row.textValue !== undefined) return row.textValue;
  if (row.booleanValue !== undefined) return row.booleanValue ? '예' : '아니오';
  return '미측정';
};

interface MeasurementPageProps {
  inspectionResultId: number;
  page: number;
  calibrationExpired: CalibrationFilter;
  judgmentLabels: ReadonlyMap<string, string>;
  onPageChange: (page: number) => void;
  onCalibrationChange: (value: CalibrationFilter) => void;
}

export const MeasurementPage = ({
  inspectionResultId,
  page,
  calibrationExpired,
  judgmentLabels,
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
      header: '항목',
      render: (row) => itemNames.get(row.inspectionItemSpecId) ?? '항목 이름 미확인',
    },
    { key: 'sampleNo', header: '시료 번호', align: 'end' },
    { key: 'value', header: '측정값', render: measuredValue },
    {
      key: 'judgmentCode',
      header: '판정',
      render: (row) => judgmentLabels.get(row.judgmentCode) ?? '판정 미확인',
    },
    { key: 'measuredAt', header: '측정시각', render: (row) => dateTime(row.measuredAt) },
    {
      key: 'calibration',
      header: '교정 상태',
      render: (row) =>
        row.calibrationExpiredAtMeasurement === true
          ? '검교정 만료'
          : row.calibrationExpiredAtMeasurement === false
            ? '정상'
            : EMPTY,
    },
  ];
  const retry = (
    <Button variant="outlined" size="sm" onClick={() => void measurements.refetch()}>
      다시 시도
    </Button>
  );
  const totalPages = Math.max(
    1,
    Math.ceil((measurements.data?.page.total ?? 0) / (measurements.data?.page.size ?? 50)),
  );

  return (
    <section aria-labelledby="measurement-page-title">
      <h2 id="measurement-page-title">측정치 전체 보기</h2>
      {detail.isPending && <SkeletonText lines={1} />}
      {!detail.isError && detail.data !== undefined && <p>{detail.data.inspectionResultNo}</p>}
      <Select
        aria-label="교정 상태 필터"
        value={calibrationExpired}
        options={[
          { value: '', label: '전체' },
          { value: 'only', label: '검교정 만료만' },
          { value: 'exclude', label: '검교정 만료 제외' },
        ]}
        onChange={(value) => onCalibrationChange(value as CalibrationFilter)}
      />
      {(measurements.isPending || measurements.isPlaceholderData) && (
        <div role="status" aria-label="측정치 페이지를 불러오는 중">
          <SkeletonText lines={3} />
        </div>
      )}
      {measurements.isError && (
        <AlertBanner variant="error" title="측정치를 불러오지 못했습니다." action={retry} />
      )}
      {!measurements.isError &&
        !measurements.isPlaceholderData &&
        measurements.data !== undefined && (
          <>
            <Table
              density="compact"
              caption="검사 측정치"
              columns={columns}
              rows={[...measurements.data.items]}
              getRowId={(row) => String(row.inspectionMeasurementId)}
              empty={<EmptyState size="sm" title="측정치가 없습니다" />}
            />
            <nav className="form-actions" aria-label="측정치 쪽 이동">
              <Button
                variant="outlined"
                disabled={page <= 1}
                onClick={() => onPageChange(page - 1)}
              >
                이전
              </Button>
              <span>
                {page} / {totalPages}
              </span>
              <Button
                variant="outlined"
                disabled={page >= totalPages}
                onClick={() => onPageChange(page + 1)}
              >
                다음
              </Button>
            </nav>
          </>
        )}
    </section>
  );
};
