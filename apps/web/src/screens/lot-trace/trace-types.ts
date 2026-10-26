import type { components, paths } from '@omf-mes/api-client';

/** 정방향, 역방향 추적 계약. 정본: 서버 `contracts/logistics-01자재창고.json`(서버 PR #830, 장부 P-119). */
type Schemas = components['schemas'];

export type ForwardListQuery = NonNullable<
  paths['/trace/material-lot-flows']['get']['parameters']['query']
>;
export type ForwardListPage =
  paths['/trace/material-lot-flows']['get']['responses'][200]['content']['application/json'];
export type ForwardListRow = ForwardListPage['items'][number];
export type ForwardStage = ForwardListRow['currentStageCode'];

export type BackwardListQuery = NonNullable<
  paths['/trace/product-lot-flows']['get']['parameters']['query']
>;
export type BackwardListPage =
  paths['/trace/product-lot-flows']['get']['responses'][200]['content']['application/json'];
export type BackwardListRow = BackwardListPage['items'][number];

export type ForwardChain =
  paths['/trace/lots/{lotId}/forward-flow']['get']['responses'][200]['content']['application/json'];
export type ForwardWorkOrder = ForwardChain['workOrders'][number];
export type BackwardChain =
  paths['/trace/lots/{lotId}/backward-flow']['get']['responses'][200]['content']['application/json'];

export type FlowBasis = Schemas['LotFlowBasis'];
export type FlowNamed = Schemas['LotFlowNamed'];
export type FlowLotHead = Schemas['LotFlowLotHead'];
export type FlowReceipt = Schemas['LotFlowReceipt'];
export type FlowInbound = Schemas['LotFlowInbound'];
export type FlowPackage = Schemas['LotFlowPackage'];
export type FlowShipment = Schemas['LotFlowShipment'];
export type FlowProductSide = Schemas['LotFlowProductSide'];
export type FlowProductionLot = Schemas['LotFlowProductionLot'];
export type FlowInputMaterial = Schemas['LotFlowInputMaterial'];
