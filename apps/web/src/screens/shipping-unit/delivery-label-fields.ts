/**
 * 출하 단위 상세를 **납품 라벨의 값**으로 옮긴다.
 *
 * ⭐ **서버 상세 응답 하나가 라벨 값 전부를 싣는다**(설계 §4-3 · 사용자 결정 2026-09-16).
 *    화면이 거래처를 따로 조회하지 않는다 — POP 단말 토큰으로는 `/mdm/*` 단건 경로가 막혀
 *    있다(ISSUE-QR-01 실측: `GET /mdm/locations/{id}` → 401. 그 탓에 자재 출고 라벨의 도착지가
 *    지금도 `TO: -` 로 찍힌다). 같은 벽에 또 부딪히지 않으려고 값을 상세에 실어 달라고 했다.
 *
 * ⛔ **없는 값을 지어내지 않는다.** 이름이 비어 오면 그 사실을 적는다(`-`) — 빈칸으로 두면
 *    받는 쪽은 「원래 없는 거래처」로 읽는다.
 */

import {
  DELIVERY_LABEL_UNKNOWN,
  type DeliveryLabelFields,
  type DeliveryLabelItemTotal,
  type DeliveryLabelPartner,
} from './delivery-label-image';
import type { ShippingUnitDetail, ShippingUnitItemTotal, ShippingUnitPartner } from './types';

/** 빈 글은 값이 아니다 — 공백만 있는 것도 없는 것으로 본다. */
const orUnknown = (value: string): string =>
  value.trim() === '' ? DELIVERY_LABEL_UNKNOWN : value.trim();

const toPartner = (partner: ShippingUnitPartner): DeliveryLabelPartner => ({
  partnerCode: orUnknown(partner.partnerCode),
  partnerName: orUnknown(partner.partnerName),
});

/**
 * 수량 한 칸.
 *
 * ⚠ **단위를 지어내지 않는다.** 상세가 단위 코드를 주지 못하면 수만 적는다 — 늘 `EA` 로
 *   떨어뜨리면 받는 쪽이 그 말을 믿고, 박스 단위를 낱개로 읽어 대조가 통째로 어긋난다.
 */
const quantityOf = (qty: number, uomCode: string): string => {
  const amount = qty.toLocaleString('ko-KR');

  return uomCode.trim() === '' ? amount : `${amount} ${uomCode.trim()}`;
};

const toItemTotal = (total: ShippingUnitItemTotal): DeliveryLabelItemTotal => ({
  itemCode: orUnknown(total.itemCode),
  itemName: orUnknown(total.itemName),
  quantity: quantityOf(total.qty, total.uomCode),
});

/**
 * 라벨 값으로 옮긴다.
 *
 * ⛔ **상자 수를 세지 않는다.** 서버가 준 `boxCount` 를 그대로 쓴다 — 받은 `boxes` 를 세면
 *    목록이 일부만 왔을 때(쪽 나눔·조회 실패) **틀린 수가 라벨에 찍힌다.**
 */
export const toDeliveryLabelFields = (
  detail: ShippingUnitDetail,
  issueSeq: number,
): DeliveryLabelFields => ({
  shippingUnitNo: detail.shippingUnitNo,
  customer: toPartner(detail.customer),
  shipTo: toPartner(detail.shipTo),
  boxCount: detail.boxCount,
  issueSeq,
  itemTotals: detail.itemTotals.map(toItemTotal),
});
