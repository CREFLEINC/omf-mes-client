import { Chip, Icon, IconButton, Table, type Column } from '@crefle/web-ui';
import type { InspectionLotForward, InspectionResultSummaryForward } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import { formatQty } from '../../patterns/package-qty';
import { formatPlantDateTime } from '../../patterns/plant-time';

const t = messages.iqcInboundLot.results;

/**
 * 결과 표의 문구 — 기본은 IQC(자재 관리 LOT). 출하 OQC(피처 010 · W-04-03)는 자기 문구(피킹 LOT)를 넘긴다.
 * 판정 이름(`judgmentText`)은 두 화면이 같은 공통코드라 따로 받지 않는다.
 */
export interface ResultListText {
  columns: {
    seq: string;
    judgment: string;
    inspectedQty?: string;
    defects?: string;
    matched: string;
    inspector: string;
    inspectedAt?: string;
    actions: string;
  };
  seq: (seqNo: number) => string;
  noMatch: string;
  edit: string;
  remove: string;
  lockedRow: string;
  empty: string;
  heading: (count: number) => string;
  reason: (name: string) => string;
}
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
  /** 문구 — 기본은 IQC. */
  text?: ResultListText;
  /** 검사 수량 · 불량 칸 — 출하 OQC 는 판정만 남겨 칸이 없다(피처 010). 기본 보인다. */
  showQuantities?: boolean;
  /** 검사 일시 칸 — 출하 OQC 가 보인다. 기본 없음. */
  showInspectedAt?: boolean;
  /** [삭제] — 출하 OQC 결과는 서버가 지우지 않는다(피처 010). 기본 보인다. */
  canDelete?: boolean;
  /** 매칭 칩을 흐리게 그릴 LOT(교체된 피킹 LOT · 피처 010). */
  inactiveLotIds?: readonly number[];
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
  text = t,
  showQuantities = true,
  showInspectedAt = false,
  canDelete = true,
  inactiveLotIds = [],
}: ResultListProps) => {
  const lotNoOf = (lotId: number): string =>
    lots.find((lot) => lot.lotId === lotId)?.lotNo ?? String(lotId);

  const quantityColumns: Column<InspectionResultSummaryForward>[] = [
    {
      key: 'inspectedQty',
      header: text.columns.inspectedQty ?? '',
      align: 'end',
      render: (row) => `${formatQty(row.inspectedQty)} ${uomCode}`,
    },
    {
      key: 'defects',
      header: text.columns.defects ?? '',
      render: (row) =>
        row.rejectedQty === 0 && row.defectNames.length === 0
          ? t.noDefects
          : [formatQty(row.rejectedQty), ...row.defectNames].join(' · '), // ui-check-ignore: C-13 설계 확정 표기 「불량 · 유형」(screens/W-01-01.md)
    },
  ];

  const columns: Column<InspectionResultSummaryForward>[] = [
    { key: 'seq', header: text.columns.seq, render: (row) => text.seq(row.seqNo) },
    {
      key: 'judgment',
      header: text.columns.judgment,
      render: (row) => {
        const reason = row.reinspectionReasonName ?? row.reinspectionReasonCode ?? null;

        return (
          <span className="iqc-inbound-judgment-cell">
            <Chip size="sm" status={judgmentStatus(row.overallJudgmentCode)}>
              {judgmentText(row.overallJudgmentCode)}
            </Chip>
            {/* 불합격 · 보류를 덮은 결과의 재검 사유(FR-023a · 2026-11-12). */}
            {reason === null ? null : (
              <span className="parts-iqc-muted">{text.reason(reason)}</span>
            )}
          </span>
        );
      },
    },
    ...(showQuantities ? quantityColumns : []),
    {
      key: 'matched',
      header: text.columns.matched,
      render: (row) =>
        row.matchedLotIds.length === 0 ? (
          <span className="parts-iqc-muted">{text.noMatch}</span>
        ) : (
          <span className="iqc-inbound-chips">
            {row.matchedLotIds.map((lotId) => (
              <Chip
                key={lotId}
                size="sm"
                title={lotNoOf(lotId)}
                /* 교체로 빠진 피킹 LOT 은 흐린 칩(피처 010 · 시안 W0403-After D). */
                className={inactiveLotIds.includes(lotId) ? 'iqc-inbound-chip-inactive' : undefined}
              >
                {lotTail(lotNoOf(lotId))}
              </Chip>
            ))}
          </span>
        ),
    },
    {
      key: 'inspector',
      header: text.columns.inspector,
      render: (row) => row.inspectorName ?? '—',
    },
    ...(showInspectedAt
      ? [
          {
            key: 'inspectedAt',
            header: text.columns.inspectedAt ?? '',
            render: (row: InspectionResultSummaryForward) =>
              formatPlantDateTime(row.inspectedAt) ?? row.inspectedAt,
          },
        ]
      : []),
    {
      key: 'actions',
      header: text.columns.actions,
      render: (row) =>
        locked ? (
          <span className="parts-iqc-muted iqc-inbound-locked">
            <Icon name="lock" size={14} aria-hidden />
            {text.lockedRow}
          </span>
        ) : (
          <span className="iqc-inbound-actions">
            {/* 수정 · 삭제는 아이콘 단추(사용자 지시 2026-11-16 · #274) — 이름은 마우스를 올리면 보인다. */}
            <IconButton
              icon="edit"
              size="sm"
              disabled={busy}
              title={text.edit}
              aria-label={`${text.seq(row.seqNo)} ${text.edit}`}
              onClick={() => onEdit(row)}
            />
            {canDelete ? (
              <IconButton
                icon="delete"
                size="sm"
                disabled={busy}
                title={text.remove}
                aria-label={`${text.seq(row.seqNo)} ${text.remove}`}
                onClick={() => onDelete(row)}
              />
            ) : null}
          </span>
        ),
    },
  ];

  return results.length === 0 ? (
    <p className="field-note">{text.empty}</p>
  ) : (
    <div className="wide-table iqc-inbound-table">
      <Table
        density="compact"
        columns={columns}
        rows={[...results].sort((a, b) => a.seqNo - b.seqNo)}
        getRowId={(row) => String(row.inspectionResultId)}
        aria-label={text.heading(results.length)}
      />
    </div>
  );
};
