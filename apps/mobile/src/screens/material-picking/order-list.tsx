import { AlertBanner, Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { UseQueryResult } from '@tanstack/react-query';

import type { PickingOrder } from './picking';

const t = messages.materialPicking;

export interface PickingOrderListProps {
  /** 사번을 확인하기 전과 찾지 못한 것을 가려 말하기 위해 함께 받는다. */
  workerNo: string | null;
  workerId: UseQueryResult<number | null>;
  orders: UseQueryResult<PickingOrder[]>;
  onChoose: (pickingOrderId: number) => void;
}

/**
 * 내게 배정된 지시를 고르는 자리.
 *
 * 확인하지 못한 것을 없는 것으로 말하지 않는다 - 조회가 실패한 것과 받은 지시가 없는 것은
 * 현장에서 할 일이 다르다.
 */
export const PickingOrderList = ({
  workerNo,
  workerId,
  orders,
  onChoose,
}: PickingOrderListProps) => (
  <section className="picking-out__section">
    <h2>{t.orders.legend}</h2>
    {workerId.isPending && workerNo !== null ? <p role="status">{t.worker.loading}</p> : null}
    {workerId.isError ? <AlertBanner variant="error" title={t.worker.loadFailed} /> : null}
    {workerNo !== null && workerId.data === null ? (
      <AlertBanner variant="warning" title={t.worker.notFound(workerNo)} />
    ) : null}
    {orders.isPending && workerId.data !== null ? <p role="status">{t.orders.loading}</p> : null}
    {orders.isError ? <AlertBanner variant="error" title={t.orders.loadFailed} /> : null}
    {orders.data !== undefined && orders.data.length === 0 ? (
      <AlertBanner variant="info" title={t.orders.none} />
    ) : null}
    {(orders.data ?? []).map((order) => (
      <Button
        key={order.pickingOrderId}
        variant="outlined"
        size="xl"
        className="picking-out__wide"
        onClick={() => {
          onChoose(order.pickingOrderId);
        }}
      >
        {`${order.pickingOrderNo} · ${t.orders.type(order.pickingTypeCode)}`}
      </Button>
    ))}
  </section>
);
