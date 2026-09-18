import { buildLotLabel, type LotLabelRow } from '../pop-material-lot-label/label-tspl';

/**
 * 창고 적재 위치 라벨 — **POP 이 80 × 30 mm 규격으로 직접 짠다**(사용자 지시 2026-09-18 · #1344).
 *
 * ⭐ **왜 서버가 그린 것을 쓰지 않는가.** 서버 렌디션은 100 × 60 mm 좌표라, 현장 프린터에 걸린
 *   80 × 30 mm 라벨지에 맞지 않았다(실기 2026-09-18 · 사용자 확인). 자재·생산 LOT 라벨이 같은
 *   이유로 먼저 옮겨 간 자리다.
 *
 * ⛔ **여백·QR 자리·글줄 칸을 여기서 다시 정하지 않는다.** 전부 `buildLotLabel` 이 가진다 —
 *    HT800 실기에서 맞춘 값이라 베껴 두면 다음에 한쪽만 고쳐져 갈라진다.
 *
 * ⛔ **QR 에는 위치 코드만 싣는다.** 모바일 적치·이동 화면이 스캔 값을 그대로 위치 코드 조회에
 *    넣는다 — 창고를 덧붙이면 조회가 0건이 된다(서버 판과 같은 규칙).
 *
 * ⚠ **위치명이 ASCII 밖이어도 줄을 빼지 않는다** — 못 그리는 글자만 `?` 로 찍힌다(`docs/decisions.md`
 *   결정 17 · 사용자 확정 2026-09-16). 칸 수를 지키고 못 그린 자리를 눈에 보이게 남긴다.
 */
export interface LocationLabelFields {
  warehouseCode: string;
  locationCode: string;
  locationName: string;
  /** 발행 회차. */
  issueSeq: number;
}

/**
 * 위치 라벨 한 장.
 *
 * ```
 * WH WH-01                      ┌────┐
 * S230-01                       │ QR │
 * RACK A LEVEL 1                │    │
 * ISSUE NO. 1                   └────┘
 * ```
 */
export const buildLocationLabel = (fields: LocationLabelFields): string => {
  const rows: LotLabelRow[] = [
    { point: 8, content: `WH ${fields.warehouseCode}` },
    /* 현장이 선반 앞에서 읽는 줄이라 가장 크게 찍는다. */
    { point: 16, content: fields.locationCode },
    { point: 8, content: fields.locationName },
    { point: 8, content: `ISSUE NO. ${String(fields.issueSeq)}` },
  ];

  return buildLotLabel(rows, fields.locationCode);
};
