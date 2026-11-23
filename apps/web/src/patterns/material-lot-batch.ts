import type {
  MaterialLotBatchCreate,
  MaterialPackageInput,
  SupplierItemDefault,
} from '@omf-mes/api-client';
import { useQuery } from '@tanstack/react-query';

import { useApiClient } from './api-context';
import { matchesPackage, packageProduct, parseQtyInput } from './package-qty';
import { plantToday } from './plant-time';
import { runRequest } from './request';

/**
 * 자재 관리 LOT **발행 창의 칸 · 규칙**(005 · FR-002·003 · screens/P-01-01.md 「자재 관리 LOT 만들기」).
 *
 * POP P-01-01 「자재 관리 LOT 만들기」와 관리웹 W-01-14 「자재 관리 LOT 발행」이 **같은 칸 · 같은 규칙**이다
 * (screens/W-01-14.md 「발행 창」). 그림만 다르고(POP 손 크기 · 관리웹 DS) 채우기 · 검사 · 본문은 여기 하나다.
 *
 * ⭐ 기본값의 출처는 넷이고 이 차례로 고른다(피처 014 FR-019 · plan D-6 — 품목 기본값이 먼저):
 *   1. `item` — 품목 LOT 기본값(W-06-05 · 자재 LOT 기본크기 · 보관 단위 · 패키징 기본값)이 있다: 재고 수량 ·
 *      패키징을 채운다. 자동 생성(조회 때 P/O 몫)과 같은 값이다.
 *   2. `default` — 공급사·품목 기본 정보(W-06-25)가 있다: 패키징 · 재고 수량을 채운다(바꿀 수 있다).
 *   3. `itemStorage` — 둘 다 없고 품목 기본 보관 단위가 있다: 패키징 단위(와 품목 환산이 있으면
 *      패키징당 수량)만 채우고 재고 수량 · 개수는 빈칸.
 *   4. `none` — 셋 다 없다: 패키징 없음으로 시작, 직접 입력.
 * ⛔ 서버 발행 경로는 기본 정보를 강제하지 않는다 — 본문 값이 정본이다(research R-26).
 */

/** 기본값을 어디서 채웠나 — 창의 출처 칩이 말한다. */
export type BatchSource = 'item' | 'default' | 'itemStorage' | 'none';

/**
 * 품목 LOT 기본값(피처 014 FR-004·006) — LOT 하나의 재고 수량(품목 기본 단위)과 패키징(LOT 당 패키징 수 ·
 * 패키징당 수량 = 수량 ÷ 패키징 수).
 */
export interface ItemLotDefault {
  lotQty: number;
  package: { uomId: number; count: number; qtyPerPackage: number } | null;
}

/** 품목 마스터에서 LOT 기본값을 셈하는 데 쓰는 칸. */
export interface ItemLotFields {
  baseUomId: number;
  defaultLotStorageUomId?: number | null;
  defaultProductionLotSize?: number | null;
  defaultPackageUomId?: number | null;
  defaultPackageCount?: number | null;
}

/** 소수 여섯 자리 — 환산 · 나눗셈 찌꺼기를 걷는다. */
const round6 = (value: number): number => Math.round(value * 1e6) / 1e6;

/**
 * 품목 마스터 → LOT 기본값(서버 자동 생성과 같은 규칙 · 계약 `lotDefaults`). 보관 단위 · 기본크기가 없으면 없다
 * (`NO_DEFAULT`). 보관 단위가 기본 단위와 다르면 `storageRate`(보관 단위 1 = 기본 단위 몇)로 바꾸고, 환산이
 * 없으면 없다(`NO_CONVERSION`).
 */
export const itemLotDefaultOf = (
  item: ItemLotFields,
  storageRate: number | null,
): ItemLotDefault | null => {
  const storageUomId = item.defaultLotStorageUomId ?? null;
  const size = item.defaultProductionLotSize ?? null;

  if (storageUomId === null || size === null || !(size > 0)) return null;

  let lotQty = size;

  if (storageUomId !== item.baseUomId) {
    if (storageRate === null || !(storageRate > 0)) return null;
    lotQty = round6(size * storageRate);
  }

  const packageUomId = item.defaultPackageUomId ?? null;
  const packageCount = item.defaultPackageCount ?? null;

  return {
    lotQty,
    package:
      packageUomId === null || packageCount === null || packageCount < 1
        ? null
        : {
            uomId: packageUomId,
            count: packageCount,
            qtyPerPackage: round6(lotQty / packageCount),
          },
  };
};

