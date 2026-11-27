import type { ProductionOrderFact } from '../types';
import { Button, Chip, EmptyState, SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { AdjustableNativeTable } from './adjustable-table';
import { AssignEditor, type AssignRowHandle } from './assign-editor';
import { formatQty } from './process-model';
import type { OrderWorkOrder } from './queries';

const t = messages.erpWorkOrderFlow.process.assign;

export interface AssignStepProps {
  readOnly?: boolean;
  statusNameOf?: (code: string) => string;
  actionTargetId?: string;
  itemLabel?: string;
  workOrders: OrderWorkOrder[] | undefined;
  blockedIds: ReadonlySet<number> | undefined;
  plantId: number | null;
  erpStorage?: Pick<ProductionOrderFact, 'erpStorageLocationCode' | 'erpStorageWarehouse'>;
  planDateOf: (productionPlanId: number) => string | null;
  lineNameOf?: (lineId: number | null) => string;
  uomLabelOf?: (uomId: number) => string;
  selectedId: number | null;
  /** 예전 목록 · 편집 창 짜임에서 쓰던 값. 표에서는 줄을 풀 일이 없어 쓰지 않는다. */
  cleared?: boolean;
  onSelect: (workOrderId: number | null) => void;
  onDirtyChange: (dirty: boolean) => void;
}

/**
 * 4M 배정 단계 — 작업지시마다 한 줄인 표에서 칸을 바로 고친다(시안 B · 사용자 결정 2026-11-27).
 * 예전에는 왼쪽 목록에서 W/O 를 고르고 오른쪽 편집 창에서 하나씩 저장했다. 지금은 목록과 편집 창이 표 하나이고,
 * [배정 저장]은 고친 줄을 한꺼번에 저장한다. 줄마다의 편집 로직(초안 · 검증 · 점검 · 설비 중복 확인 · 라인 기본 위치)은
 * `AssignEditor` 가 그대로 맡고, 이 컴포넌트는 표 틀과 표 아래 단추만 맡는다.
 * 줄을 누르거나 칸에 초점을 두면 그 줄이 고른 줄이 된다. 줄 아래에는 알릴 것(점검이 막은 까닭 · 저장 오류)이 있을 때만
 * 알림이 붙는다 — 고른 줄 아래에 설비 배정 내역 표를 펼치지 않는다(사용자 지시 2026-11-27).
 */
export const AssignStep = ({
  readOnly = false,
  statusNameOf,
  actionTargetId,
  workOrders,
  blockedIds,
  plantId,
  erpStorage,
  planDateOf,
  uomLabelOf,
  selectedId,
  onSelect,
  onDirtyChange,
}: AssignStepProps) => {
  const handles = useRef(new Map<number, AssignRowHandle>());
  const [dirtyIds, setDirtyIds] = useState<ReadonlySet<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [actionTarget, setActionTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setActionTarget(actionTargetId === undefined ? null : document.getElementById(actionTargetId));
  }, [actionTargetId]);

  const dirty = dirtyIds.size > 0;
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  /* 고른 줄이 없는데 고친 줄이 생기면 그 줄을 고른 줄로 둔다. 사용자가 고른 줄은 건드리지 않는다. */
  const firstDirty = [...dirtyIds][0];
  useEffect(() => {
    if (firstDirty !== undefined && selectedId === null) onSelect(firstDirty);
  }, [firstDirty, onSelect, selectedId]);

  /* 줄마다 같은 함수를 넘겨, 줄이 다시 그려질 때마다 등록 · 해제가 되풀이되지 않게 한다. */
  const perRow = useMemo(() => new Map<number, RowCallbacks>(), []);
  const callbacksOf = useCallback(
    (workOrderId: number): RowCallbacks => {
      const known = perRow.get(workOrderId);
      if (known !== undefined) return known;
      const created: RowCallbacks = {
        onRegister: (handle) => {
          if (handle === null) handles.current.delete(workOrderId);
          else handles.current.set(workOrderId, handle);
        },
        onDirtyChange: (next) =>
          setDirtyIds((current) => {
            if (current.has(workOrderId) === next) return current;
            const copy = new Set(current);
            if (next) copy.add(workOrderId);
            else copy.delete(workOrderId);
            return copy;
          }),
      };
      perRow.set(workOrderId, created);
      return created;
    },
    [perRow],
  );

  if (workOrders === undefined || blockedIds === undefined) return <SkeletonText lines={4} />;

  const pendingCount = readOnly
    ? 0
    : workOrders.filter((row) => blockedIds.has(row.workOrderId)).length;
  const headers = [
    t.columns.workOrderNo,
    t.columns.operation,
    t.columns.quantity,
    `${t.fields.productionLineId} *`,
    t.fields.plannedEquipmentId,
    t.fields.plannedMoldId,
    t.columns.fgWarehouse,
    t.fields.plannedStartAtLocal,
    t.fields.plannedEndAtLocal,
    readOnly ? t.columns.workOrderStatus : t.columns.check,
  ];

  const saveAction = (
    <Button
      size="sm"
      variant={actionTargetId === undefined ? 'outlined' : undefined}
      loading={saving}
      disabled={readOnly || !dirty}
      onClick={async () => {
        setSaving(true);
        try {
          /* 고친 줄을 차례로 저장한다 — 줄마다 설비 중복을 다시 확인하고, 막힌 줄은 그 줄 아래에 까닭을 알린다. */
          for (const id of dirtyIds) await handles.current.get(id)?.save();
        } finally {
          setSaving(false);
        }
      }}
    >
      {t.actions.save}
    </Button>
  );

  return (
    <section className="pane erp-wo-assign-grid-pane" aria-label={t.gridHeading}>
      <div className="section-heading-row">
        <h2 className="section-title">
          {t.gridHeading}{' '}
          <span className="erp-wo-assign-count">
            {t.gridCount(workOrders.length, pendingCount)}
          </span>
        </h2>
        {!readOnly && (
          <div className="assign-editor-actions">
            <Button
              size="sm"
              variant="outlined"
              disabled={saving || workOrders.length === 0}
              onClick={() => handles.current.forEach((handle) => handle.check())}
            >
              {t.actions.check}
            </Button>
            <Button
              size="sm"
              variant="outlined"
              disabled={!dirty || saving}
              onClick={() => dirtyIds.forEach((id) => handles.current.get(id)?.reset())}
            >
              {t.actions.reset}
            </Button>
            {actionTarget === null ? saveAction : createPortal(saveAction, actionTarget)}
          </div>
        )}
      </div>
      {workOrders.length === 0 ? (
        <EmptyState size="sm" title={t.empty} />
      ) : (
        /* 열 사이를 끌어 폭을 바꾸고, 바꾼 폭은 브라우저에 남는다(사용자 지시 2026-11-27). */
        <div className="erp-wo-assign-grid-scroll">
          <AdjustableNativeTable
            storageKey="omf-mes:work-planning:assign-grid-columns:v1"
            className="erp-wo-assign-grid"
            labels={headers}
            widths={COLUMN_WIDTHS}
          >
            <tbody>
              {workOrders.map((row) => {
                const callbacks = callbacksOf(row.workOrderId);
                return (
                  <AssignEditor
                    key={row.workOrderId}
                    row={{
                      workOrderNo: row.workOrderNo,
                      operationName: row.operationName,
                      planDate: planDateOf(row.productionPlanId) ?? '—',
                      quantity:
                        `${formatQty(row.orderQty)} ${uomLabelOf?.(row.uomId) ?? ''}`.trim(),
                      selected: row.workOrderId === selectedId,
                      status: readOnly ? (
                        <Chip size="sm">{statusNameOf?.(row.statusCode) ?? row.statusCode}</Chip>
                      ) : undefined,
                      columnCount: headers.length,
                      onFocus: () => {
                        if (row.workOrderId !== selectedId) onSelect(row.workOrderId);
                      },
                    }}
                    onRegister={callbacks.onRegister}
                    readOnly={readOnly}
                    title={t.editorTitle(row.workOrderNo, row.operationName)}
                    workOrderId={row.workOrderId}
                    plantId={plantId}
                    erpStorage={erpStorage}
                    planDate={planDateOf(row.productionPlanId)}
                    onDirtyChange={callbacks.onDirtyChange}
                    onSaved={noop}
                  />
                );
              })}
            </tbody>
          </AdjustableNativeTable>
        </div>
      )}
    </section>
  );
};

/** 열의 처음 폭(px) — W/O 번호 · 공정 · 수량 · 생산 라인 · 설비 · 금형 · 입고 창고 · 계획 시작 · 계획 종료 · 점검. */
const COLUMN_WIDTHS = [160, 180, 80, 170, 160, 140, 160, 125, 125, 90];

interface RowCallbacks {
  onRegister: (handle: AssignRowHandle | null) => void;
  onDirtyChange: (dirty: boolean) => void;
}

const noop = (): void => undefined;
