import type {
  MaterialLotLifecycleCode,
  MaterialLotSummary,
  SupplierItemDefault,
  WaitingMaterialLotGroup,
} from '@omf-mes/api-client';

import { toPlantDateTimeParts } from '../../patterns/plant-time';

/**
 * W-01-14 가 읽는 API 모양 — 선행 계약(`forward-contract.ts`, 설계 계약 §1·§9)의 별칭이다. 서버 S3 병합 뒤
 * `gen:api` 로 다시 만들면(T111) 이 별칭이 생성 타입을 가리키게 된다.
 */
export type Group = WaitingMaterialLotGroup;
export type Lot = MaterialLotSummary;
export type Defaults = SupplierItemDefault;
export type Lifecycle = MaterialLotLifecycleCode;

/** 공급사·품목 한 조합의 열쇠 — 주소(`open`)와 표의 줄 열쇠. */
export const groupKey = (group: Pick<Group, 'supplierId' | 'itemId'>): string =>
  `${String(group.supplierId)}-${String(group.itemId)}`;

/** 주소 값 → (공급사, 품목). 모양이 틀리면 null. */
export const parseGroupKey = (
  value: string | null,
): { supplierId: number; itemId: number } | null => {
  if (value === null) return null;
  const matched = /^(\d+)-(\d+)$/.exec(value);
  if (matched === null) return null;
  return { supplierId: Number(matched[1]), itemId: Number(matched[2]) };
};

export const waitingOf = (group: Group): Lot[] =>
  group.lots.filter((lot) => lot.lifecycleStatusCode === 'WAITING');

/**
 * 상세 창의 표 — 대기와 폐기(아래, 고를 수 없음). 입하된 LOT 는 여기 두지 않는다(screens/W-01-14.md 상세 창).
 */
export const detailLots = (group: Group): Lot[] => [
  ...group.lots.filter((lot) => lot.lifecycleStatusCode === 'WAITING'),
  ...group.lots.filter((lot) => lot.lifecycleStatusCode === 'VOIDED'),
];

/** 공장 시각 「MM-DD HH:mm」 — 못 읽으면 null. */
export const formatAt = (value: string | null | undefined): string | null => {
  const parts = toPlantDateTimeParts(value);
  if (parts === null) return null;
  return `${parts.date.slice(5)} ${parts.time.slice(0, 5)}`;
};

/** 기본 정보를 (공급사, 품목)으로 찾는 표. */
export const defaultsIndex = (rows: readonly Defaults[]): Map<string, Defaults> =>
  new Map(rows.map((row) => [groupKey(row), row] as const));