/** 품목 기본 보관 단위 — 품목 마스터 `defaultLotStorageUomId` 와 그 단위의 품목 환산(있으면). */
export interface ItemStorageUnit {
  uomId: number;
  /** 보관 단위 1개에 든 기본 단위 수량 — 품목 환산이 없으면 null. */
  qtyPerPackage: number | null;
}

/** 창의 입력 칸 — 글 그대로 둔다(빈 칸 · 쓰는 중인 값을 지우지 않는다). */
export interface BatchDraft {
  packageOn: boolean;
  packageUomId: number | null;
  packageCount: string;
  qtyPerPackage: string;
  lotQty: string;
  /**
   * 재고 수량을 사람이 직접 고쳤는가. 고치지 않았으면 패키징 곱으로 따라 채운다 — 고쳤으면 그 값을 두고 곱과
   * 다르면 막는다(「직접 고치면 곱과 같아야 합니다」).
   */
  lotQtyEdited: boolean;
  supplierLotNo: string;
  lotCount: string;
}

export interface BatchPrefill {
  source: BatchSource;
  draft: BatchDraft;
  /** 기본 정보가 「패키징 없음」이다 — 창이 「필요하면 넣을 수 있습니다」를 말한다. */
  defaultWithoutPackage: boolean;
}

const EMPTY_DRAFT: BatchDraft = {
  packageOn: false,
  packageUomId: null,
  packageCount: '',
  qtyPerPackage: '',
  lotQty: '',
  lotQtyEdited: false,
  supplierLotNo: '',
  lotCount: '',
};

const text = (value: number): string => String(value);

/** 기본값으로 창을 채운다(US1-1 · US1-3 · 피처 014 FR-019 — 품목 기본값 먼저). */
export const prefillBatch = (
  itemDefault: ItemLotDefault | null,
  defaults: SupplierItemDefault | null,
  storage: ItemStorageUnit | null,
): BatchPrefill => {
  if (itemDefault !== null) {
    const pkg = itemDefault.package;

    return {
      source: 'item',
      defaultWithoutPackage: pkg === null,
      draft: {
        ...EMPTY_DRAFT,
        packageOn: pkg !== null,
        packageUomId: pkg?.uomId ?? storage?.uomId ?? null,
        packageCount: pkg === null ? '' : text(pkg.count),
        qtyPerPackage: pkg === null ? '' : text(pkg.qtyPerPackage),
        lotQty: text(itemDefault.lotQty),
        lotQtyEdited: pkg === null,
      },
    };
  }

  if (defaults !== null) {
    const pkg = defaults.package;

    return {
      source: 'default',
      defaultWithoutPackage: pkg === null,
      draft: {
        ...EMPTY_DRAFT,
        packageOn: pkg !== null,
        packageUomId: pkg?.uomId ?? storage?.uomId ?? null,
        packageCount: pkg === null ? '' : text(pkg.count),
        qtyPerPackage: pkg === null ? '' : text(pkg.qtyPerPackage),
        lotQty: text(defaults.lotQty),
        /* 패키징이 없으면 재고 수량이 곧 기본 정보 값이다 — 곱으로 덮지 않는다. */
        lotQtyEdited: pkg === null,
      },
    };
  }

  if (storage !== null) {
    return {
      source: 'itemStorage',
      defaultWithoutPackage: false,
      draft: {
        ...EMPTY_DRAFT,
        packageOn: true,
        packageUomId: storage.uomId,
        qtyPerPackage: storage.qtyPerPackage === null ? '' : text(storage.qtyPerPackage),
      },
    };
  }

  return { source: 'none', defaultWithoutPackage: false, draft: EMPTY_DRAFT };
};

/** 칸마다의 잘못 — 화면이 자기 문구로 옮긴다. */
export interface BatchErrors {
  packageCount?: 'invalid';
  qtyPerPackage?: 'invalid';
  packageUom?: 'required';
  lotQty?: 'required' | 'integer';
  /** 재고 수량 ≠ 패키징 곱 — 계산 줄이 빨갛게 서고 만들기가 잠긴다. */
  mismatch?: true;
  lotCount?: 'range';
}

export interface BatchCheck {
  /** 실제로 보낼 재고 수량 — 곱을 따라가는 중이면 곱. */
  lotQty: number | null;
  package: MaterialPackageInput | null;
  /** 패키징 곱(패키징 칸이 맞으면). */
  product: number | null;
  lotCount: number | null;
  supplierLotNo: string | null;
  errors: BatchErrors;
  ok: boolean;
}

/** 한 번에 만드는 개수(계약 §1 `lotCount` 1~200). */
export const MAX_LOT_COUNT = 200;

/**
 * 창의 값을 검사한다(screens/P-01-01.md 「입력·검증」). `integerOnly` 는 기본 단위가 정수로 세는 단위인가
 * (단위의 소수 자릿수 0 — EA 등).
 */
