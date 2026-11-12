import { Button, Chip, Icon, Table, type Column } from '@crefle/web-ui';
import type { InspectionLotForward, InspectionResultSummaryForward } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import { formatQty } from '../../patterns/package-qty';

const t = messages.iqcInboundLot.results;
const judgmentLabel = messages.partsIqcInspection.judgment as Record<string, string | undefined>;

/** 판정 칩 색 — 불합격 · 보류 · 합격. */
export const judgmentStatus = (code: string | null): 'error' | 'warning' | 'success' | 'idle' =>
  code === 'REJECTED'
    ? 'error'
    : code === 'HELD'
      ? 'warning'
      : code === 'ACCEPTED'
        ? 'success'
        : 'idle';

export const judgmentText = (code: string | null): string =>
  code === null ? t.noJudgment : (judgmentLabel[code] ?? code);

/** LOT 번호 끝 마디 — 매칭 칩(「0001」). */
export const lotTail = (lotNo: string): string => lotNo.split('|').at(-1) ?? lotNo;

export interface ResultListProps {
  results: readonly InspectionResultSummaryForward[];
  lots: readonly InspectionLotForward[];
  uomCode: string;
  /** 판정 확정됨 — 행 끝 「확정됨」, 고치기 · 지우기 없음. */
  locked: boolean;
  busy: boolean;
  onEdit: (result: InspectionResultSummaryForward) => void;
  onDelete: (result: InspectionResultSummaryForward) => void;
}

/**
 * 검사 결과 표(screens/W-01-01.md 「결과 표」 · US3-1~3-4) — 순번 · 판정 · 검사 수량 · 불량 · 매칭 · 검사자 · [수정][삭제].
 * 순번은 서버가 매긴 것 그대로(지운 순번은 다시 쓰지 않는다).
 */
export const ResultList = ({
  results,
  lots,
  uomCode,
  locked,
  busy,
  onEdit,
  onDelete,
}: ResultListProps) => {
  const lotNoOf = (lotId: number): string =>
    lots.find((lot) => lot.lotId === lotId)?.lotNo ?? String(lotId);

  const columns: Column<InspectionResultSummaryForward>[] = [
    { key: 'seq', header: t.columns.seq, render: (row) => t.seq(row.seqNo) },
    {
      key: 'judgment',
      header: t.columns.judgment,
      render: (row) => {
        const reason = row.reinspectionReasonName ?? row.reinspectionReasonCode ?? null;

        return (
          <span className="iqc-inbound-judgment-cell">
            <Chip size="sm" status={judgmentStatus(row.overallJudgmentCode)}>
              {judgmentText(row.overallJudgmentCode)}
            </Chip>
            {/* 불합격 · 보류를 덮은 결과의 재검 사유(FR-023a · 2026-11-12). */}
            {reason === null ? null : <span className="parts-iqc-muted">{t.reason(reason)}</span>}
          </span>
        );
      },
    },
    {
      key: 'inspectedQty',
      header: t.columns.inspectedQty,
      align: 'end',
      render: (row) => `${formatQty(row.inspectedQty)} ${uomCode}`,
    },
    {
      key: 'defects',
      header: t.columns.defects,
      render: (row) =>
        row.rejectedQty === 0 && row.defectNames.length === 0
          ? '—'
          : [formatQty(row.rejectedQty), ...row.defectNames].join(' · '), // ui-check-ignore: C-13 설계 확정 표기 「불량 · 유형」(screens/W-01-01.md)
    },
    {
      key: 'matched',
      header: t.columns.matched,
      render: (row) =>
        row.matchedLotIds.length === 0 ? (
          <span className="parts-iqc-muted">{t.noMatch}</span>
        ) : (
          <span className="iqc-inbound-chips">
            {row.matchedLotIds.map((lotId) => (
              <Chip key={lotId} size="sm" title={lotNoOf(lotId)}>
                {lotTail(lotNoOf(lotId))}
              </Chip>
            ))}
          </span>
        ),
    },
    { key: 'inspector', header: t.columns.inspector, render: (row) => row.inspectorName ?? '—' },
    {
      key: 'actions',
      header: t.columns.actions,
      render: (row) =>
        locked ? (
          <span className="parts-iqc-muted iqc-inbound-locked">
            <Icon name="lock" size={14} aria-hidden />
            {t.lockedRow}
          </span>
        ) : (
          <span className="iqc-inbound-actions">
            <Button
              variant="outlined"
              size="sm"
              disabled={busy}
              aria-label={`${t.seq(row.seqNo)} ${t.edit}`}
              onClick={() => onEdit(row)}
            >
              {t.edit}
            </Button>
            <Button
              variant="text"
              size="sm"
              disabled={busy}
              aria-label={`${t.seq(row.seqNo)} ${t.remove}`}
              onClick={() => onDelete(row)}
            >
              {t.remove}
            </Button>
          </span>
        ),
    },
  ];

  return results.length === 0 ? (
    <p className="field-note">{t.empty}</p>
  ) : (
    <div className="wide-table iqc-inbound-table">
      <Table
        density="compact"
        columns={columns}
        rows={[...results].sort((a, b) => a.seqNo - b.seqNo)}
        getRowId={(row) => String(row.inspectionResultId)}
        aria-label={t.heading(results.length)}
      />
    </div>
  );
};
