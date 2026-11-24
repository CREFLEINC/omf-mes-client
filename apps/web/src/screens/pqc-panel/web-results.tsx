import { Button, Chip, EmptyState, Icon, IconButton, Table, type Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { useFitColumns } from '../../patterns/column-fit';
import { useColumnOrder } from '../../patterns/column-grip-order';
import { useColumnWidths } from '../../patterns/column-resize';
import { formatQty } from '../../patterns/package-qty';
import { formatPlantDateTime } from '../../patterns/plant-time';
import { judgmentStatus, judgmentText } from '../parts-iqc-inspection/result-list';
import { RESULT_STATUS } from '../pqc-inspection/queries';
import type { InspectionResultResponse } from './queries';

const t = messages.pqcInspectionRegister.web.results;

export interface PqcWebResultsProps {
  rounds: readonly InspectionResultResponse[];
  uomCode: string | null;
  /** 의뢰가 판정 확정됨 — [검사 결과 추가]를 감추고 줄마다 「확정」. */
  confirmed: boolean;
  /** [검사 결과 추가]를 잠근 까닭(작성중 결과 · 실적 없음 · 읽는 중). 열 수 있으면 `null`. */
  addBlockedReason: string | null;
  /** [수정]을 잠근다(실적 없음 · 읽는 중 · 보내는 중). */
  editDisabled: boolean;
  onAdd: () => void;
  onEdit: (round: InspectionResultResponse) => void;
}

/**
 * W-03-11 관리웹 「검사 결과」(omf-all-around#356) — IQC 상세의 결과 표와 같은 짜임. 회차 · 판정 · 수량 넷 · 검사일시 ·
 * 검사자 · [수정]. ⛔ [삭제]는 없다 — 서버가 PQC 결과를 지우지 않는다(`DELETE` 는 입하 LOT IQC 만 · iqc-result-delete.ts).
 * 작성중 결과는 의뢰마다 하나라(서버 장부 P-49) 그것이 있으면 추가 대신 [수정]이다.
 */
export const PqcWebResults = ({
  rounds,
  uomCode,
  confirmed,
  addBlockedReason,
  editDisabled,
  onAdd,
  onEdit,
}: PqcWebResultsProps) => {
  const qty = (value: number): string =>
    uomCode === null ? formatQty(value) : `${formatQty(value)} ${uomCode}`;

  const baseColumns: Column<InspectionResultResponse>[] = [
    {
      key: 'round',
      align: 'center',
      header: t.columns.round,
      width: '100px',
      render: (row) => t.round(row.inspectionRound),
    },
    {
      key: 'judgment',
      align: 'center',
      header: t.columns.judgment,
      width: '110px',
      render: (row) => (
        <Chip size="sm" status={judgmentStatus(row.overallJudgmentCode ?? null)}>
          {judgmentText(row.overallJudgmentCode ?? null)}
        </Chip>
      ),
    },
    {
      key: 'inspectedQty',
      align: 'center',
      header: t.columns.inspectedQty,
      width: '100px',
      render: (row) => qty(row.inspectedQty),
    },
    {
      key: 'accepted',
      align: 'center',
      header: t.columns.accepted,
      width: '100px',
      render: (row) => qty(row.acceptedQty),
    },
    {
      key: 'rejected',
      align: 'center',
      header: t.columns.rejected,
      width: '100px',
      render: (row) => qty(row.rejectedQty),
    },
    {
      key: 'held',
      align: 'center',
      header: t.columns.held,
      width: '100px',
      render: (row) => qty(row.heldQty),
    },
    {
      key: 'inspectedAt',
      align: 'center',
      header: t.columns.inspectedAt,
      width: '150px',
      render: (row) => formatPlantDateTime(row.inspectedAt) ?? row.inspectedAt,
    },
    {
      key: 'inspector',
      align: 'center',
      header: t.columns.inspector,
      width: '110px',
      render: (row) => row.inspectorName ?? '-',
    },
    {
      key: 'actions',
      align: 'center',
      header: t.columns.actions,
      width: '90px',
      render: (row) =>
        row.statusCode === RESULT_STATUS.draft && !confirmed ? (
          /* 수정은 아이콘 단추(IQC 와 같다) — 이름은 마우스를 올리면 보인다. */
          <span className="iqc-inbound-actions">
            <IconButton
              icon="edit"
              size="sm"
              disabled={editDisabled}
              title={t.edit}
              aria-label={`${t.round(row.inspectionRound)} ${t.edit}`}
              onClick={() => onEdit(row)}
            />
          </span>
        ) : (
          <Chip size="sm">{t.confirmedRow}</Chip>
        ),
    },
  ];

  const ordered = useColumnOrder('omf-mes:pqc-web-results:columns:order', baseColumns);
  const resizable = useColumnWidths('omf-mes:pqc-web-results:columns', ordered);
  const fit = useFitColumns(resizable.columns, { scrollX: true });
  const sorted = [...rounds].sort((a, b) => a.inspectionRound - b.inspectionRound);

  return (
    <section className="parts-iqc-card" aria-label={t.heading(rounds.length)}>
      <div className="parts-iqc-block-head">
        <h3>
          {t.title} <span className="parts-iqc-muted">{t.count(rounds.length)}</span>
        </h3>
        <span className="parts-iqc-footer-gap" />
        {/* 확정 뒤에는 단추만 감춘다(IQC 와 같다). 잠긴 까닭은 단추에 마우스를 올리면 보인다 — 잠긴 단추 대신 감싼 칸에 단다. */}
        {confirmed ? null : (
          <span title={addBlockedReason ?? undefined}>
            <Button
              size="md"
              disabled={addBlockedReason !== null}
              leadingIcon={<Icon name="add" size={18} aria-hidden />}
              onClick={onAdd}
            >
              {t.add}
            </Button>
          </span>
        )}
      </div>
      <div
        ref={fit.ref}
        className="inspection-queue-table iqc-inbound-table"
        style={resizable.style}
      >
        <Table
          density="compact"
          columns={fit.columns}
          rows={sorted}
          getRowId={(row) => String(row.inspectionResultId)}
          aria-label={t.heading(rounds.length)}
          empty={
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
    </section>
  );
};
