import { AlertBanner, Button, Chip, type Column, EmptyState, SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { lookupDisplayLabelWithInactive } from '../../patterns/lookup-display';
import { ManagedTable } from '../../patterns/managed-table';
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
export const DefectReasonSection = ({
  inspectionResultId,
  uomCode = null,
}: {
  inspectionResultId: number;
  /** 불량 수량 뒤에 붙일 단위 — 그 검사 결과의 단위다. */
  uomCode?: string | null;
}) => {
  const reasons = useResultDefectReasons(inspectionResultId);
  const columns: Column<DefectReasonRow>[] = [
    {
      key: 'defectCode',
      header: t.defects.columns.defectCode,
      /* 이름을 앞에, 코드는 보조 글자로 — 「치수 불량 (OQC-DIM)」(사용자 2026-11-02). */
      render: (row) =>
        row.defectName === null ? (
          row.defectCodeLabel
        ) : (
          <>
            {row.defectName}
            <span className="result-detail-sub">({row.defectCode})</span>
          </>
        ),
    },
    {
      key: 'qty',
      header: t.defects.columns.qty,
      align: 'end',
      render: (row) => (uomCode === null ? number(row.qty) : `${number(row.qty)} ${uomCode}`),
    },
    /* 추정 원인 · 설명은 적힌 줄이 있을 때만 열을 둔다 — 비면 불량 유형 · 수량 두 열(사용자 시안 2026-11-02). */
    ...((reasons.data ?? []).some((row) => row.causeLabel !== null && row.causeLabel !== undefined)
      ? [
          {
            key: 'cause',
            header: t.defects.columns.cause,
            render: (row: DefectReasonRow) => row.causeLabel ?? EMPTY,
          },
        ]
      : []),
    ...((reasons.data ?? []).some(
      (row) => row.description !== null && row.description !== undefined,
    )
      ? [
          {
            key: 'description',
            header: t.defects.columns.description,
            render: (row: DefectReasonRow) => row.description ?? EMPTY,
          },
        ]
      : []),
  ];

  return (
    <section aria-labelledby="result-defects-title" className="result-detail-section">
      <div className="result-detail-section-head">
        <h3 id="result-defects-title">{t.defects.title}</h3>
      </div>
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
        <ManagedTable
          storageKey="omf-mes:inspection-results:columns:defects"
          className="result-detail-table"
          caption={t.defects.caption}
          columns={columns}
          rows={reasons.data}
          getRowId={(row) => String(row.defectRecordId)}
          empty={<EmptyState size="sm" title={t.defects.empty} />}
        />
      )}
    </section>
  );
};

const DecisionTable = ({
  rejection,
  uomCode,
}: {
  rejection: LotRejection;
  uomCode: string | null;
}) => {
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
      render: (row) =>
        uomCode === null ? number(row.decisionQty) : `${number(row.decisionQty)} ${uomCode}`,
    },
    {
      key: 'decidedAt',
      header: t.rejections.columns.decidedAt,
      render: (row) => dateTime(row.decidedAt),
    },
    { key: 'reason', header: t.rejections.columns.reason, render: (row) => row.reason },
  ];

  return (
    <ManagedTable
      storageKey="omf-mes:inspection-results:columns:rejections"
      className="result-detail-table"
      caption={t.rejections.caption(rejection.nonconformance.nonconformanceNo)}
      columns={columns}
      rows={rejection.decisions}
      getRowId={(row) => String(row.dispositionDecisionId)}
      empty={<EmptyState size="sm" title={t.rejections.decisionsEmpty} />}
    />
  );
};

/** 그 LOT 의 부적합마다 처분 판정 이력. LOT 이 없는 검사(PQC 등)는 그렇다고 말한다. */
export const RejectionSection = ({
  lotId,
  uomCode = null,
}: {
  lotId: number | null;
  uomCode?: string | null;
}) => {
  const rejections = useLotRejections(lotId);
  const statuses = useNonconformanceStatusLookup();
  /* 진행 상태 표식 — 판정 대기만 주황, 그 밖은 무채색(빨강은 불합격에만 · 사용자 2026-11-02). */
  const statusChip = (statusCode: string) => (
    <Chip
      variant="status"
      status={statusCode === 'PENDING_DECISION' ? 'warning' : 'idle'}
      size="sm"
    >
      {statusCode === 'PENDING_DECISION'
        ? t.rejections.pendingStatus
        : lookupDisplayLabelWithInactive(statuses, statusCode)}
    </Chip>
  );

  return (
    <section aria-labelledby="result-rejections-title" className="result-detail-section">
      {/* 부적합이 하나면 그 진행 상태 표식을 제목 줄 오른쪽에(시안), 여럿이면 건마다 둔다. */}
      <div className="result-detail-section-head">
        <h3 id="result-rejections-title">{t.rejections.title}</h3>
        {rejections.data?.length === 1 && statusChip(rejections.data[0]!.nonconformance.statusCode)}
      </div>
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
          /*
           * 부적합마다 진행 상태 표식(오른쪽) · 판정 대기면 한 줄 설명 · 부적합번호 | 발생일시(사용자 시안 2026-11-02).
           * 처분 판정이 있으면 그 표를 잇는다. 빨강은 불합격에만 쓴다 — 판정 대기는 주황, 그 밖은 기본색.
           */
          rejections.data.map((rejection) => {
            return (
              <div key={rejection.nonconformance.nonconformanceId} className="result-detail-nc">
                {/* 판정 대기 설명 줄은 표식(처분 판정 대기)과 같은 뜻이라 뺐다(사용자 2026-11-02). */}
                {rejections.data.length > 1 && (
                  <div className="result-detail-nc-head">
                    {statusChip(rejection.nonconformance.statusCode)}
                  </div>
                )}
                {/* 이름표 칸 — 창 머리와 같은 모양(사용자 2026-11-02). */}
                <dl className="inspection-standard-facts-line">
                  <div>
                    <dt className="field-label">{t.rejections.numberLabel}</dt>
                    <dd>{rejection.nonconformance.nonconformanceNo}</dd>
                  </div>
                  <div>
                    <dt className="field-label">{t.rejections.openedAtLabel}</dt>
                    <dd>{dateTime(rejection.nonconformance.openedAt)}</dd>
                  </div>
                </dl>
                {rejection.decisions.length > 0 && (
                  <DecisionTable rejection={rejection} uomCode={uomCode} />
                )}
              </div>
            );
          })
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
  return (
    <LotTimeline
      lotId={lotId}
      statusOptions={statusOptions}
      embedded
      columnLabels={t.historyColumns}
    />
  );
};
