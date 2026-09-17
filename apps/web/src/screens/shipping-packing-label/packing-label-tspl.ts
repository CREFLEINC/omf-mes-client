import { buildLotLabel } from '../pop-material-lot-label/label-tspl';

import { packingLabelRows, type PackingLabelFields } from './packing-label-image';

/**
 * 포장 라벨 — **인쇄는 POP 이 80 × 30 mm TSPL 로 직접 짠다**(사용자 지시 2026-09-17).
 *
 * ⭐ **왜 그림(PNG)을 찍지 않는가.** 그림은 셸의 그림 인쇄 경로(드라이버 대지)를 거치는데,
 *   출하 포장 화면에서 찍힌 크기가 라벨지와 맞지 않았다. 자재·생산 LOT 라벨은 같은 라벨지에서
 *   TSPL 로 찍어 실기 확인을 마쳤으므로 같은 길로 보낸다.
 *
 * ⛔ **여백·QR 자리·글줄 칸을 여기서 다시 정하지 않는다.** 전부 `buildLotLabel` 이 가진다.
 *    글줄은 그림과 같은 `packingLabelRows` 를 쓴다.
 *
 * ⛔ **QR 에는 취급 단위 번호 원문만 싣는다** — 출하 단위 구성(P-04-05)이 그대로 스캔한다.
 *
 * ```
 * PACKING  #1                  ┌────┐
 * HU HU-260917-0001            │ QR │
 * SH SH-260917-0001            │    │
 * ES0602-00062 FLOT-0311 10 EA └────┘
 * +2 MORE ITEMS
 * ```
 */
export const buildPackingLabel = (fields: PackingLabelFields): string =>
  buildLotLabel(packingLabelRows(fields), fields.handlingUnitNo);
