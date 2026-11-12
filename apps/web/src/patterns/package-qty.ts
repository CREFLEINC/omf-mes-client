/**
 * 자재 관리 LOT 의 **재고 수량 · 패키징 표기**(005 · omf-all-around#254 · FR-002·003·007).
 *
 * 발행 화면(POP P-01-01 · 관리웹 W-01-14) · 기본 정보(W-06-25) · 라벨이 같은 글을 쓰도록 한 자리에 둔다.
 * 「봉지 10 × 100 = 1,000 EA」 — 패키징 단위 · 패키징 수 × 패키징당 수량 = 재고 수량 기본 단위.
 *
 * ⭐ 재고 수량의 단위는 언제나 품목 기본 단위다(FR-002). 패키징은 표기와 곱 검사에만 쓴다.
 */

/** 표기에 필요한 패키징 값 — 계약 `package{uomCode, count, qtyPerPackage}` 그대로. */
export interface PackageQty {
  uomCode: string;
  count: number;
  qtyPerPackage: number;
}

/** 소수 여섯 자리까지 — 곱에서 생기는 부동소수 찌꺼기(0.1 × 3)를 걷는다. */
const PRECISION = 1e6;

/** 수량 글 — 천 단위 쉼표, 소수는 있으면 여섯 자리까지. */
export const formatQty = (qty: number): string =>
  qty.toLocaleString('ko-KR', { maximumFractionDigits: 6 });

/** 패키징 곱 — 「패키징 수 × 패키징당 수량」. */
export const packageProduct = (count: number, qtyPerPackage: number): number =>
  Math.round(count * qtyPerPackage * PRECISION) / PRECISION;

/** 재고 수량이 패키징 곱과 같은가(FR-003). 패키징이 없으면 늘 참이다. */
export const matchesPackage = (lotQty: number, pkg: PackageQty | null): boolean =>
  pkg === null ||
  Math.round(lotQty * PRECISION) / PRECISION === packageProduct(pkg.count, pkg.qtyPerPackage);

/** 「봉지 10 × 100」 — 패키징이 없으면 null. */
export const formatPackage = (pkg: PackageQty | null): string | null =>
  pkg === null ? null : `${pkg.uomCode} ${formatQty(pkg.count)} × ${formatQty(pkg.qtyPerPackage)}`;

/** 「1,000 EA」 — 단위를 모르면 수량만. */
export const formatBaseQty = (qty: number, uomCode: string | null): string =>
  uomCode === null || uomCode === '' ? formatQty(qty) : `${formatQty(qty)} ${uomCode}`;

/**
 * 「봉지 10 × 100 = 1,000 EA」 — 패키징이 없으면 기본 단위 수량만(「1,000 EA」).
 */
export const formatPackageQty = (
  lotQty: number,
  uomCode: string | null,
  pkg: PackageQty | null,
): string => {
  const base = formatBaseQty(lotQty, uomCode);
  const packaged = formatPackage(pkg);

  return packaged === null ? base : `${packaged} = ${base}`;
};

/**
 * 기본 정보(재고 수량 · 패키징당 수량)에서 패키징 수를 구한다 — 재고 수량이 패키징당 수량의 정수배일 때만.
 * W-06-25 는 패키징당 수량과 재고 수량을 받고 `count` 를 이것으로 보낸다(screens/W-06-25.md).
 */
export const packageCountOf = (lotQty: number, qtyPerPackage: number): number | null => {
  if (!(qtyPerPackage > 0) || !(lotQty > 0)) return null;

  const count = Math.round((lotQty / qtyPerPackage) * PRECISION) / PRECISION;

  return Number.isInteger(count) ? count : null;
};

/** 입력 칸의 글을 수로 — 쉼표를 걷고, 비었거나 수가 아니면 null. */
export const parseQtyInput = (value: string): number | null => {
  const trimmed = value.replace(/,/g, '').trim();

  if (trimmed === '') return null;

  const parsed = Number(trimmed);

  return Number.isFinite(parsed) ? parsed : null;
};

/** 정수로만 세는 단위 — 「EA는 정수로 넣습니다」(screens/P-01-01.md 입력·검증). */
export const isCountUom = (uomCode: string | null): boolean => uomCode === 'EA';
