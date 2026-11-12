import type {
  ApiError,
  MaterialPackageInput,
  SupplierItemDefault,
  SupplierItemDefaultCreate,
  SupplierItemDefaultUpdate,
} from '@omf-mes/api-client';

import { formatPlantDateTime } from '../../patterns/plant-time';
import { packageCountOf, parseQtyInput } from '../../patterns/package-qty';

/**
 * W-06-25 공급사·품목 기본 정보가 읽고 쓰는 모양 — 선행 계약(`forward-contract.ts`, 설계 계약 §9)의 별칭.
 * 서버 S3 병합 뒤 `gen:api` 생성 타입으로 바꾼다(T111).
 */
export type { SupplierItemDefault, SupplierItemDefaultCreate, SupplierItemDefaultUpdate };

/** 수정 · 추가 창의 입력 칸 — 글 그대로 둔다. `packageUomId` 가 빈 글이면 패키징 없음. */
export interface DefaultDraft {
  supplierId: string;
  itemId: string;
  packageUomId: string;
  qtyPerPackage: string;
  lotQty: string;
  remarks: string;
}

export const EMPTY_DRAFT: DefaultDraft = {
  supplierId: '',
  itemId: '',
  packageUomId: '',
  qtyPerPackage: '',
  lotQty: '',
  remarks: '',
};

/** 고칠 행을 창 칸으로. */
export const draftOf = (row: SupplierItemDefault): DefaultDraft => ({
  supplierId: String(row.supplierId),
  itemId: String(row.itemId),
  packageUomId: row.package === null ? '' : String(row.package.uomId),
  qtyPerPackage: row.package === null ? '' : String(row.package.qtyPerPackage),
  lotQty: String(row.lotQty),
  remarks: row.remarks ?? '',
});

/** 창의 잘못 하나 — 위에서부터 먼저 걸린 것만 말한다(시안 「오류 줄」). */
export type DraftError =
  | { kind: 'pick' }
  | { kind: 'duplicate' }
  | { kind: 'qtyPerPackage' }
  | { kind: 'lotQty' }
  | { kind: 'integer' }
  | { kind: 'multiple'; lotQty: number; qtyPerPackage: number };

export interface DraftCheckOptions {
  /** 기본 단위가 정수로만 세는가(소수 자릿수 0 — EA 등). */
  integerOnly: boolean;
  /** 이 공장에 같은 공급사·품목이 이미 있는가(추가 창만). */
  isDuplicate: boolean;
}

/**
 * 창 값 검사(screens/W-06-25.md 「입력·검증」). 순서: 고르기 → 중복 → 패키징 수량 → 재고 수량 → 정수 단위 → 정수배.
 */
export const checkDraft = (draft: DefaultDraft, options: DraftCheckOptions): DraftError | null => {
  if (draft.supplierId === '' || draft.itemId === '') return { kind: 'pick' };
  if (options.isDuplicate) return { kind: 'duplicate' };

  const hasPackage = draft.packageUomId !== '';
  const per = parseQtyInput(draft.qtyPerPackage);
  const lot = parseQtyInput(draft.lotQty);

  if (hasPackage && (per === null || !(per > 0))) return { kind: 'qtyPerPackage' };
  if (lot === null || !(lot > 0)) return { kind: 'lotQty' };
  if (
    options.integerOnly &&
    (!Number.isInteger(lot) || (hasPackage && per !== null && !Number.isInteger(per)))
  ) {
    return { kind: 'integer' };
  }
  if (hasPackage && per !== null && packageCountOf(lot, per) === null) {
    return { kind: 'multiple', lotQty: lot, qtyPerPackage: per };
  }

  return null;
};

/** 패키징 본문 — 화면은 패키징 수량 · 재고 수량을 받고 `count` = 재고 수량 ÷ 패키징 수량으로 보낸다. */
export const packageOf = (draft: DefaultDraft): MaterialPackageInput | null => {
  if (draft.packageUomId === '') return null;

  const per = parseQtyInput(draft.qtyPerPackage);
  const lot = parseQtyInput(draft.lotQty);
  const count = per === null || lot === null ? null : packageCountOf(lot, per);

  return per === null || count === null
    ? null
    : { uomId: Number(draft.packageUomId), count, qtyPerPackage: per };
};

const remarksOf = (draft: DefaultDraft): string | null => {
  const trimmed = draft.remarks.trim();

  return trimmed === '' ? null : trimmed;
};

export const toCreateBody = (draft: DefaultDraft, plantId: number): SupplierItemDefaultCreate => ({
  plantId,
  supplierId: Number(draft.supplierId),
  itemId: Number(draft.itemId),
  lotQty: parseQtyInput(draft.lotQty) ?? 0,
  package: packageOf(draft),
  remarks: remarksOf(draft),
});

export const toUpdateBody = (
  draft: DefaultDraft,
  versionNo: number,
): SupplierItemDefaultUpdate => ({
  versionNo,
  lotQty: parseQtyInput(draft.lotQty) ?? 0,
  package: packageOf(draft),
  remarks: remarksOf(draft),
});

/** 「바꾼 때」 — `MM-DD HH:mm`(공장 시각). */
export const formatUpdatedAt = (value: string): string =>
  formatPlantDateTime(value)?.slice(5) ?? value;

/** 공급사 · 품목 찾기 칸 — 이름 · 코드에 들어 있으면 맞다(대소문자 무시). */
export const matchesFilter = (
  row: SupplierItemDefault,
  supplier: string,
  item: string,
): boolean => {
  const has = (haystack: string, needle: string): boolean =>
    needle.trim() === '' ||
    haystack.toLocaleLowerCase('ko-KR').includes(needle.trim().toLocaleLowerCase('ko-KR'));

  return (
    has(`${row.supplierCode} ${row.supplierName}`, supplier) &&
    has(`${row.itemCode} ${row.itemName}`, item)
  );
};

/** 서버 오류 코드를 본다 — 409(conflict) · 400(validation) 모두. */
export const hasErrorCode = (error: ApiError | null, code: string): boolean => {
  if (error === null) return false;
  switch (error.kind) {
    case 'validation':
    case 'stateLocked':
      return error.errors.some((item) => item.code === code);
    case 'conflict':
    case 'http':
      return error.code === code;
    default:
      return false;
  }
};
