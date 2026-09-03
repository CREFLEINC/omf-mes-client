/**
 * LOT 번호를 **읽을 수 있게 끊어 보인다.**
 *
 * 스펙 §3-3 이 실측으로 짚은 자리다 — 34자리가 구분문자 없이 이어져 있으면 작업자가 실물
 * 라벨과 화면을 **눈으로 맞출 수 없다.** 끊는 자리는 뜻의 경계라 조각마다 무엇인지 알아볼 수
 * 있다(제품코드 9 · 수량 9 · 날짜 6 · 공급사 6 · 일련 4 — MLOT #16 ✓확정).
 *
 * ⛔ **보내는 값을 바꾸지 않는다.** 끊는 것은 보이기 위한 것이고, 서버로 가는 값에는 공백이
 * 없다. 이 함수의 결과를 요청 본문에 싣지 않는다.
 *
 * ⛔ **형식이 아니면 원문을 그대로 낸다.** 이 화면의 대상은 생산 LOT 이라 34자리 규칙이
 * 걸리지 않을 수 있다 — 그때는 끊지 않고 그대로 보인다. 화면이 삼키면 서버가 무엇을 보냈는지
 * 알 수 없다(공유계약 G-9).
 *
 * ⚠ **`P-01-01` 의 같은 규칙을 사본으로 갖는다** — 화면 슬라이스를 사본으로 소유하는 것이 이
 * 저장소의 관례이고, 표시 규칙이 공유 계약으로 확정되면(§9-6) 그때 한 자리로 모은다.
 */

const LOT_NO_SEGMENTS = [9, 9, 6, 6, 4] as const;

const LOT_NO_LENGTH = LOT_NO_SEGMENTS.reduce((sum, size) => sum + size, 0);

/** 34자리 전부가 숫자여야 한다 — 계약이 「전부 숫자」로 못박았다. */
const LOT_NO_PATTERN = /^\d+$/u;

export const formatLotNo = (value: string): string => {
  if (value.length !== LOT_NO_LENGTH || !LOT_NO_PATTERN.test(value)) return value;

  let cursor = 0;

  return LOT_NO_SEGMENTS.map((size) => {
    const piece = value.slice(cursor, cursor + size);
    cursor += size;

    return piece;
  }).join(' ');
};