export const checkBatch = (draft: BatchDraft, integerOnly: boolean): BatchCheck => {
  const errors: BatchErrors = {};
  let pkg: MaterialPackageInput | null = null;
  let product: number | null = null;

  if (draft.packageOn) {
    const count = parseQtyInput(draft.packageCount);
    const per = parseQtyInput(draft.qtyPerPackage);

    if (draft.packageUomId === null) errors.packageUom = 'required';
    if (count === null || !Number.isInteger(count) || count < 1) errors.packageCount = 'invalid';
    if (per === null || !(per > 0)) errors.qtyPerPackage = 'invalid';

    if (
      count !== null &&
      per !== null &&
      errors.packageCount === undefined &&
      errors.qtyPerPackage === undefined
    ) {
      product = packageProduct(count, per);
      if (draft.packageUomId !== null) {
        pkg = { uomId: draft.packageUomId, count, qtyPerPackage: per };
      }
    }
  }

  const typed = parseQtyInput(draft.lotQty);
  const lotQty = draft.packageOn && !draft.lotQtyEdited && product !== null ? product : typed;

  if (lotQty === null || !(lotQty > 0)) errors.lotQty = 'required';
  else if (integerOnly && !Number.isInteger(lotQty)) errors.lotQty = 'integer';
  else if (pkg !== null && !matchesPackage(lotQty, { uomCode: '', ...pkg })) errors.mismatch = true;

  const lotCount = parseQtyInput(draft.lotCount);

  if (
    lotCount === null ||
    !Number.isInteger(lotCount) ||
    lotCount < 1 ||
    lotCount > MAX_LOT_COUNT
  ) {
    errors.lotCount = 'range';
  }

  const supplierLotNo = draft.supplierLotNo.trim();

  return {
    lotQty,
    package: pkg,
    product,
    lotCount,
    supplierLotNo: supplierLotNo === '' ? null : supplierLotNo,
    errors,
    ok: Object.keys(errors).length === 0,
  };
};

/** 발행 본문(계약 §1). 검사를 통과한 값만 받는다. */
export const toBatchBody = (
  check: BatchCheck,
  target: { plantId: number; supplierId: number; itemId: number },
  now: Date = new Date(),
): MaterialLotBatchCreate | null => {
  if (!check.ok || check.lotQty === null || check.lotCount === null) return null;

  return {
    plantId: target.plantId,
    supplierId: target.supplierId,
    itemId: target.itemId,
    lotQty: check.lotQty,
    package: check.package,
    supplierLotNo: check.supplierLotNo,
    lotCount: check.lotCount,
    businessDate: plantToday(now),
    occurredAt: now.toISOString(),
  };
};

/**
 * 번호 예(요약 칸) — 자재 MES 규칙 `품목|수량|YYMMDD|공급사|NNNN`(계약 §1). 일련번호는 서버가 매기므로
 * 화면은 앞 네 칸만 보이고 끝은 `NNNN` 으로 둔다.
 */
export const lotNoPattern = (
  itemCode: string,
  lotQty: number,
  supplierCode: string,
  today: string,
): string =>
  `${itemCode}|${String(lotQty)}|${today.slice(2, 4)}${today.slice(5, 7)}${today.slice(8, 10)}|${supplierCode}|NNNN`;

const batchKeys = {
  defaults: (plantId: number, supplierId: number, itemId: number) =>
    ['material-lot-batch', 'defaults', plantId, supplierId, itemId] as const,
  basis: (itemId: number) => ['material-lot-batch', 'item-lot-basis', itemId] as const,
};

/** 품목 하나에서 읽는 두 가지 — 보관 단위(패키징 단위 처음 값)와 LOT 기본값(피처 014). */
interface ItemLotBasis {
  storage: ItemStorageUnit | null;
  lotDefault: ItemLotDefault | null;
}

/**
 * 고른 공급사·품목의 기본 정보(계약 §9 — 그 조합 하나).
 * ⚠ 기본 정보가 없는 것과 못 읽은 것은 다르다 — 못 읽었으면 `isError` 로 창이 말하고 직접 입력을 막지 않는다.
 */
export const useSupplierItemDefault = (
  target: { plantId: number; supplierId: number; itemId: number } | null,
) => {
  const { client } = useApiClient();

  return useQuery({
    queryKey:
      target === null
        ? ['material-lot-batch', 'defaults', 'none']
        : batchKeys.defaults(target.plantId, target.supplierId, target.itemId),
    enabled: target !== null,
    queryFn: async (): Promise<SupplierItemDefault | null> => {
      if (target === null) return null;
      const data = await runRequest(() =>
        client.GET('/mdm/supplier-item-defaults', {
          params: {
            query: {
              plantId: target.plantId,
              supplierId: target.supplierId,
              itemId: target.itemId,
            },
          },
        }),
      );

      return (
        data.items.find(
          (row) => row.supplierId === target.supplierId && row.itemId === target.itemId,
        ) ?? null
      );
    },
  });
};

