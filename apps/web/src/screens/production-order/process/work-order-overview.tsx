import type { ReactNode } from 'react';
import { messages } from '@omf-mes/i18n';
import type { ProductionOrderFact } from '../types';
import { formatQty } from './process-model';

const t = messages.erpWorkOrderFlow;
const tp = t.process;
interface WorkOrderOverviewProps {
  order: ProductionOrderFact;
  item?: { itemCode: string; itemName: string; erpItemGroupCode?: string | null };
  unitLabel: string;
  numberControl?: ReactNode;
  identityOnly?: boolean;
}

export const receiptWarehouseLabel = (order: ProductionOrderFact): string =>
  order.erpStorageLocationCode
    ? order.erpStorageWarehouse
      ? `${order.erpStorageWarehouse.name} (${order.erpStorageWarehouse.code})`
      : `${order.erpStorageLocationCode} · 창고 연결 확인 필요`
    : '미지정';

export const WorkOrderOverview = ({
  order,
  item,
  unitLabel,
  numberControl,
  identityOnly = false,
}: WorkOrderOverviewProps) => (
  <div className="erp-wo-overview-container">
    <div
      className={`erp-wo-summary erp-wo-order-overview${identityOnly ? ' is-identity-only' : ''}`}
    >
      <section className="erp-wo-overview-order" aria-label="ERP W/O 정보">
        <dl>
          <div className="is-order">
            <dt>{tp.orderNumber}</dt>
            <dd>{numberControl ?? order.productionOrderNo}</dd>
          </div>
          {identityOnly && order.dueDate && (
            <div>
              <dt>{tp.summary.dueDate}</dt>
              <dd>{order.dueDate}</dd>
            </div>
          )}
          {order.erpOrderNo && order.erpOrderNo !== order.productionOrderNo && (
            <div>
              <dt>{tp.summary.erpNo}</dt>
              <dd>{order.erpOrderNo}</dd>
            </div>
          )}
        </dl>
      </section>
      <section className="erp-wo-overview-item" aria-label="품목 정보">
        <dl>
          <div className="is-item-code">
            <dt>{t.list.columns.itemCode}</dt>
            <dd>{item?.itemCode ?? '—'}</dd>
          </div>
          <div className="is-item-name">
            <dt>{t.list.columns.itemName}</dt>
            <dd>{item?.itemName ?? '—'}</dd>
          </div>
          {item?.erpItemGroupCode != null && item.erpItemGroupCode !== '' && (
            <div>
              <dt>{tp.summary.itemGroup}</dt>
              <dd>{item.erpItemGroupCode}</dd>
            </div>
          )}
        </dl>
      </section>
      {!identityOnly && (
        <section className="erp-wo-overview-production" aria-label="생산 정보">
          <dl>
            <div className="is-order-quantity">
              <dt>{tp.summary.orderQty}</dt>
              <dd>{`${formatQty(order.orderQty)} ${unitLabel}`}</dd>
            </div>
            <div>
              <dt>생산품 입고 창고</dt>
              <dd>{receiptWarehouseLabel(order)}</dd>
            </div>
            {order.dueDate != null && (
              <div>
                <dt>{tp.summary.dueDate}</dt>
                <dd>{order.dueDate}</dd>
              </div>
            )}
          </dl>
        </section>
      )}
    </div>
  </div>
);
