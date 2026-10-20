import { AlertBanner, Button, type Column, EmptyState, SkeletonText, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { lookupDisplayLabelWithInactive } from '../../patterns/lookup-display';
import { formatPlantDateTime } from '../../patterns/plant-time';
import { LotTimeline } from '../lot-status-history/lot-timeline';
import { useLotStatusOptions } from '../lot-status-history/options';
import {
  useLotRejections,
  useResultDefectReasons,
  type DefectReasonRow,
  type LotRejection,
} from './history-queries';
import { useNonconformanceStatusLookup } from './lookups';

/*
 * IQC 이력 상세(omf-all-around#85) — 검사 결과 상세 창의 이력 구획 셋.
 * 불량 사유(그 회차) · 불합격 처리(그 LOT 의 부적합 → 처분 판정) · LOT 상태 이력(W-03-01 의 LOT 타임라인 그대로).
 */

const t = messages.inspectionResultInsights.detail;
const DISPOSITION_TYPES: Readonly<Record<string, string>> =
  messages.dispositionDecision.values.dispositionType;
const EMPTY = t.unknown;
const dateTime = (value: string): string => formatPlantDateTime(value) ?? value;
const number = (value: number): string => new Intl.NumberFormat('ko-KR').format(value);

const Retry = ({ label, onRetry }: { label: string; onRetry: () => void }) => (
  <Button aria-label={t.retryOf(label)} size="sm" variant="outlined" onClick={onRetry}>
    {t.retry}
  </Button>
);

/** 그 회차의 불량 기록 — 코드명·수량·추정 원인·설명. */
export const DefectReasonSection = ({ inspectionResultId }: { inspectionResultId: number }) => {
  const reasons = useResultDefectReasons(inspectionResultId);
  const columns: Column<DefectReasonRow>[] = [
    {
      key: 'defectCode',
      header: t.defects.columns.defectCode,
      render: (row) => row.defectCodeLabel,
    },
    { key: 'qty', header: t.defects.columns.qty, align: 'end', render: (row) => number(row.qty) },
    { key: 'cause', header: t.defects.columns.cause, render: (row) => row.causeLabel ?? EMPTY },
    {
      key: 'description',
      header: t.defects.columns.description,
      render: (row) => row.description ?? EMPTY,
    },
  ];

  return (
    <section aria-labelledby="result-defects-title">
      <h3 id="result-defects-title">{t.defects.title}</h3>
      {reasons.isPending && (
        <div role="status" aria-label={t.defects.loading}>
          <SkeletonText lines={2} />
        </div>
      )}
      {reasons.isError && (
        <AlertBanner
          variant="error"
          title={t.defects.failed}
          action={<Retry label={t.defects.retryTarget} onRetry={() => void reasons.refetch()} />}
        />
      )}
      {reasons.data !== undefined && (
        <div className="wide-table">
          <Table
            density="compact"
            caption={t.defects.caption}
            columns={columns}
            rows={reasons.data}
            getRowId={(row) => String(row.defectRecordId)}
            empty={<EmptyState size="sm" title={t.defects.empty} />}
          />
        </div>
      )}
    </section>
  );
};

const DecisionTable = ({ rejection }: { rejection: LotRejection }) => {
  const columns: Column<LotRejection['decisions'][number]>[] = [
    {
      key: 'dispositionType',
      header: t.rejections.columns.dispositionType,
      render: (row) => DISPOSITION_TYPES[row.dispositionTypeCode] ?? row.dispositionTypeCode,
    },
    {
      key: 'qty',
      header: t.rejections.columns.qty,
      align: 'end',
      render: (row) => number(row.decisionQty),
    },
    {
      key: 'decidedAt',
      header: t.rejections.columns.decidedAt,
      render: (row) => dateTime(row.decidedAt),
    },
    { key: 'reason', header: t.rejections.columns.reason, render: (row) => row.reason },
  ];

  return (
    <div className="wide-table">
      <Table
        density="compact"
        caption={t.rejections.caption(rejection.nonconformance.nonconformanceNo)}
        columns={columns}
        rows={rejection.decisions}
        getRowId={(row) => String(row.dispositionDecisionId)}
        empty={<EmptyState size="sm" title={t.rejections.decisionsEmpty} />}
      />
    </div>
  );
};

/** 그 LOT 의 부적합마다 처분 판정 이력. LOT 이 없는 검사(PQC 등)는 그렇다고 말한다. */
export const RejectionSection = ({ lotId }: { lotId: number | null }) => {
  const rejections = useLotRejections(lotId);
  const statuses = useNonconformanceStatusLookup();

  return (
    <section aria-labelledby="result-rejections-title">
      <h3 id="result-rejections-title">{t.rejections.title}</h3>
      {lotId === null && <p className="field-note">{t.rejections.noLot}</p>}
      {lotId !== null && rejections.isPending && (
        <div role="status" aria-label={t.rejections.loading}>
          <SkeletonText lines={2} />
        </div>
      )}
      {rejections.isError && (
        <AlertBanner
          variant="error"
          title={t.rejections.failed}
          action={
            <Retry label={t.rejections.retryTarget} onRetry={() => void rejections.refetch()} />
          }
        />
      )}
      {rejections.data !== undefined &&
        (rejections.data.length === 0 ? (
          <EmptyState size="sm" title={t.rejections.empty} />
        ) : (
          rejections.data.map((rejection) => (
            <div key={rejection.nonconformance.nonconformanceId}>
              <h4>
                {t.rejections.nonconformance(
                  rejection.nonconformance.nonconformanceNo,
                  lookupDisplayLabelWithInactive(statuses, rejection.nonconformance.statusCode),
                  dateTime(rejection.nonconformance.openedAt),
                )}
              </h4>
              <DecisionTable rejection={rejection} />
            </div>
          ))
        ))}
    </section>
  );
};

/** LOT 상태 이력 — W-03-01 LOT 상세의 타임라인(상태 변경·보류)을 그대로 쓴다. */
export const LotHistorySection = ({ lotId }: { lotId: number | null }) => {
  const statuses = useLotStatusOptions();
  if (lotId === null) return <p className="field-note">{t.lotHistoryNoLot}</p>;
  const statusOptions =
    statuses.data?.items.map((item) => ({ value: item.code, label: item.label })) ?? [];
  return <LotTimeline lotId={lotId} statusOptions={statusOptions} />;
};
