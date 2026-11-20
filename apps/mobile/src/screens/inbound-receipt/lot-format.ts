/** 수량 글 — 천 단위 쉼표, 소수는 여섯 자리까지. */
export const qtyText = (qty: number, uomCode: string): string =>
  `${qty.toLocaleString('ko-KR', { maximumFractionDigits: 6 })} ${uomCode}`;

/** 수량 숫자만 — 단위는 작게 따로 붙인다. */
export const qtyNumber = (qty: number): string =>
  qty.toLocaleString('ko-KR', { maximumFractionDigits: 6 });

/** 패키징 단위 — 이름이 있으면 이름(「봉지」), 없으면 코드(G1 잔여). */
export const packageUnitOf = (pkg: { uomCode: string; uomName?: string | null }): string => {
  const name = pkg.uomName?.trim() ?? '';

  return name === '' ? pkg.uomCode : name;
};

/**
 * 하이픈에서 줄이 꺾이지 않게 — 「【30100-001WHR】」 같은 품목 번호가 「30100-」 / 「001WHR】」 로 갈리지 않는다.
 * 줄은 낱말 사이에서만 꺾인다(사용자 지시 2026-11-20 「품목코드와 품목명이 짤리지 않고」).
 */
export const keepHyphens = (text: string): string => text.replace(/-/gu, '‑');
