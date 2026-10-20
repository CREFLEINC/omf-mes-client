import { AlertBanner, Card, EmptyState, SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { formatPlantDateTime } from '../../patterns/plant-time';
import { displayOr, formatQty, reworkLabel } from './format';
import type { ErpProductionOrder } from './types';

const t = messages.erpProductionOrder;

/**
 * 고른 건의 표시 상태. 네 갈래를 타입으로 가른다 — 「안 고름」과 「불러오는 중」과 「실패」를
 * 한 빈 상태로 뭉개면 실패가 「없습니다」로 읽힌다.
 */
export type DetailState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'failed' }
  | { kind: 'ready'; data: ErpProductionOrder };

export interface ErpProductionOrderDetailPaneProps {
  state: DetailState;
  businessUnitNameOf: (id: number | null | undefined) => string;
  plantNameOf: (id: number | null | undefined) => string;
  itemNameOf: (itemId: number) => string;
  uomNameOf: (uomId: number) => string;
  storageLocationOf: (code: string) => string;
  statusNameOf: (code: string) => string;
}

interface Fact {
  key: string;
  label: string;
  value: string;
}

const FactList = ({ facts }: { facts: Fact[] }) => (
  <dl>
    {facts.map((fact) => (
      <div key={fact.key}>
        <dt className="field-label">{fact.label}</dt>
        <dd>{fact.value}</dd>
      </div>
    ))}
  </dl>
);

/**
 * 받은 마지막 ERP 변경. 서버가 정한 순서·표시명을 그대로 그린다 — 정렬하지 않고 항목명을 짓지 않는다.
 * 항목이 비어 있으면 열거 밖이 바뀐 것이라 그 사실을 그대로 말한다(공유계약 G-9).
 */
const LastChange = ({ order }: { order: ErpProductionOrder }) => {
  const change = order.lastChange;
  if (change === undefined) {
    return <p className="field-note">{t.values.noLastChange}</p>;
  }
  const facts: Fact[] = [
    {
      key: 'receivedAt',
      label: t.fields.lastChangeReceivedAt,
      value: formatPlantDateTime(change.receivedAt) ?? displayOr(change.receivedAt),
    },
    ...change.changedFields.map((field) => ({
      key: field.field,
      label: field.label,
      value: t.values.changeArrow(displayOr(field.beforeText), displayOr(field.afterText)),
    })),
  ];
  return (
    <>
      <FactList facts={facts} />
      {change.changedFields.length === 0 && (
        <p className="field-note">{t.values.noChangedFields}</p>
      )}
    </>
  );
};

/**
 * 받은 칸 전부. 상위 ERP W/O·BOM 레벨·전개 W/O 수·확인 기록은 MES 가 계획·확인하며 붙인 값이라
 * 싣지 않는다 — 이 화면은 ERP 가 보낸 것만 보인다.
 */
export const ErpProductionOrderDetailPane = ({
  state,
  businessUnitNameOf,
  plantNameOf,
  itemNameOf,
  uomNameOf,
  storageLocationOf,
  statusNameOf,
}: ErpProductionOrderDetailPaneProps) => {
  if (state.kind === 'idle') {
    return (
      <section className="pane" aria-label={t.panes.detail}>
        <h2>{t.panes.detail}</h2>
        <EmptyState
          size="sm"
          title={t.empty.notSelectedTitle}
          description={t.empty.notSelectedDescription}
        />
      </section>
    );
  }

  if (state.kind === 'loading') {
    return (
      <section className="pane" aria-label={t.panes.detail}>
        <div role="status" aria-label={t.loading}>
          <SkeletonText lines={4} />
        </div>
      </section>
    );
  }

  if (state.kind === 'failed') {
    return (
      <section className="pane" aria-label={t.panes.detail}>
        <AlertBanner variant="error" title={t.detailLoadFailedTitle}>
          {t.loadFailedDescription}
        </AlertBanner>
      </section>
    );
  }

  const order = state.data;
  const facts: Fact[] = [
    { key: 'no', label: t.fields.productionOrderNo, value: order.productionOrderNo },
    { key: 'erpNo', label: t.fields.erpOrderNo, value: displayOr(order.erpOrderNo) },
    {
      key: 'businessUnit',
      label: t.fields.businessUnit,
      value: businessUnitNameOf(order.businessUnitId),
    },
    { key: 'plant', label: t.fields.plant, value: plantNameOf(order.plantId) },
    { key: 'item', label: t.fields.item, value: itemNameOf(order.itemId) },
    { key: 'qty', label: t.fields.orderQty, value: formatQty(order.orderQty) },
    { key: 'uom', label: t.fields.uom, value: uomNameOf(order.uomId) },
    {
      key: 'plannedStart',
      label: t.fields.plannedStartDate,
      value: displayOr(order.plannedStartDate),
    },
    { key: 'due', label: t.fields.dueDate, value: displayOr(order.dueDate) },
    { key: 'operation', label: t.fields.operationNo, value: displayOr(order.erpOperationNo) },
    {
      key: 'storage',
      label: t.fields.storageLocation,
      value:
        order.erpStorageLocationCode === undefined || order.erpStorageLocationCode === ''
          ? t.values.missing
          : storageLocationOf(order.erpStorageLocationCode),
    },
    { key: 'rework', label: t.fields.rework, value: reworkLabel(order.erpReworkFlag) },
    { key: 'status', label: t.fields.status, value: statusNameOf(order.statusCode) },
    { key: 'remarks', label: t.fields.remarks, value: displayOr(order.remarks) },
  ];

  return (
    <section className="pane" aria-label={t.panes.detail}>
      <h2>{t.panes.detail}</h2>
      <Card bordered>
        <Card.Body>
          <FactList facts={facts} />
        </Card.Body>
      </Card>
      <h3>{t.fields.lastChange}</h3>
      <LastChange order={order} />
    </section>
  );
};
