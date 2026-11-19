import { Chip, EmptyState, Icon, IconButton, Table, type Column } from '@crefle/web-ui';
import type { InspectionLotForward, InspectionResultSummaryForward } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import { useFitColumns } from '../../patterns/column-fit';
import { useColumnOrder } from '../../patterns/column-grip-order';
import { useColumnWidths } from '../../patterns/column-resize';
import { formatQty } from '../../patterns/package-qty';
import { formatPlantDateTime } from '../../patterns/plant-time';
import { LotNo } from './lot-match-field';

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
    confirmedAt?: string;
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
  /** 이 의뢰의 판정 확정 일시 — 확정된 결과 줄의 「확정 일시」(omf-all-around#296). 확정 전은 `null`. */
  confirmedAt: string | null;
  busy: boolean;
  onEdit: (result: InspectionResultSummaryForward) => void;
  onDelete: (result: InspectionResultSummaryForward) => void;
  /** 문구 — 기본은 IQC. */
  text?: ResultListText;
  /** 검사 수량 · 불량 칸 — 출하 OQC 는 판정만 남겨 칸이 없다(피처 010). 기본 보인다. */
  showQuantities?: boolean;
  /** 확정 일시 칸 — 출하 OQC 는 숨기고 검사 일시를 보인다(피처 010). 기본 보인다. */
  showConfirmedAt?: boolean;
  /** 검사 일시 칸 — 출하 OQC 가 보인다. 기본 없음. */
  showInspectedAt?: boolean;
  /** [삭제] — 출하 OQC 결과는 서버가 지우지 않는다(피처 010). 기본 보인다. */
  canDelete?: boolean;
  /** 매칭 LOT 을 흐리게 그릴 것(교체로 빠진 피킹 LOT · 피처 010). */
  inactiveLotIds?: readonly number[];
  /** 칸 순서 · 폭 저장 키 — 화면마다 따로(출하 OQC 는 자기 키 · 피처 010). */
  columnsStorageKey?: string;
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
  confirmedAt,
  busy,
  onEdit,
  onDelete,
  text = t,
  showQuantities = true,
  showConfirmedAt = true,
  showInspectedAt = false,
  canDelete = true,
  inactiveLotIds = [],
  columnsStorageKey = 'omf-mes:iqc-inbound-results:columns',
}: ResultListProps) => {
  const lotNoOf = (lotId: number): string =>
    lots.find((lot) => lot.lotId === lotId)?.lotNo ?? String(lotId);

  const baseColumns: Column<InspectionResultSummaryForward>[] = [
    {
      key: 'seq',
      align: 'center',
      header: text.columns.seq,
      width: '110px',
      render: (row) => text.seq(row.seqNo),
    },
    {
      key: 'judgment',
      align: 'center',
      header: text.columns.judgment,
      width: '160px',
      render: (row) => {
        const reason = row.reinspectionReasonName ?? row.reinspectionReasonCode ?? null;

        return (
          <span className="iqc-inbound-judgment-cell">
            <Chip size="sm" status={judgmentStatus(row.overallJudgmentCode)}>
              {judgmentText(row.overallJudgmentCode)}
            </Chip>
            {/* 불합격 · 보류를 덮은 결과의 재검 사유(FR-023a · 2026-11-12). */}
            {reason === null ? null : <span className="parts-iqc-muted">{text.reason(reason)}</span>}
          </span>
        );
      },
    },
    {
      key: 'inspectedQty',
      header: text.columns.inspectedQty ?? '',
      width: '110px',
      align: 'center',
      render: (row) => `${formatQty(row.inspectedQty)} ${uomCode}`,
    },
    {
      key: 'defects',
      align: 'center',
      header: text.columns.defects ?? '',
      width: '180px',
      render: (row) =>
        row.rejectedQty === 0 && row.defectNames.length === 0
          ? t.noDefects
          : [formatQty(row.rejectedQty), ...row.defectNames].join(' · '), // ui-check-ignore: C-13 설계 확정 표기 「불량 · 유형」(screens/W-01-01.md)
    },
    {
      key: 'matched',
      align: 'center',
      header: text.columns.matched,
      width: '300px',
      render: (row) =>
        row.matchedLotIds.length === 0 ? (
          <span className="parts-iqc-muted">{text.noMatch}</span>
        ) : (
          /* LOT 번호 전체를 줄마다(끝 마디만 굵게) — 끝 마디만 칩으로 보이지 않는다(사용자 지시 2026-11-19 · omf-all-around#296). */
          <span className="iqc-inbound-attach-lots">
            {row.matchedLotIds.map((lotId) =>
              /* 교체로 빠진 피킹 LOT 은 흐리게(피처 010) — 번호는 IQC 와 같이 전체로. */
              inactiveLotIds.includes(lotId) ? (
                <span key={lotId} className="iqc-inbound-lot-inactive">
                  <LotNo lotNo={lotNoOf(lotId)} />
                </span>
              ) : (
                <LotNo key={lotId} lotNo={lotNoOf(lotId)} />
              ),
            )}
          </span>
        ),
    },
    {
      key: 'inspector',
      align: 'center',
      header: text.columns.inspector,
      width: '110px',
      render: (row) => row.inspectorName ?? '—',
    },
    {
      key: 'confirmedAt',
      align: 'center',
      header: text.columns.confirmedAt ?? '',
      width: '150px',
      render: (row) =>
        row.statusCode === 'CONFIRMED' && confirmedAt !== null
          ? (formatPlantDateTime(confirmedAt) ?? '-')
          : '-',
    },
    {
      key: 'inspectedAt',
      align: 'center',
      header: text.columns.inspectedAt ?? '',
      width: '150px',
      render: (row) => formatPlantDateTime(row.inspectedAt) ?? row.inspectedAt,
    },
    {
      key: 'actions',
      align: 'center',
      header: text.columns.actions,
      width: '100px',
      render: (row) =>
        locked ? (
          /* 「상태」 칸 — 확정된 결과는 라벨 하나(아이콘 없이 · 사용자 지시 2026-11-19 · omf-all-around#296). */
          <Chip size="sm">{text.lockedRow}</Chip>
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

  /* 화면마다 다른 칸은 빼고 순서 · 폭을 잡는다(피처 010 — 출하 OQC 는 수량 · 불량 · 확정 일시 없이 검사 일시). */
  const hidden = new Set<string>([
    ...(showQuantities ? [] : ['inspectedQty', 'defects']),
    ...(showConfirmedAt ? [] : ['confirmedAt']),
    ...(showInspectedAt ? [] : ['inspectedAt']),
  ]);
  const shown = baseColumns.filter((column) => !hidden.has(String(column.key)));
  const ordered = useColumnOrder(`${columnsStorageKey}:order`, shown);
  const resizable = useColumnWidths(columnsStorageKey, ordered);
  const fit = useFitColumns(resizable.columns, { scrollX: true });

  /* 결과가 없어도 첨부 파일 표처럼 머리줄을 두고 안내는 표 안에(사용자 지시 2026-11-19 · omf-all-around#296). */
  return (
    <div ref={fit.ref} className="inspection-queue-table iqc-inbound-table" style={resizable.style}>
      <Table
        density="compact"
        columns={fit.columns}
        rows={[...results].sort((a, b) => a.seqNo - b.seqNo)}
        getRowId={(row) => String(row.inspectionResultId)}
        aria-label={text.heading(results.length)}
        empty={
          /* 빈 표 안내는 목록과 같은 모양(아이콘 + 글)으로(사용자 지시 2026-11-19 · omf-all-around#296). */
          <EmptyState
            size="sm"
            icon={
              <span className="inspection-standard-empty-icon">
                <Icon name="assignment" size={20} />
              </span>
            }
            title={text.empty}
          />
        }
      />
    </div>
  );
};