/**
 * 품목 기본 보관 단위(품목 마스터 `defaultLotStorageUomId`)와 그 단위의 패키징당 수량(품목 환산 — 보관 단위 →
 * 기본 단위), 그리고 품목 LOT 기본값(피처 014 — 자재 LOT 기본크기 · 패키징 기본값). 품목 · 환산을 한 번 읽어
 * 두 훅이 나눠 쓴다. 환산이 없으면 보관 단위는 단위만 채우고(FR-002 「패키징 단위로만 채우고」) LOT 기본값은 없다.
 */
const useItemLotBasis = <T>(itemId: number | null, select: (basis: ItemLotBasis | null) => T) => {
  const { client } = useApiClient();

  return useQuery({
    queryKey:
      itemId === null ? ['material-lot-batch', 'item-lot-basis', 'none'] : batchKeys.basis(itemId),
    enabled: itemId !== null,
    select,
    queryFn: async (): Promise<ItemLotBasis | null> => {
      if (itemId === null) return null;
      const data = await runRequest(() =>
        client.GET('/mdm/items/{itemId}', { params: { path: { itemId } } }),
      );
      const storageUomId = data.item.defaultLotStorageUomId ?? null;
      const baseUomId = data.item.baseUomId;

      if (storageUomId === null || storageUomId === baseUomId) {
        return { storage: null, lotDefault: itemLotDefaultOf(data.item, null) };
      }

      let qtyPerPackage: number | null = null;

      try {
        const conversions = await runRequest(() =>
          client.GET('/mdm/items/{itemId}/uom-conversions', { params: { path: { itemId } } }),
        );
        const today = plantToday();
        const live = conversions.items.filter(
          (row) =>
            row.effectiveFrom <= today &&
            (row.effectiveTo === null || row.effectiveTo === undefined || row.effectiveTo >= today),
        );
        const forward = live.find(
          (row) => row.fromUomId === storageUomId && row.toUomId === baseUomId,
        );
        const backward = live.find(
          (row) => row.fromUomId === baseUomId && row.toUomId === storageUomId,
        );

        qtyPerPackage =
          forward !== undefined
            ? forward.conversionRate
            : backward !== undefined && backward.conversionRate > 0
              ? Math.round((1 / backward.conversionRate) * 1e6) / 1e6
              : null;
      } catch {
        /* 환산을 못 읽었다 — 단위만 채운다. */
      }

      return {
        storage: { uomId: storageUomId, qtyPerPackage },
        lotDefault: itemLotDefaultOf(data.item, qtyPerPackage),
      };
    },
  });
};

const selectStorage = (basis: ItemLotBasis | null): ItemStorageUnit | null =>
  basis?.storage ?? null;
const selectLotDefault = (basis: ItemLotBasis | null): ItemLotDefault | null =>
  basis?.lotDefault ?? null;

export const useItemStorageUnit = (itemId: number | null) => useItemLotBasis(itemId, selectStorage);

/** 품목 LOT 기본값(피처 014 FR-019) — 수동 [만들기] 창의 첫째 처음 값. */
export const useItemLotDefault = (itemId: number | null) =>
  useItemLotBasis(itemId, selectLotDefault);

/** 단위 목록(패키징 단위 고르기 · 기본 단위 소수 자릿수) — `GET /mdm/uoms`. */
export interface UomOption {
  uomId: number;
  uomCode: string;
  uomName: string;
  decimalScale: number;
}

export const useUomOptions = () => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: ['material-lot-batch', 'uoms'],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<UomOption[]> => {
      const data = await runRequest(() => client.GET('/mdm/uoms', { params: { query: {} } }));

      return data.items.map((row) => ({
        uomId: row.uomId,
        uomCode: row.uomCode,
        uomName: row.uomName,
        decimalScale: row.decimalScale,
      }));
    },
  });
};

/** 기본 단위가 정수로만 세는가 — 소수 자릿수 0. 단위를 모르면 EA 만 정수로 본다. */
export const isIntegerUom = (uoms: readonly UomOption[] | undefined, uomCode: string): boolean => {
  const found = uoms?.find((row) => row.uomCode === uomCode);

  return found === undefined ? uomCode === 'EA' : found.decimalScale === 0;
};
