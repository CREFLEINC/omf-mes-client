import { AlertBanner, Button, Chip, type Column, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { dateTimeText, itemText, qtyText } from './row-view';
import type { WorkOrder } from './types';

export interface WorkOrderListProps {
  /** 못 받았으면 `undefined` — 빈 배열과 다른 사실이다. */
  workOrders: WorkOrder[] | undefined;
  /** 필터 전체 건수. 목록이 잘렸는지는 이 값으로만 알 수 있다. */
  total: number | undefined;
  isError: boolean;
  selectedId: number | null;
  uomLabel: (uomId: number | undefined) => string;
  onSelect: (workOrder: WorkOrder) => void;
}

/**
 * 긴급 W/O 목록 구획.
 *
 * ⛔ **빈 목록을 오류로 다루지 않는다.** 긴급 W/O 는 없는 것이 정상이고, 발행은 관리웹의
 * 몫이다 — 그래서 빈 상태 문구가 「어디서 만들어지는지」까지 말한다. 조용히 비워 두면
 * 사용자가 이 화면에서 발행을 기다린다.
 *
 * ⛔ **받지 못한 것은 다르다.** 「없다」와 「모른다」를 같은 화면으로 말하면, 조회가 실패한
 * 사이에 긴급 지시가 밀려도 화면이 조용하다.
 */
export const WorkOrderList = ({
  workOrders,
  total,
  isError,
  selectedId,
  uomLabel,
  onSelect,
}: WorkOrderListProps) => {
  const t = messages.emergencyWorkOrderField.list;

  const columns: Column<WorkOrder>[] = [
    {
      key: 'workOrderNo',
      header: t.columns.workOrderNo,
      render: (row) => (
        <>
          {/* ⭐ 줄에서 바로 긴급임을 알아보게 한다 — 이 목록에 다른 유형이 섞이지 않는다는 것과 별개로, 넘어간 화면에서도 같은 표식을 본다. */}
          <Chip status="error" size="sm">
            {t.emergencyBadge}
          </Chip>{' '}
          {row.workOrderNo}
        </>
      ),
    },
    { key: 'item', header: t.columns.item, render: (row) => itemText(row) },
    {
      key: 'orderQty',
      header: t.columns.orderQty,
      align: 'end',
      render: (row) => `${qtyText(row.orderQty)} ${uomLabel(row.uomId)}`,
    },
    {
      key: 'releasedAt',
      header: t.columns.releasedAt,
      render: (row) => dateTimeText(row.releasedAt),
    },
    {
      key: 'select',
      header: t.select,
      render: (row) => (
        <Button
          size="xl"
          variant={selectedId === row.workOrderId ? 'filled' : 'tonal'}
          onClick={() => {
            onSelect(row);
          }}
        >
          {t.select}
        </Button>
      ),
    },
  ];

  const rows = workOrders ?? [];
  const isTruncated = total !== undefined && total > rows.length;

  return (
    <section aria-label={t.title}>
      <h2 className="field-label">{t.title}</h2>

      {isError ? (
        <div className="banner-slot">
          <AlertBanner variant="error">{t.loadError}</AlertBanner>
        </div>
      ) : (
        <>
          {rows.length === 0 ? (
            <div className="banner-slot">
              <AlertBanner variant="info">{t.empty}</AlertBanner>
            </div>
          ) : (
            <Table
              density="comfortable"
              columns={columns}
              rows={rows}
              getRowId={(row) => String(row.workOrderId)}
              caption={t.caption}
            />
          )}

          {isTruncated && <p>{t.truncated(rows.length, total)}</p>}

          {/* 발행 자리를 여기서 찾지 않게 한다 — 이 화면에는 만드는 액션이 없다. */}
          <p>{t.issuedElsewhere}</p>
        </>
      )}
    </section>
  );
};
