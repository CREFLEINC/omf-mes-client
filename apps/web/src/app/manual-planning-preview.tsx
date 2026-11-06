import '@crefle/web-ui/styles/index.css';
import '@crefle/web-ui/css';
import './app.css';
import '../screens/production-order/process/release-review.css';
import { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Button, Chip, PageHeader } from '@crefle/web-ui';
import { createApiClient } from '@omf-mes/api-client';
import { ApiClientProvider } from '../patterns/api-context';
import { plantToday } from '../patterns/plant-time';
import { PlanStep } from '../screens/production-order/process/plan-step';
import { manualPlanDefaults } from '../screens/production-order/process/manual-plan-defaults';
import {
  automaticBomId,
  automaticRoutingId,
} from '../screens/production-order/process/master-step';
import { shiftPlanDate } from '../screens/production-order/process/plan-view-model';
import { splitPlanQuantity } from '../screens/production-plan/quantity-split';
import {
  appendProductionPlanRow,
  changeProductionPlanRow,
  type ProductionPlanEditorStateRow,
} from '../screens/production-plan/editor-state';

const today = plantToday();
const order = { orderQty: 120, confirmedPlanQty: 20, plannedStartDate: shiftPlanDate(today, 3) };
const lines = [{ id: 31, code: 'LINE-A', name: '생산 라인 A' }];
const revisions = {
  bomId: String(
    automaticBomId([
      {
        bomId: 11,
        parentItemId: 1,
        bomCode: 'BOM-A',
        bomVersion: 1,
        statusCode: 'CONFIRMED',
        isDefault: true,
        effectiveFrom: '2020-01-01',
        effectiveTo: null,
        baseQty: 1,
        baseUomId: 1,
      },
    ]),
  ),
  routingId: String(
    automaticRoutingId([
      {
        routingId: 21,
        itemId: 1,
        routingCode: 'ROUTING-A',
        routingVersion: 1,
        statusCode: 'CONFIRMED',
        isDefault: true,
        effectiveFrom: '2020-01-01',
        effectiveTo: null,
      },
    ]),
  ),
};
const initialRows = () => {
  const confirmed = appendProductionPlanRow([], 'preview-confirmed', {
    ...revisions,
    planDate: order.plannedStartDate,
    plannedQty: '20',
    plannedLineId: '31',
  }).map((row) => ({
    ...row,
    confirmed: true,
    isDirty: false,
    statusCode: 'CONFIRMED',
    productionPlanId: 100,
    planNo: 'PP261106000001',
  }));
  return appendProductionPlanRow(
    confirmed,
    'preview-1',
    manualPlanDefaults(order, confirmed, lines, revisions, today),
  );
};

function ManualPlanningPreview() {
  const [rows, setRows] = useState<ProductionPlanEditorStateRow[]>(initialRows);
  const sequence = useRef(1);
  const nextKey = () => `preview-${++sequence.current}`;
  return (
    <main className="proposal-preview-frame">
      <PageHeader title="생산계획" />
      <p>
        <Chip status="idle">화면 미리보기</Chip> 예시 ERP W/O · 서버 저장·확정 미연결
      </p>
      <section className="pane">
        <div className="section-heading-row">
          <h2 className="section-title">ERP 정보·기준정보</h2>
          <Button variant="outlined" onClick={() => setRows(initialRows())}>
            추천값으로 초기화
          </Button>
        </div>
        <table className="erp-wo-final-table">
          <thead>
            <tr>
              <th>ERP W/O</th>
              <th>품목코드</th>
              <th>품목명</th>
              <th>ERP W/O 수량</th>
              <th>확정 계획량</th>
              <th>ERP 계획 시작일</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>PD261106000001</td>
              <td>ITEM-A</td>
              <td>품목 A</td>
              <td>120 EA</td>
              <td>20 EA</td>
              <td>{order.plannedStartDate}</td>
            </tr>
          </tbody>
        </table>
        <dl className="erp-wo-final-facts">
          <div>
            <dt>BOM</dt>
            <dd>BOM-A (개정 1) · ERP 기본 개정</dd>
          </div>
          <div>
            <dt>Routing</dt>
            <dd>ROUTING-A (개정 1) · 기본 Routing</dd>
          </div>
          <div>
            <dt>생산 라인</dt>
            <dd>생산 라인 A (LINE-A) · 활성 생산 라인 1개</dd>
          </div>
        </dl>
      </section>
      <PlanStep
        rows={rows}
        orderQty={order.orderQty}
        confirmedQty={order.confirmedPlanQty}
        uomLabel="EA"
        plantId={1}
        lines={lines}
        statusNameOf={(code) => (code === 'CONFIRMED' ? '확정' : '미확정')}
        disabled={false}
        failures={[]}
        onAdd={() =>
          setRows((current) =>
            appendProductionPlanRow(
              current,
              nextKey(),
              manualPlanDefaults(order, current, lines, revisions, today),
            ),
          )
        }
        distributionOrderLabel="PD261106000001 / 품목 A"
        distributionStartDate={order.plannedStartDate}
        distributionDecimalScale={0}
        onAppend={(drafts) =>
          setRows((current) =>
            drafts.reduce(
              (all, draft) => appendProductionPlanRow(all, nextKey(), { ...revisions, ...draft }),
              current,
            ),
          )
        }
        onChange={(key, field, value) =>
          setRows((current) => changeProductionPlanRow(current, key, field, value))
        }
        onRemove={(row) => setRows((current) => current.filter((entry) => entry.key !== row.key))}
        onSplit={(row, quantity) =>
          setRows((current) => {
            const result = splitPlanQuantity(Number(row.draft.plannedQty), quantity, 0);
            return result
              ? appendProductionPlanRow(
                  changeProductionPlanRow(current, row.key, 'plannedQty', String(result.remaining)),
                  nextKey(),
                  { ...row.draft, plannedQty: String(result.split) },
                )
              : current;
          })
        }
      />
    </main>
  );
}

if (import.meta.env.DEV) {
  const api = createApiClient({
    baseUrl: 'http://preview.invalid',
    fetch: async (request) => {
      if (request.method !== 'GET' || new URL(request.url).pathname !== '/mdm/production-lines')
        throw new Error('Preview supports only local production line lookup.');
      return new Response(
        JSON.stringify({
          items: lines.map((line) => ({
            productionLineId: line.id,
            lineCode: line.code,
            lineName: line.name,
            plantId: 1,
            isActive: true,
          })),
          page: { page: 1, size: 100, total: 1 },
        }),
        { headers: { 'Content-Type': 'application/json' } },
      );
    },
  });
  const root = document.getElementById('root');
  if (root)
    createRoot(root).render(
      <QueryClientProvider client={new QueryClient()}>
        <ApiClientProvider client={api}>
          <ManualPlanningPreview />
        </ApiClientProvider>
      </QueryClientProvider>,
    );
}
