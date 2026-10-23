import { Button, Chip, Dialog, EmptyState, SkeletonText, type Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useLayoutEffect, useRef, useState } from 'react';

import { SelectableTable } from '../../../patterns/selectable-table';
import { AssignEditor } from './assign-editor';
import { nextIncompleteId } from './process-model';
import type { OrderWorkOrder } from './queries';

const t = messages.erpWorkOrderFlow.process.assign;

export interface AssignStepProps {
  workOrders: OrderWorkOrder[] | undefined;
  blockedIds: ReadonlySet<number> | undefined;
  plantId: number | null;
  planDateOf: (productionPlanId: number) => string | null;
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
  workOrders,
  blockedIds,
  plantId,
  planDateOf,
  selectedId,
  onSelect,
  onDirtyChange,
}: AssignStepProps) => {
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState<number | null>(null);
  const editorRef = useRef<HTMLElement>(null);
  /* 편집 영역 높이를 하단 바 윗변까지로 둔다. 넘치는 부분은 편집 영역 안에서 스크롤한다. 위쪽 요약 줄 수가 바뀔 수 있어 그릴 때마다 다시 잰다. */
  useLayoutEffect(() => {
    const element = editorRef.current;
    if (element === null) return undefined;
    const fit = () => {
      /* 하단 바가 아래에 붙었을 때의 윗변. 본문 길이에 따라 바 위치가 바뀌지 않게 스크롤 영역 아래 끝에서 계산한다. */
      const bar = document.querySelector<HTMLElement>('.action-bar');
      let scroller = element.parentElement;
      while (scroller !== null && !/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)) {
        scroller = scroller.parentElement;
      }
      /* 붙는 위치는 스크롤 영역의 안쪽 여백을 뺀 아래 끝이 기준이다. */
      const bottom =
        scroller === null
          ? window.innerHeight
          : scroller.getBoundingClientRect().bottom -
            (parseFloat(getComputedStyle(scroller).paddingBottom) || 0);
      const limit =
        bar === null
          ? bottom
          : bottom - (parseFloat(getComputedStyle(bar).bottom) || 0) - bar.offsetHeight;
      element.style.maxHeight = `${String(Math.floor(limit - element.getBoundingClientRect().top))}px`;
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  });
  if (workOrders === undefined || blockedIds === undefined) return <SkeletonText lines={4} />;
  const selected = workOrders.find((item) => item.workOrderId === selectedId);
  const columns: Column<OrderWorkOrder>[] = [
    {
      key: 'operation',
      header: t.columns.operation,
      render: (row) => (
        <span className="ellipsis-cell" title={row.operationName}>
          {row.operationName}
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
        <h2 className="section-title">{t.listHeading}</h2>
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
        ref={editorRef}
        className="pane erp-wo-assign-editor"
        aria-label={selected === undefined ? t.editorHeading : t.editorLabel(selected.workOrderNo)}
      >
        {selected === undefined ? (
          <EmptyState size="sm" title={t.selectPrompt} />
        ) : (
          <AssignEditor
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
