import { Button, Chip, Dialog, EmptyState, SkeletonText, type Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import { SelectableTable } from '../../../patterns/selectable-table';
import { AssignEditor } from './assign-editor';
import { formatQty, nextIncompleteId } from './process-model';
import type { OrderWorkOrder } from './queries';

const t = messages.erpWorkOrderFlow.process.assign;

export interface AssignStepProps {
  actionTargetId?: string;
  itemLabel?: string;
  workOrders: OrderWorkOrder[] | undefined;
  blockedIds: ReadonlySet<number> | undefined;
  plantId: number | null;
  planDateOf: (productionPlanId: number) => string | null;
  lineNameOf?: (lineId: number | null) => string;
  uomLabelOf?: (uomId: number) => string;
  selectedId: number | null;
  onSelect: (workOrderId: number) => void;
  onDirtyChange: (dirty: boolean) => void;
}

/**
 * 4M 배정 단계(T-W-C 「대상 안의 하위 항목」): 왼쪽 W/O 목록(공정과 배정 완료 칩), 오른쪽 편집 영역.
 * W/O 번호는 편집 영역 제목과 행 접근 이름에 둔다. 편집 영역이 고른 값을 다 읽을 수 있게 두 칸 폭을 확보하려고
 * 목록에서는 번호 열을 뺐다(C-16 「우선순위 낮은 열을 상세로」).
 * 저장하지 않은 변경이 있는 채로 다른 W/O를 누르면 확인을 받는다.
 * [저장]하면 다음 미완료 W/O를 공정 순서로 연다(T-W-C 항목 하나씩 끝내는 흐름).
 * 자동으로 채워지는 값을 접어도 넘치면(펼친 위치 묶음) 편집 영역 안에서만 스크롤하고 머리는 고정한다
 * (T-W-C 높이가 모자랄 때 ②, 이탈. 구성안 8장).
 */
export const AssignStep = ({
  actionTargetId,
  itemLabel,
  workOrders,
  blockedIds,
  plantId,
  planDateOf,
  lineNameOf,
  uomLabelOf,
  selectedId,
  onSelect,
  onDirtyChange,
}: AssignStepProps) => {
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState<number | null>(null);
  if (workOrders === undefined || blockedIds === undefined) return <SkeletonText lines={4} />;
  const selected = workOrders.find((item) => item.workOrderId === selectedId);
  const columns: Column<OrderWorkOrder>[] = [
    {
      key: 'operation',
      header: t.columns.operation,
      render: (row) => (
        <span className="erp-wo-assign-target">
          <span className="ellipsis-cell" title={row.workOrderNo}>
            {row.workOrderNo}
          </span>
          <small>{row.operationName}</small>
          <small>
            {planDateOf(row.productionPlanId) ?? '—'} / {formatQty(row.orderQty)}{' '}
            {uomLabelOf?.(row.uomId) ?? ''}
          </small>
          {lineNameOf !== undefined && <small>{lineNameOf(row.productionLineId ?? null)}</small>}
        </span>
      ),
    },
    {
      key: 'status',
      header: t.columns.status,
      render: (row) =>
        blockedIds.has(row.workOrderId) ? (
          <Chip variant="status" size="sm" status="warning">
            {t.pending}
          </Chip>
        ) : (
          <Chip variant="status" size="sm" status="success">
            {t.done}
          </Chip>
        ),
    },
  ];
  const changeDirty = (next: boolean) => {
    setDirty(next);
    onDirtyChange(next);
  };

  return (
    <div className="erp-wo-assign-layout">
      <section className="pane erp-wo-assign-list" aria-label={t.listHeading}>
        <h2 className="section-title">
          {t.listHeading} <span className="erp-wo-assign-count">{workOrders.length}</span>
        </h2>
        <p className="field-note erp-wo-assignment-progress">
          배정 완료 후 다음 미완료 작업지시를 자동 선택합니다.
        </p>
        <SelectableTable
          columns={columns}
          rows={workOrders}
          getRowId={(row) => String(row.workOrderId)}
          activeId={selectedId === null ? null : String(selectedId)}
          rowLabel={(row) => `${row.workOrderNo} ${row.operationName}`}
          onActivate={(row) => {
            if (row.workOrderId === selectedId) return;
            if (dirty) setPending(row.workOrderId);
            else onSelect(row.workOrderId);
          }}
          empty={<EmptyState size="sm" title={t.empty} />}
        />
      </section>
      <section
        className="pane erp-wo-assign-editor"
        aria-label={selected === undefined ? t.editorHeading : t.editorLabel(selected.workOrderNo)}
      >
        {selected === undefined ? (
          <EmptyState size="sm" title={t.selectPrompt} />
        ) : (
          <AssignEditor
            actionTargetId={actionTargetId}
            summary={`${itemLabel ? `${itemLabel} / ` : ''}${lineNameOf?.(selected.productionLineId ?? null) ?? ''} / ${planDateOf(selected.productionPlanId) ?? '—'} / ${formatQty(selected.orderQty)} ${uomLabelOf?.(selected.uomId) ?? ''}`}
            key={selected.workOrderId}
            title={t.editorTitle(selected.workOrderNo, selected.operationName)}
            workOrderId={selected.workOrderId}
            plantId={plantId}
            planDate={planDateOf(selected.productionPlanId)}
            onDirtyChange={changeDirty}
            onSaved={(ready) => {
              const next = nextIncompleteId(
                workOrders.map((item) => item.workOrderId),
                blockedIds,
                selected.workOrderId,
                ready,
              );
              if (next !== null) onSelect(next);
            }}
          />
        )}
      </section>
      {pending !== null && (
        <Dialog
          open
          title={t.discard.title}
          onClose={() => setPending(null)}
          footer={
            <>
              <Button variant="outlined" onClick={() => setPending(null)}>
                {messages.common.cancel}
              </Button>
              <Button
                onClick={() => {
                  const next = pending;
                  setPending(null);
                  changeDirty(false);
                  onSelect(next);
                }}
              >
                {t.discard.confirm}
              </Button>
            </>
          }
        >
          <p className="dialog-text">{t.discard.body}</p>
        </Dialog>
      )}
    </div>
  );
};
