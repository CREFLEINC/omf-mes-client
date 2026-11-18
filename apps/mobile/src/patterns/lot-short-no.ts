import { parseMaterialLotNo, type MaterialLotSegments } from './material-lot-no';

/** 짧은 표시의 차례 — 일련번호만, 겹치면 날짜, 그래도 겹치면 수량 칸을 앞에 붙인다. */
const SHAPES: readonly ((segments: MaterialLotSegments) => string)[] = [
  (segments) => segments.serial,
  (segments) => `${segments.date}|${segments.serial}`,
  (segments) => `${segments.qty}|${segments.date}|${segments.serial}`,
];

/**
 * 한 목록 안에서 자재 관리 LOT 을 서로 가를 수 있는 가장 짧은 표시 — 보통 끝 일련번호(「0002」).
 *
 * 입하 LOT 은 공급사 · 품목 하나에 묶여 있어 번호 앞 칸(품목 · 공급사)은 카드 머리에 이미 있다(사용자 지시
 * 2026-11-18 「자재 관리 LOT 번호 대신 표시」). 형식이 아닌 번호가 하나라도 끼면 모두 번호 전체를 쓴다.
 * 번호 전체는 공급사 LOT 시트 · 해제 확인 창 · 단추 이름에 남는다.
 */
export const shortLotNos = (lotNos: readonly string[]): ReadonlyMap<string, string> => {
  const full = new Map(lotNos.map((lotNo) => [lotNo, lotNo]));
  const parsed = lotNos.map((lotNo) => parseMaterialLotNo(lotNo));

  if (parsed.some((segments) => segments === null)) return full;

  for (const shape of SHAPES) {
    const shorts = parsed.map((segments) => shape(segments as MaterialLotSegments));

    if (new Set(shorts).size === shorts.length) {
      return new Map(lotNos.map((lotNo, index) => [lotNo, shorts[index] as string]));
    }
  }

  return full;
};
