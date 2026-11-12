import type { MaterialPackage } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

/**
 * 패키징 수 ⇄ 기본 단위 환산과 표기(005 US6 · FR-033·034 · SC-007).
 *
 * ⭐ 보내는 값은 늘 기본 단위다 — 패키징은 화면이 사람에게 보이는 말일 뿐이다. 서버 본문은 바뀌지
 *    않고, 패키징 수로 넣은 값은 「패키징 수 × 패키징당 수량」으로 바꿔 싣는다(SC-007).
 * ⭐ 패키징 단위 이름은 받은 이름(`uomName`), 없으면 단위 코드다.
 */

const t = messages.materialPicking.pack;

/** 화면이 환산에 쓰는 패키징 — 단위 이름과 패키징 하나의 수량(기본 단위). */
export interface PackageUnit {
  unitName: string;
  qtyPerPackage: number;
}

/** 입력 단위 — 기본 단위(EA 등) 또는 이 LOT 의 패키징. 화면은 늘 기본 단위로 연다(US6-4). */
export type EntryUnit = 'base' | 'package';

export const BASE_UNIT: EntryUnit = 'base';

/** 응답의 패키징을 환산할 수 있는 모양으로. 없거나 수량이 0 이하면 null — 단위 선택을 세우지 않는다(US6-3). */
export const packageUnitOf = (pkg: MaterialPackage | null | undefined): PackageUnit | null => {
  if (pkg === null || pkg === undefined || !(pkg.qtyPerPackage > 0)) {
    return null;
  }

  const name = pkg.uomName?.trim() ?? '';

  return { unitName: name === '' ? pkg.uomCode : name, qtyPerPackage: pkg.qtyPerPackage };
};

/*
 * 소수 패키징 수량(예: 0.1 kg)을 곱하면 이진 소수 오차가 붙는다(3 × 0.1 = 0.30000000000000004).
 * 그 값을 그대로 보내면 서버가 받은 양이 화면이 보인 양과 어긋난다 — 여섯 자리에서 맞춘다.
 */
const tidy = (value: number): number => Math.round(value * 1e6) / 1e6;

/** 패키징 수 → 기본 단위 수량(SC-007). */
export const packagesToBase = (count: number, unit: PackageUnit): number =>
  tidy(count * unit.qtyPerPackage);

/** 온전한 패키징 수. */
export const wholePackagesOf = (qty: number, unit: PackageUnit): number =>
  Math.floor(tidy(qty / unit.qtyPerPackage));

/** 「7봉지」 · 「6봉지 + 50」 · 온전한 패키징이 없으면 「낱개 50」(FR-034). */
export const packageText = (qty: number, unit: PackageUnit): string => {
  const whole = wholePackagesOf(qty, unit);
  const loose = tidy(qty - whole * unit.qtyPerPackage);

  if (whole === 0) {
    return t.looseOnly(String(loose));
  }

  return loose === 0
    ? t.count(String(whole), unit.unitName)
    : t.countWithLoose(String(whole), unit.unitName, String(loose));
};

/** 「700 EA (7봉지)」 — 패키징이 없으면 기본 단위만 「25 KG」. */
export const qtyText = (qty: number, uom: string, unit: PackageUnit | null): string =>
  unit === null
    ? t.qty(String(qty), uom)
    : t.qtyWithPackages(String(qty), uom, packageText(qty, unit));

/** 넣은 값의 표기 — 패키징이면 「3봉지」, 기본 단위면 「50 EA」. */
export const enteredText = (
  entered: number,
  entryUnit: EntryUnit,
  uom: string,
  unit: PackageUnit | null,
): string =>
  entryUnit === 'package' && unit !== null
    ? t.count(String(entered), unit.unitName)
    : t.qty(String(entered), uom);

/** 확정 전 환산 「3봉지 = 300 EA」. */
export const conversionText = (count: number, unit: PackageUnit, uom: string): string =>
  t.conversion(t.count(String(count), unit.unitName), String(packagesToBase(count, unit)), uom);

export type PackageQtyProblem =
  'notNumber' | 'notPositive' | 'notInteger' | 'overPackages' | 'overPlanned';

export interface PackageQtyCheck {
  /** 보낼 기본 단위 수량. 숫자가 아니면 0. */
  baseQty: number;
  problem: PackageQtyProblem | null;
}

/**
 * 넣은 값을 기본 단위로 바꾸고 막을 것을 가린다.
 *
 * - 패키징 수는 정수만, 남은 **온전한** 패키징 수를 넘을 수 없다(재고를 모르면 이 검사는 서지 않는다 —
 *   최종 판정은 서버다).
 * - 남은 요청 수량 검사는 기본 단위로 환산해서 한다.
 */
export const checkEntry = (input: {
  text: string;
  entryUnit: EntryUnit;
  unit: PackageUnit | null;
  /** 남은 요청 수량(기본 단위). */
  remaining: number;
  /** 지금 LOT 재고(기본 단위). 모르면 null. */
  stock: number | null;
}): PackageQtyCheck => {
  const trimmed = input.text.trim();
  const value = Number(trimmed);

  if (trimmed === '' || !Number.isFinite(value)) {
    return { baseQty: 0, problem: 'notNumber' };
  }

  if (value <= 0) {
    return { baseQty: 0, problem: 'notPositive' };
  }

  const byPackage = input.entryUnit === 'package' && input.unit !== null;

  if (byPackage && !Number.isInteger(value)) {
    return { baseQty: 0, problem: 'notInteger' };
  }

  const baseQty = byPackage && input.unit !== null ? packagesToBase(value, input.unit) : value;

  if (
    byPackage &&
    input.unit !== null &&
    input.stock !== null &&
    value > wholePackagesOf(input.stock, input.unit)
  ) {
    return { baseQty, problem: 'overPackages' };
  }

  return { baseQty, problem: baseQty > input.remaining ? 'overPlanned' : null };
};

/** 남은 재고를 넘는가(기본 단위). 재고를 모르면 넘지 않은 것으로 둔다 — 판정은 서버가 한다. */
export const exceedsStock = (baseQty: number, stock: number | null): boolean =>
  stock !== null && baseQty > stock;
