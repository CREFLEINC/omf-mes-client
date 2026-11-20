import { Navigate, useSearchParams } from 'react-router';

export const SHIPMENT_SCHEDULE_PATH = '/shipment/shipment-schedule';

const ID = /^\d+$/u;

/** 넘겨 줄 조건 — 출하 · 결재 번호만(양의 정수). 다른 조건은 출하 내역의 것이라 W-04-02 가 모른다. */
const LINK_KEYS = ['shipmentId', 'approvalRequestId'] as const;

/**
 * 옛 주소 `/shipment/shipment-confirm`(출하 내역 W-04-12) → 출하 예정 목록(W-04-02)(피처 012 FR-023 · R-7).
 *
 * 출하 내역 화면은 없어졌다. 북마크 · 옛 알림 · 다른 화면의 링크가 이 주소로 오면 W-04-02 로 `replace` 넘기고,
 * `shipmentId` · `approvalRequestId` 가 있으면 그대로 실어 W-04-02 가 그 지시서 상세를 연다.
 */
export const ShipmentConfirmRedirect = () => {
  const [searchParams] = useSearchParams();
  const next = new URLSearchParams();

  for (const key of LINK_KEYS) {
    const value = searchParams.get(key);
    if (value !== null && ID.test(value)) next.set(key, value);
  }

  const query = next.toString();

  return <Navigate to={query === '' ? SHIPMENT_SCHEDULE_PATH : `${SHIPMENT_SCHEDULE_PATH}?${query}`} replace />;
};
