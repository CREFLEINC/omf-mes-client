import { AlertBanner, SkeletonText, TextField, type Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useQueries } from '@tanstack/react-query';

import { useApiClient } from '../../../patterns/api-context';
import { EffectList } from '../../../patterns/process-page';
import { runRequest } from '../../../patterns/request';
import { SelectableTable } from '../../../patterns/selectable-table';
import { evaluateWorkOrderReleaseDraft } from '../../work-order-release/release-draft';
import { productionOrderItemKeys } from '../item-lookups';
import { formatQty } from './process-model';
import type { OrderWorkOrder } from './queries';

const t = messages.erpWorkOrderFlow.process.release;

export interface ReleaseLine {
  workOrder: OrderWorkOrder;
  lotSizeText: string;
  lotSize: number | null;
  lotCount: number | null;
  error: string | null;
  /** 사용자가 고친 줄. 처음 연 화면에는 오류를 보이지 않는다(C-7). */
  touched: boolean;
}

/** 품목 기본 LOT 크기(단위가 같을 때만). 같은 품목 상세 캐시를 쓴다. */
export const useDefaultLotSizes = (workOrders: readonly OrderWorkOrder[]): Map<number, number> => {
  const { client } = useApiClient();
  const itemIds = [...new Set(workOrders.map((item) => item.itemId))];
  const results = useQueries({
    queries: itemIds.map((itemId) => ({
      queryKey: productionOrderItemKeys.detail(itemId),
      queryFn: () =>
        runRequest(() => client.GET('/mdm/items/{itemId}', { params: { path: { itemId } } })),
    })),
  });
  const map = new Map<number, number>();
  workOrders.forEach((workOrder) => {
    const detail = results[itemIds.indexOf(workOrder.itemId)]?.data?.item;
    const size = detail?.defaultProductionLotSize ?? null;
    if (detail !== undefined && detail.baseUomId === workOrder.uomId && size !== null && size > 0) {
      map.set(workOrder.workOrderId, size);
    }
  });
  return map;
};

export const toReleaseLines = (
  workOrders: readonly OrderWorkOrder[],
  lotSizeTexts: Record<number, string>,
  defaults: Map<number, number>,
): ReleaseLine[] =>
  workOrders.map((workOrder) => {
    const text =
      lotSizeTexts[workOrder.workOrderId] ?? String(defaults.get(workOrder.workOrderId) ?? '');
    const evaluation = evaluateWorkOrderReleaseDraft(
      { lotSizeText: text, handoverNote: '' },
      workOrder.orderQty,
    );
    return {
      workOrder,
      lotSizeText: text,
      lotSize: evaluation.body?.lotSize ?? null,
      lotCount: evaluation.preview?.slotCount ?? null,
      error: evaluation.lotSizeError,
      touched: lotSizeTexts[workOrder.workOrderId] !== undefined,
    };
  });

export interface ReleaseStepProps {
  lines: ReleaseLine[] | undefined;
  uomLabelOf: (uomId: number) => string;
  failures: string[];
  /** 배포를 눌렀으면 손대지 않은 줄의 오류도 보인다. */
  revealErrors: boolean;
  onLotSizeChange: (workOrderId: number, value: string) => void;
}

/**
 * 배포 확인 단계(마지막 확인 단계). 결과를 바꾸는 값(W/O, 수량, LOT 크기)과 반영 사항을 1280×800 첫 화면 안에 보인다.
 */
export const ReleaseStep = ({
  lines,
  uomLabelOf,
  failures,
  revealErrors,
  onLotSizeChange,
}: ReleaseStepProps) => {
  if (lines === undefined) return <SkeletonText lines={4} />;
  const totalLots = lines.reduce((sum, line) => sum + (line.lotCount ?? 0), 0);
  const columns: Column<ReleaseLine>[] = [
    {
      key: 'workOrderNo',
      header: t.columns.workOrderNo,
      render: (row) => <span className="nowrap-cell mono-cell">{row.workOrder.workOrderNo}</span>,
    },
    {
      key: 'operation',
      header: t.columns.operation,
      render: (row) => (
        <span className="ellipsis-cell" title={row.workOrder.operationName}>
          {row.workOrder.operationName}
        </span>
      ),
    },
    {
      key: 'orderQty',
      header: t.columns.orderQty,
      align: 'end',
      render: (row) => (
        <span className="nowrap-cell">{`${formatQty(row.workOrder.orderQty)} ${uomLabelOf(row.workOrder.uomId)}`}</span>
      ),
    },
    {
      key: 'lotSize',
      header: t.columns.lotSize,
      width: '9rem',
      render: (row) => (
        <TextField
          size="sm"
          fullWidth
          inputMode="decimal"
          aria-label={t.lotSizeLabel(row.workOrder.workOrderNo)}
          value={row.lotSizeText}
          error={row.touched || revealErrors ? (row.error ?? undefined) : undefined}
          onChange={(event) => onLotSizeChange(row.workOrder.workOrderId, event.target.value)}
        />
      ),
    },
    {
      key: 'lotCount',
      header: t.columns.lotCount,
      align: 'end',
      render: (row) => (
        <span className="nowrap-cell">{row.lotCount === null ? '' : String(row.lotCount)}</span>
      ),
    },
  ];

  return (
    <div className="erp-wo-release-layout">
      <section className="pane erp-wo-step-pane" aria-label={t.heading}>
        <h2 className="section-title">{t.heading}</h2>
        <SelectableTable
          columns={columns}
          rows={lines}
          getRowId={(row) => String(row.workOrder.workOrderId)}
        />
      </section>
      <section className="pane erp-wo-release-effects">
        <EffectList
          task={t.task}
          items={[
            { key: 'status', label: t.effects.status(lines.length) },
            { key: 'lots', label: t.effects.lots(totalLots) },
            { key: 'materials', label: t.effects.materials },
          ]}
        />
        <AlertBanner variant="info">{t.irreversible}</AlertBanner>
        {failures.length > 0 && (
          <AlertBanner variant="error">
            <ul className="erp-wo-release-failures">
              {failures.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </AlertBanner>
        )}
      </section>
    </div>
  );
};
