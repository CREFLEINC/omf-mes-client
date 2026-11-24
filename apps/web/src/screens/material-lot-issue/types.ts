import type {
  MaterialLotLifecycleCode,
  MaterialLotPair,
  MaterialLotTabRow,
  SupplierItemDefault,
} from '@omf-mes/api-client';

import { toPlantDateTimeParts } from '../../patterns/plant-time';

/**
 * W-01-14 가 읽는 API 모양 — 생성 타입(`@omf-mes/api-client` · 설계 계약 §1·§9 · 피처 014)의 별칭이다.
 */
export type Pair = MaterialLotPair;
export type Lot = MaterialLotTabRow;
export type Defaults = SupplierItemDefault;
export type Lifecycle = MaterialLotLifecycleCode;

/**
 * 고른 공급사·품목 — 상세 · 발행 창 · 미입고 P/O 가 함께 쓰는 이름표(피처 014 왼쪽 줄 `MaterialLotPair` 에서).
 */
export interface Group {
  supplierId: number;
  supplierCode: string;
  supplierName: string;
  itemId: number;
  itemCode: string;
  itemName: string;
  /** 품목 기본 단위. */
  uomCode: string;
}

export const groupOf = (pair: Pair): Group => ({
  supplierId: pair.supplier.supplierId,
  supplierCode: pair.supplier.code,
  supplierName: pair.supplier.name,
  itemId: pair.item.itemId,
  itemCode: pair.item.code,
  itemName: pair.item.name,
  uomCode: pair.item.baseUomCode,
});

/** 공급사·품목 한 조합의 열쇠 — 주소(`open`)와 표의 줄 열쇠. */
export const groupKey = (group: Pick<Group, 'supplierId' | 'itemId'>): string =>
  `${String(group.supplierId)}-${String(group.itemId)}`;

export const pairKey = (pair: Pair): string =>
  groupKey({ supplierId: pair.supplier.supplierId, itemId: pair.item.itemId });

/** 주소 값 → (공급사, 품목). 모양이 틀리면 null. */
export const parseGroupKey = (
  value: string | null,
): { supplierId: number; itemId: number } | null => {
  if (value === null) return null;
  const matched = /^(\d+)-(\d+)$/.exec(value);
  if (matched === null) return null;
  return { supplierId: Number(matched[1]), itemId: Number(matched[2]) };
};

/** 공장 시각 「MM-DD HH:mm」 — 못 읽으면 null. */
export const formatAt = (value: string | null | undefined): string | null => {
  const parts = toPlantDateTimeParts(value);
  if (parts === null) return null;
  return `${parts.date.slice(5)} ${parts.time.slice(0, 5)}`;
};
