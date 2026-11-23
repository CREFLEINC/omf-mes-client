/**
 * 하이픈에서 줄이 꺾이지 않게 — 「【30100-001WHR】」 같은 품목 번호가 「30100-」 / 「001WHR】」 로 갈리지 않는다.
 * 줄은 낱말 사이에서만 꺾인다(사용자 지시 2026-11-20 「품목코드와 품목명이 짤리지 않고」).
 */
export const keepHyphens = (text: string): string => text.replace(/-/gu, '‑');
