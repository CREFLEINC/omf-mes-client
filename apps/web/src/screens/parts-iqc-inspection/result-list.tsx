import { Chip, EmptyState, Icon, IconButton, Table, type Column } from '@crefle/web-ui';
import type { InspectionLotForward, InspectionResultSummaryForward } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import { useFitColumns } from '../../patterns/column-fit';
import { useColumnOrder } from '../../patterns/column-grip-order';
import { useColumnWidths } from '../../patterns/column-resize';
import { formatQty } from '../../patterns/package-qty';
import { LotNo } from './lot-match-field';

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

  const baseColumns: Column<InspectionResultSummaryForward>[] = [
    { key: 'seq', header: t.columns.seq, width: '110px', render: (row) => t.seq(row.seqNo) },
    {
      key: 'judgment',
      header: t.columns.judgment,
      width: '160px',
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
      width: '110px',
      align: 'end',
      render: (row) => `${formatQty(row.inspectedQty)} ${uomCode}`,
    },
    {
      key: 'defects',
      header: t.columns.defects,
      width: '180px',
      render: (row) =>
        row.rejectedQty === 0 && row.defectNames.length === 0
          ? t.noDefects
          : [formatQty(row.rejectedQty), ...row.defectNames].join(' · '), // ui-check-ignore: C-13 설계 확정 표기 「불량 · 유형」(screens/W-01-01.md)
    },
    {
      key: 'matched',
      header: t.columns.matched,
      width: '300px',
      render: (row) =>
        row.matchedLotIds.length === 0 ? (
          <span className="parts-iqc-muted">{t.noMatch}</span>
        ) : (
          /* LOT 번호 전체를 줄마다(끝 마디만 굵게) — 끝 마디만 칩으로 보이지 않는다(사용자 지시 2026-11-19 · omf-all-around#296). */
          <span className="iqc-inbound-attach-lots">
            {row.matchedLotIds.map((lotId) => (
              <LotNo key={lotId} lotNo={lotNoOf(lotId)} />
            ))}
          </span>
        ),
    },
    {
      key: 'inspector',
      header: t.columns.inspector,
      width: '110px',
      render: (row) => row.inspectorName ?? '—',
    },
    {
      key: 'actions',
      header: t.columns.actions,
      width: '100px',
      render: (row) =>
        locked ? (
          /* 「상태」 칸 — 확정된 결과는 라벨 하나(아이콘 없이 · 사용자 지시 2026-11-19 · omf-all-around#296). */
          <Chip size="sm">{t.lockedRow}</Chip>
        ) : (
          <span className="iqc-inbound-actions">
            {/* 수정 · 삭제는 아이콘 단추(사용자 지시 2026-11-16 · #274) — 이름은 마우스를 올리면 보인다. */}
            <IconButton
              icon="edit"
              size="sm"
              disabled={busy}
              title={t.edit}
              aria-label={`${t.seq(row.seqNo)} ${t.edit}`}
              onClick={() => onEdit(row)}
            />
            <IconButton
              icon="delete"
              size="sm"
              disabled={busy}
              title={t.remove}
              aria-label={`${t.seq(row.seqNo)} ${t.remove}`}
              onClick={() => onDelete(row)}
            />
          </span>
        ),
    },
  ];

  const ordered = useColumnOrder('omf-mes:iqc-inbound-results:columns:order', baseColumns);
  const resizable = useColumnWidths('omf-mes:iqc-inbound-results:columns', ordered);
  const fit = useFitColumns(resizable.columns, {});

  /* 결과가 없어도 첨부 파일 표처럼 머리줄을 두고 안내는 표 안에(사용자 지시 2026-11-19 · omf-all-around#296). */
  return (
    <div ref={fit.ref} className="inspection-queue-table iqc-inbound-table" style={resizable.style}>
      <Table
        density="compact"
        columns={fit.columns}
        rows={[...results].sort((a, b) => a.seqNo - b.seqNo)}
        getRowId={(row) => String(row.inspectionResultId)}
        aria-label={t.heading(results.length)}
        empty={
          /* 빈 표 안내는 목록과 같은 모양(아이콘 + 글)으로(사용자 지시 2026-11-19 · omf-all-around#296). */
          <EmptyState
            size="sm"
            icon={
              <span className="inspection-standard-empty-icon">
                <Icon name="assignment" size={20} />
              </span>
            }
            title={t.empty}
          />
        }
      />
    </div>
  );
};
