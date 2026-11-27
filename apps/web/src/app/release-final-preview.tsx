import '@crefle/web-ui/styles/index.css';
import '@crefle/web-ui/css';
import './app.css';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PageHeader, Chip } from '@crefle/web-ui';
import { createApiClient } from '@omf-mes/api-client';
import { ApiClientProvider } from '../patterns/api-context';
import {
  ReleaseReview,
  type ReleaseReviewPlan,
} from '../screens/production-order/process/release-review';
import { workOrderKeys } from '../screens/work-order/queries';
import { routingKeys } from '../screens/routing/queries';
import { workOrderResourceKeys } from '../screens/work-order/resource-queries';
import type { ReleaseLine } from '../screens/production-order/process/release-step';

if (import.meta.env.DEV) {
  const queries = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
  const plan: ReleaseReviewPlan = {
    productionPlanId: 1,
    productionOrderId: 1,
    planNo: 'PLAN-1',
    planDate: '2026-11-06',
    plannedQty: 100,
    uomId: 1,
    bomId: 2,
    routingId: 3,
    plannedLineId: 1,
    statusCode: 'CONFIRMED',
    confirmedAt: '2026-11-06T00:00:00Z',
    remarks: null,
    versionNo: 1,
    bomLabel: 'BOM-A (개정 1)',
    revisionContent: {
      bom: (
        <table className="erp-wo-final-table">
          <thead>
            <tr>
              <th>자재코드</th>
              <th>자재명</th>
              <th>소요량</th>
              <th>단위</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>MAT-01</td>
              <td>구성 자재 A</td>
              <td>1</td>
              <td>EA</td>
            </tr>
          </tbody>
        </table>
      ),
      routing: (
        <table className="erp-wo-final-table">
          <thead>
            <tr>
              <th>공정 순서</th>
              <th>공정</th>
              <th>설비 필수</th>
              <th>금형 필수</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>10</td>
              <td>성형</td>
              <td>필수</td>
              <td>선택</td>
            </tr>
          </tbody>
        </table>
      ),
    },
    routingLabel: 'RT-A (개정 1)',
  };
  const line: ReleaseLine = {
    workOrder: {
      workOrderId: 11,
      workOrderNo: 'WO261106000001',
      productionPlanId: 1,
      operationName: '성형',
      orderQty: 100,
      uomId: 1,
      itemId: 1,
      statusCode: 'CONFIRMED',
      priorityNo: 1,
    },
    lotSizeText: '50',
    lotSize: 50,
    lotCount: 2,
    error: null,
    touched: false,
  };
  queries.setQueryData(workOrderKeys.detail(11), {
    ...line.workOrder,
    routingOperationId: 31,
    workOrderTypeCode: 'NORMAL',
    productionLineId: 1,
    plannedEquipmentId: 88,
    plannedMoldId: null,
    defaultFgLocationId: 2,
    defaultScrapLocationId: 3,
    responsibleWorkerId: null,
    plannedShiftId: null,
    remarks: null,
    plannedStartAt: '2026-11-06T01:00:00Z',
    plannedEndAt: '2026-11-06T10:00:00Z',
  });
  queries.setQueryData(routingKeys.operations(3), {
    items: [
      {
        routingOperationId: 31,
        operationSeq: 10,
        operationName: '성형',
        equipmentRequired: true,
        moldRequired: false,
      },
    ],
  });
  queries.setQueryData(workOrderResourceKeys.equipment(88), {
    equipmentId: 88,
    equipmentCode: 'EQ-01',
    equipmentName: '설비 A',
  });
  queries.setQueryData(workOrderResourceKeys.warehouses(1), {
    items: [
      {
        warehouseId: 1,
        plantId: 1,
        warehouseCode: 'WH-01',
        warehouseName: '생산 창고',
        warehouseTypeCode: 'PRODUCTION',
        isActive: true,
      },
    ],
    page: { page: 1, size: 200, total: 1 },
  });
  queries.setQueryData(workOrderResourceKeys.locations(1), {
    items: [
      {
        locationId: 1,
        warehouseId: 1,
        locationCode: 'WIP-01',
        locationName: 'WIP 위치 A',
        isActive: true,
      },
      {
        locationId: 2,
        warehouseId: 1,
        locationCode: 'FG-01',
        locationName: '완제품 위치 A',
        isActive: true,
      },
      {
        locationId: 3,
        warehouseId: 1,
        locationCode: 'SCRAP-01',
        locationName: '스크랩 위치 A',
        isActive: true,
      },
    ],
    page: { page: 1, size: 200, total: 3 },
  });
  const api = createApiClient({
    baseUrl: 'http://preview.invalid',
    fetch: async () => {
      throw new Error('The development preview must use seeded query data only.');
    },
  });
  const root = document.getElementById('root');
  if (root)
    createRoot(root).render(
      <QueryClientProvider client={queries}>
        <ApiClientProvider client={api}>
          <div className="release-final-preview-frame">
            <PageHeader title="배포 확인" />
            <p>
              <Chip status="idle">화면 미리보기</Chip> 시험 데이터 / 저장 및 배포 미연결
            </p>
            <ReleaseReview
              plans={[plan]}
              lines={[line]}
              plantId={1}
              lineNameOf={() => '생산 라인 A (LINE-01)'}
              uomLabelOf={() => 'EA'}
            />
          </div>
        </ApiClientProvider>
      </QueryClientProvider>,
    );
}
