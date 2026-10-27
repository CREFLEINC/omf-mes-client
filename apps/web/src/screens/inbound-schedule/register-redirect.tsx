import { Navigate, useSearchParams } from 'react-router';

/** 「입하 등록」이 사는 화면. */
const INBOUND_SCHEDULE_PATH = '/logistics/inbound-schedule';

/** 옛 주소의 발주 번호 — 그 화면의 `po` 와 같은 키다. */
const PO_ID = /^[1-9]\d{0,15}$/;

/**
 * 옛 「초과 입하 분리」 주소(`/logistics/over-receipt-split`)를 새 자리로 옮긴다 — 즐겨찾기·공유한 주소가
 * 죽지 않게 한다. 입하 등록은 입고 관리의 라인 표에서 바로 한다(사용자 지시 2026-10-24 · 옛 「입하 등록」 창은 걷었다).
 *
 * 발주를 고른 주소(`po`)면 그 발주를 고른 채로, 아니면 입고 관리로만 간다. 옛 조회 조건
 * (`q`·`open`·`supplier`·`page`)은 옮기지 않는다 — 새 화면의 조건 축(납기 기간 · 공장)과 뜻이 다르다.
 */
export const OverReceiptSplitRedirect = () => {
  const [searchParams] = useSearchParams();
  const po = searchParams.get('po');
  const to =
    po !== null && PO_ID.test(po)
      ? `${INBOUND_SCHEDULE_PATH}?${new URLSearchParams({ po }).toString()}`
      : INBOUND_SCHEDULE_PATH;

  return <Navigate to={to} replace />;
};
