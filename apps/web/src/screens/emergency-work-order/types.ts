import type { components, paths } from '@omf-mes/api-client';

/**
 * 이 화면이 다루는 계약 타입. 손으로 옮겨 적지 않고 **계약에서 파생한다** — 계약이 바뀌면
 * 컴파일이 잡아 준다.
 */
export type Item = components['schemas']['Item'];
export type Bom = components['schemas']['Bom'];
export type Routing = components['schemas']['Routing'];
export type RoutingOperation = components['schemas']['RoutingOperation'];

export type ItemListResponse =
  paths['/mdm/items']['get']['responses']['200']['content']['application/json'];
export type BomListResponse =
  paths['/planning/boms']['get']['responses']['200']['content']['application/json'];
export type RoutingListResponse =
  paths['/planning/routings']['get']['responses']['200']['content']['application/json'];
export type RoutingOperationListResponse =
  paths['/planning/routings/{routingId}/operations']['get']['responses']['200']['content']['application/json'];

/** 품목을 골랐을 때 화면이 붙들고 있는 것. 발행 본문의 `uomId`가 여기서 나온다. */
export interface SelectedItem {
  itemId: number;
  itemCode: string;
  itemName: string;
  baseUomId: number;
}

export const toSelectedItem = (item: Item): SelectedItem => ({
  itemId: item.itemId,
  itemCode: item.itemCode,
  itemName: item.itemName,
  baseUomId: item.baseUomId,
});
