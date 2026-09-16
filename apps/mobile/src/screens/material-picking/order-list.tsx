import { AlertBanner, Card } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { UseQueryResult } from '@tanstack/react-query';

import { displayNameOf, type CodeValue } from '../../patterns/code-values';
import { FailureBanner } from '../../patterns/failure-banner';
import { useLoadFailure } from '../../patterns/load-failure';
import type { PickingOrder } from './picking';

const t = messages.materialPicking;

export interface PickingOrderListProps {
  orders: UseQueryResult<PickingOrder[]>;
  /* 목록이 현장이 먼저 보고 고르는 자리다. 코드를 그대로 보이면 거기서 영문을 읽는다. */
  pickingTypes: CodeValue[];
  onChoose: (pickingOrderId: number) => void;
}

/**
 * 집을 지시를 고르는 자리.
 *
 * 확인하지 못한 것을 없는 것으로 말하지 않는다 - 조회가 실패한 것과 받은 지시가 없는 것은
 * 현장에서 할 일이 다르다.
 */
export const PickingOrderList = ({ orders, pickingTypes, onChoose }: PickingOrderListProps) => {
  const failureText = useLoadFailure();

  return (
    <section className="picking-out__section">
      <h2>{t.orders.legend}</h2>
      {orders.isPending ? <p role="status">{t.orders.loading}</p> : null}
      {orders.isError ? (
        <FailureBanner variant="error" title={failureText(orders.error, t.orders.loadFailed)} />
      ) : null}
      {orders.isSuccess && orders.data.length === 0 ? (
        <AlertBanner variant="info" title={t.orders.none} />
      ) : null}
      {(orders.data ?? []).map((order) => (
        <Card
          key={order.pickingOrderId}
          bordered
          interactive
          onClick={() => {
            onChoose(order.pickingOrderId);
          }}
        >
          <Card.Body className="card-body picking-out__order">
            <strong>{order.pickingOrderNo}</strong>
            <p>{t.orders.type(displayNameOf(pickingTypes, order.pickingTypeCode))}</p>
          </Card.Body>
        </Card>
      ))}
    </section>
  );
};
