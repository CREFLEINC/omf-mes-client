/**
 * P-04-05 출하 단위 구성이 다루는 값들.
 *
 * ⭐ **계약에서 끌어온다.** 이 파일은 한때 설계 선행 문서 §4-3 을 보고 «손으로» 세운 모양이었다
 *    (전달본에 `/logistics/shipping-units` 가 없던 동안). 전달본 2026-09-17 이 담아 오면서
 *    계약 파생으로 바꿨다 — 손으로 적은 모양은 계약이 바뀌어도 조용히 맞는 척한다.
 *
 * ⚠ **이 전달본은 «서버 구현 기준선»이다**(설계 확정본이 아니다). 설계 저장소에는 아직 출하
 *   단위 계약이 없고, 사용자 승인으로 서버가 사본에 선반영했다(장부 P-24 · P-25). 확정본이
 *   오면 그 P-항목과 대조한다 — `.client-dev/state.json` 의 `serverApiBaseline` 이 무엇을
 *   바탕으로 삼았는지 기록한다.
 */

import type { components } from '@omf-mes/api-client';

/** 출하 단위의 상태. 편도다 — 마감은 되돌릴 수 없다(설계 §4-6). */
export type ShippingUnitStatus = ShippingUnitDetail['statusCode'];

export type ShippingUnitPartner = ShippingUnitDetail['customer'];

/** 상자에 든 것 한 줄. */
export type ShippingUnitContent = components['schemas']['ShippingUnitBoxContent'];

/** 이 출하 단위에 등록된 상자 한 개. `seq` 는 스캔해 넣은 차례다. */
export type ShippingUnitBox = components['schemas']['ShippingUnitBox'];

/**
 * 품목별 합 — **납품 라벨의 본문**이다.
 *
 * ⛔ **화면이 합하지 않는다.** 서버가 상자 내용물을 **(품목, 단위)** 로 묶어 합해 준다 — 같은
 *    품목이라도 단위가 다르면 두 줄로 온다(서버 확정 2026-09-17). 화면이 세면 받은 상자 목록이
 *    일부일 때 **틀린 합이 라벨에 찍힌다.**
 */
export type ShippingUnitItemTotal = components['schemas']['ShippingUnitItemTotal'];

/**
 * 출하 단위 상세 — **납품 라벨 값을 전부 싣는다**(설계 §4-3).
 *
 * ⭐ 고객·납품처는 **늘 있다**(서버 확정 — null 없음). 화면이 거래처를 따로 조회하지 않는다:
 *    POP 단말 토큰으로는 `/mdm/*` 단건 경로가 막혀 있다(ISSUE-QR-01 실측 401).
 *
 * ⚠ `versionNo` 가 낙관적 잠금 토큰이다 — 응답 ETag 와 같은 값이고 `:close` 가 `If-Match` 로
 *   받는다. `:add-box`·`DELETE` 도 버전을 올리므로 **매 응답의 ETag 로 갱신**해야 마감이
 *   409 가 나지 않는다(서버 확정 2026-09-17).
 */
export type ShippingUnitDetail = components['schemas']['ShippingUnitDetail'];

/** 목록 한 줄 — 상세에서 `boxes`·`itemTotals` 를 뺀 것. */
export type ShippingUnitSummary = components['schemas']['ShippingUnit'];

/**
 * 상자 등록이 막힌 사유 — **다섯 갈래를 가른다**(설계 §5-3).
 *
 * ⭐ **서버가 `errors[].code` 와 `field` 로 갈라 준다**(통합 담당 확정 2026-09-16 · 서버 U-14 가
 *    잠근다). 코드만으로는 「마감된 단위」와 「포장 안 된 상자」가 둘 다 `STATE_LOCKED` 로
 *    뭉개져 구별되지 않는다 — 그래서 `field` 를 함께 본다.
 *
 * ⚠ 거절은 전부 **400** 이다(서버 확정 2026-09-17). 409 는 `:close` 의 저장 충돌 전용이고
 *   봉투가 `ConflictResponse` 라 모양이 다르다.
 *
 * ⛔ **모르는 사유를 다섯 중 하나로 접지 않는다.** 엉뚱한 안내를 하면 담당이 할 수 없는 조치를
 *    되풀이한다. 모르면 `unknown` 으로 두고 서버가 준 말을 그대로 보인다.
 */
export type AddBoxRejection =
  | { kind: 'unitClosed' }
  | { kind: 'notPacked' }
  | { kind: 'noAllocation' }
  | { kind: 'otherShipment' }
  | { kind: 'alreadyAssigned' }
  | { kind: 'shipmentCancelled' }
  | { kind: 'notFound' }
  | { kind: 'unknown'; message: string | null };
