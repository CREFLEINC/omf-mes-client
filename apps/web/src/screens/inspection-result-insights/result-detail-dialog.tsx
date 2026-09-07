import { AlertBanner, Button, Dialog, EmptyState, SkeletonText } from '@crefle/web-ui';

import { lookupDisplayLabelWithInactive } from '../../patterns/lookup-display';
import {
  useInspectionRequestDetail,
  useInspectionResultDetail,
  useMeasurementSummary,
  type MeasurementItemSummary,
} from './queries';
import type { ResultLabels } from './result-overview';

const EMPTY = '미확인';
/* 기준 미등록은 「없는 값」이다 — 「모르는 값」(EMPTY)과 같은 모양으로 그리지 않는다(공유계약 G-9 · client#589). */
const NO_PLAN_VERSION = '기준 없음';
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
      <p>{item.specText ?? '규격 미확인'}</p>
      <p>
        측정 {count(item.measuredCount)}건 · 합격 {count(item.acceptedCount)}건 · 불합격{' '}
        {count(item.rejectedCount)}건 · 미측정 {count(item.unmeasuredCount)}건
      </p>
      {(outOfSpecValues.length > 0 || remaining > 0) && (
        <p>
          일부 예시: {outOfSpecValues.join(', ')}
          {remaining > 0
            ? `${outOfSpecValues.length > 0 ? ' · ' : ''}외 ${String(remaining)}건`
            : ''}
        </p>
      )}
      <p>측정 장비 {item.equipmentName ?? EMPTY}</p>
      {item.equipmentCalibrationExpired === true && (
        <AlertBanner variant="warning">
          검교정 만료
          {item.equipmentCalibrationDueDate === null ||
          item.equipmentCalibrationDueDate === undefined
            ? ''
            : ` · 예정일 ${item.equipmentCalibrationDueDate}`}
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
      aria-label={`${label} 다시 시도`}
      size="sm"
      variant="outlined"
      onClick={() => void refetch()}
    >
      다시 시도
    </Button>
  );
  const fields =
    detail.data === undefined
      ? []
      : [
          ['의뢰번호', detail.data.inspectionRequestNo ?? EMPTY],
          ['기준 버전', planVersion],
          ['품목', lookupDisplayLabelWithInactive(labels.item, detail.data.itemId)],
          ['LOT', detail.data.lotNo ?? EMPTY],
          ['공정', detail.data.processName ?? EMPTY],
          [
            '검사/합격/불합격/보류',
            `${detail.data.inspectedQty} / ${detail.data.acceptedQty} / ${detail.data.rejectedQty} / ${detail.data.heldQty}`,
          ],
          [
            '종합판정',
            lookupDisplayLabelWithInactive(labels.judgment, detail.data.overallJudgmentCode),
          ],
          [
            '검사시각/회차',
            `${dateTime(detail.data.inspectedAt)} / ${detail.data.inspectionRound}회`,
          ],
        ];

  return (
    <Dialog
      open
      size="lg"
      title="검사 결과 상세"
      onClose={onClose}
      footer={
        <>
          <Button variant="outlined" onClick={onClose}>
            닫기
          </Button>
          <Button onClick={() => onViewMeasurements(inspectionResultId)}>측정치 전체 보기</Button>
        </>
      }
    >
      {detail.isPending && <SkeletonText lines={3} />}
      {detail.isError && (
        <AlertBanner
          variant="error"
          title="검사 상세를 불러오지 못했습니다."
          action={retry('검사 상세', detail.refetch)}
        />
      )}
      {!detail.isError && detail.data !== undefined && (
        <dl className="filter-bar" aria-label="검사 결과 속성">
          {fields.map(([label, value]) => (
            <div className="field-cell" key={label}>
              <dt className="field-label">{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}
      <h3>항목별 측정 요약</h3>
      {summary.isPending && <SkeletonText lines={3} />}
      {summary.isError && (
        <AlertBanner
          variant="error"
          title="측정 요약을 불러오지 못했습니다."
          action={retry('측정 요약', summary.refetch)}
        />
      )}
      {!summary.isError &&
        summary.data !== undefined &&
        (summary.data.items.length === 0 ? (
          <EmptyState size="sm" title="측정 요약이 없습니다" />
        ) : (
          <ul>
            {summary.data.items.map((item) => (
              <MeasurementSummaryRow key={item.inspectionItemSpecId} item={item} />
            ))}
          </ul>
        ))}
      {!summary.isError && summary.data !== undefined && (
        <p className="field-note">기준 {dateTime(summary.data.asOf)}</p>
      )}
    </Dialog>
  );
};
