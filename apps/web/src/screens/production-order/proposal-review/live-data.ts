import type { ApiClient, PlanProposal } from '@omf-mes/api-client';
import type { ReferenceRow, ReferenceSource } from '../../../patterns/reference-picker';
import { runRequest } from '../../../patterns/request';
import { formatPlantDateTime } from '../../../patterns/plant-time';
import type { ResourceField, ReviewProposal, ReviewOperation } from './model';
import { resourceLabels, storageFailureLabels } from './model';

type Client = ApiClient['client'];
export type LiveCatalog = Awaited<ReturnType<typeof loadCatalog>>;
const label = (id: number | null, values: Map<number, ReferenceRow>): ReferenceRow | null =>
  id === null ? null : (values.get(id) ?? { id, code: String(id), name: '명칭 확인 필요' });
const reasonNames: Record<string, string> = {
  BOM_DEFAULT_REQUIRED: 'ERP 기본 BOM 지정 필요',
  ROUTING_REQUIRED: 'Routing 등록 필요',
  ROUTING_DEFAULT_REQUIRED: '기본 Routing 지정 필요',
  ROUTING_OPERATION_REQUIRED: 'Routing 공정 등록 필요',
  ORDER_CANCELLED: '취소된 ERP W/O',
  DRAFT_PLAN_EXCEEDS_ORDER: '작성중 계획 수량 검토 필요',
  WORK_ORDER_LINE_REQUIRED: '생산 라인 지정 필요',
  WORK_ORDER_LOCATION_REQUIRED: '기본 위치 확인 필요',
  LINE_PLANT_MISMATCH: '생산 라인의 공장 확인 필요',
  RESOURCE_PLANT_MISMATCH: '설비·금형의 공장 확인 필요',
  EQUIPMENT_NOT_IN_SERVICE: '설비 사용 상태 확인 필요',
  EQUIPMENT_LINE_MISMATCH: '설비의 생산 라인 확인 필요',
  MOLD_NOT_IN_SERVICE: '금형 사용 상태 확인 필요',
  LOCATION_INVALID: '기본 위치의 창고·사용 상태 확인 필요',
  PLAN_QTY_EXCEEDS_ORDER: '계획 수량 초과',
  FG_LOCATION_OUTSIDE_WAREHOUSE: '생산품 입고 창고 내 위치 확인 필요',
  ...storageFailureLabels,
};
export const proposalReason = (code: string) => reasonNames[code] ?? `점검 필요 (${code})`;
export async function loadCatalog(client: Client, proposals: PlanProposal[]) {
  const values = new Map<number, ReferenceRow>();
  const lines = new Map<number, ReferenceRow>();
  const equipment = new Map<number, ReferenceRow>();
  const molds = new Map<number, ReferenceRow>();
  const items = new Map<number, { code: string; name: string }>();
  const plants = await runRequest(() =>
    client.GET('/mdm/plants', { params: { query: { includeInactive: true, size: 200 } } }),
  );
  const uoms = await runRequest(() =>
    client.GET('/mdm/uoms', { params: { query: { includeInactive: true, size: 200 } } }),
  );
  const warehouses = await Promise.all(
    [...new Set(proposals.map((row) => row.plantId))].map(async (plantId) => {
      const data = await runRequest(() =>
        client.GET('/mdm/warehouses', {
          params: { query: { plantId, includeInactive: true, size: 200 } },
        }),
      );
      const lineData = await runRequest(() =>
        client.GET('/mdm/production-lines', {
          params: { query: { plantId, includeInactive: true, size: 200 } },
        }),
      );
      lineData.items.forEach((line) =>
        lines.set(line.productionLineId, {
          id: line.productionLineId,
          code: line.lineCode,
          name: line.lineName,
        }),
      );
      return { plantId, items: data.items };
    }),
  );
  await Promise.all(
    [...new Set(proposals.map((row) => row.itemId))].map(async (id) => {
      try {
        const data = await runRequest(() =>
          client.GET('/mdm/items/{itemId}', { params: { path: { itemId: id } } }),
        );
        items.set(id, { code: data.item.itemCode, name: data.item.itemName });
      } catch {
        items.set(id, { code: String(id), name: '품목명 조회 실패' });
      }
    }),
  );
  const operations = proposals.flatMap((row) => row.plans.flatMap((plan) => plan.workOrders));
  await Promise.all(
    [
      ...new Set(
        operations
          .flatMap((op) => [
            op.defaultWipLocationId,
            op.defaultFgLocationId,
            op.defaultScrapLocationId,
          ])
          .filter((id): id is number => id !== null),
      ),
    ].map(async (id) => {
      try {
        const data = await runRequest(() =>
          client.GET('/mdm/locations/{locationId}', { params: { path: { locationId: id } } }),
        );
        values.set(id, {
          id,
          code: data.location.locationCode,
          name: data.location.locationName,
          parentId: data.location.warehouseId,
        });
      } catch {
        /* Keep the id visible if the reference cannot be read. */
      }
    }),
  );
  await Promise.all(
    [
      ...new Set(
        operations.flatMap((op) => (op.plannedEquipmentId === null ? [] : [op.plannedEquipmentId])),
      ),
    ].map(async (id) => {
      try {
        const data = await runRequest(() =>
          client.GET('/mdm/equipments/{equipmentId}', { params: { path: { equipmentId: id } } }),
        );
        equipment.set(id, {
          id,
          code: data.equipment.equipmentCode,
          name: data.equipment.equipmentName,
          parentId: data.equipment.productionLineId,
        });
      } catch {
        /* Preserve unresolved references. */
      }
    }),
  );
  await Promise.all(
    [
      ...new Set(operations.flatMap((op) => (op.plannedMoldId === null ? [] : [op.plannedMoldId]))),
    ].map(async (id) => {
      try {
        const data = await runRequest(() =>
          client.GET('/mdm/molds/{moldId}', { params: { path: { moldId: id } } }),
        );
        molds.set(id, { id, code: data.mold.moldCode, name: data.mold.moldName });
      } catch {
        /* Preserve unresolved references. */
      }
    }),
  );
  return {
    values,
    lines,
    equipment,
    molds,
    items,
    plants: new Map(plants.items.map((item) => [item.plantId, item.plantName])),
    uoms: new Map(uoms.items.map((item) => [item.uomId, item.uomCode])),
    warehouses,
  };
}
export function toLiveProposal(row: PlanProposal, catalog: LiveCatalog): ReviewProposal {
  const fixed = row.reasons
    .filter((reason) => reason.category === 'BLOCKED')
    .map((reason) => proposalReason(reason.code));
  return {
    id: String(row.productionOrderId),
    number: row.productionOrderNo,
    itemId: row.itemId,
    itemCode: catalog.items.get(row.itemId)?.code ?? String(row.itemId),
    itemName: catalog.items.get(row.itemId)?.name ?? '품목명 확인 필요',
    plant: catalog.plants.get(row.plantId) ?? '공장명 확인 필요',
    plantId: row.plantId,
    live: true,
    serverKind: row.kind,
    serverStatus: row.status,
    orderQty: row.orderQty,
    confirmedQty: row.confirmedPlanQty,
    draftQty: row.draftPlanQty,
    remainingQty: row.remainingQty,
    uom: catalog.uoms.get(row.uomId) ?? `단위 ID ${row.uomId}`,
    issues: fixed,
    serverIssues: row.reasons.map((reason) => proposalReason(reason.code)),
    erpStorage: {
      ...row.erpStorage,
      locationRole:
        row.erpStorage.location?.code === 'SYS-STAGING' ? 'PUTAWAY_STAGING' : 'WAREHOUSE_WHOLE',
    },
    plans: row.plans.map((plan) => ({
      key: `${row.productionOrderId}:${plan.proposalPlanKey}`,
      number: plan.planNo,
      source: plan.planSource === 'EXISTING_DRAFT' ? '작성중 계획' : '신규 제안',
      date: plan.planDate,
      quantity: String(plan.proposedQty),
      bom: `${plan.bomCode} (Rev ${plan.bomVersion})`,
      bomId: plan.bomId,
      routing: `${plan.routingCode} (Rev ${plan.routingVersion})`,
      routingId: plan.routingId,
      operations: plan.workOrders.map((op) => ({
        key: String(op.routingOperationId),
        sequence: op.operationSeq,
        name: op.operationName,
        processCode: op.processCode ?? `공정 ID ${op.processId}`,
        quantity: op.proposedQty,
        predecessors: op.predecessors.map((predecessor) => {
          const value = plan.workOrders.find(
            (item) => item.routingOperationId === predecessor.routingOperationId,
          );
          return value
            ? `${value.operationSeq} / ${value.operationName}`
            : `공정 ID ${predecessor.routingOperationId}`;
        }),
        start: formatPlantDateTime(op.plannedStartAt) ?? '',
        end: formatPlantDateTime(op.plannedEndAt) ?? '',
        defaultFgLocationSource: op.defaultFgLocationSource,
        required: [
          'productionLineId',
          'defaultWipLocationId',
          'defaultFgLocationId',
          'defaultScrapLocationId',
          ...(op.equipmentRequired ? ['plannedEquipmentId' as const] : []),
          ...(op.moldRequired ? ['plannedMoldId' as const] : []),
        ],
        resources: {
          productionLineId: label(op.productionLineId, catalog.lines),
          plannedEquipmentId: label(op.plannedEquipmentId, catalog.equipment),
          plannedMoldId: label(op.plannedMoldId, catalog.molds),
          responsibleWorkerId: null,
          plannedShiftId: null,
          defaultWipLocationId: label(op.defaultWipLocationId, catalog.values),
          defaultFgLocationId: label(op.defaultFgLocationId, catalog.values),
          defaultScrapLocationId: label(op.defaultScrapLocationId, catalog.values),
        },
      })),
    })),
  };
}
export function liveResourceSource(
  client: Client,
  catalog: LiveCatalog,
  row: ReviewProposal,
  field: ResourceField,
  operation?: ReviewOperation,
): ReferenceSource | null {
  const plantId = row.plantId;
  if (!plantId) return null;
  const warehouses =
    catalog.warehouses
      .find((item) => item.plantId === plantId)
      ?.items.filter(
        (item) =>
          item.isActive &&
          item.plantId === plantId &&
          item.warehouseTypeCode !== 'MATERIAL' &&
          (field !== 'defaultFgLocationId' || (!item.isExternal && !item.isDefect)),
      ) ?? [];
  const location =
    field === 'defaultWipLocationId' ||
    field === 'defaultFgLocationId' ||
    field === 'defaultScrapLocationId';
  if (
    location &&
    (!warehouses.length ||
      (field === 'defaultFgLocationId' && row.erpStorage?.erpStorageLocationCode))
  )
    return null;
  if (!location && !['productionLineId', 'plannedEquipmentId', 'plannedMoldId'].includes(field))
    return null;
  return {
    title: `${resourceLabels[field]} 선택`,
    key: ['proposal-reference', plantId, field, operation?.resources.productionLineId?.id ?? ''],
    columns: { code: '코드', name: '명칭' },
    ...(location
      ? {
          filter: {
            label: '창고',
            value: String(warehouses[0]!.warehouseId),
            options: warehouses.map((item) => ({
              value: String(item.warehouseId),
              label: item.warehouseName,
            })),
          },
        }
      : {}),
    search: async (q, page, warehouse) => {
      if (location) {
        if (!warehouses.some((item) => String(item.warehouseId) === warehouse))
          return { items: [], total: 0 };
        const data = await runRequest(() =>
          client.GET('/mdm/locations', {
            params: { query: { warehouseId: Number(warehouse), q, page, size: 50 } },
          }),
        );
        return {
          items: data.items
            .filter((item) => item.isActive && String(item.warehouseId) === warehouse)
            .map((item) => ({
              id: item.locationId,
              code: item.locationCode,
              name: item.locationName,
              parentId: item.warehouseId,
            })),
          total: data.page.total,
        };
      }
      if (field === 'productionLineId') {
        const data = await runRequest(() =>
          client.GET('/mdm/production-lines', {
            params: { query: { plantId, q, page, size: 50 } },
          }),
        );
        return {
          items: data.items
            .filter((item) => item.isActive)
            .map((item) => ({
              id: item.productionLineId,
              code: item.lineCode,
              name: item.lineName,
            })),
          total: data.page.total,
        };
      }
      if (field === 'plannedEquipmentId') {
        const data = await runRequest(() =>
          client.GET('/mdm/equipments', { params: { query: { plantId, q, page, size: 50 } } }),
        );
        return {
          items: data.items
            .filter((item) => item.isActive)
            .map((item) => ({
              id: item.equipmentId,
              code: item.equipmentCode,
              name: item.equipmentName,
              parentId: item.productionLineId,
            })),
          total: data.page.total,
        };
      }
      const data = await runRequest(() =>
        client.GET('/mdm/molds', {
          params: { query: { plantId, toolTypeCode: 'MOLD', q, page, size: 50 } },
        }),
      );
      return {
        items: data.items
          .filter((item) => item.isActive)
          .map((item) => ({ id: item.moldId, code: item.moldCode, name: item.moldName })),
        total: data.page.total,
      };
    },
  };
}
