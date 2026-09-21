import type { WorkOrder } from './types';

/**
 * 이 작업지시가 **지시 수량을 채웠는가** — 다음 걸음이 「시작」이 아니라 「마감」인 자리다
 * (omf-all-around#45).
 *
 * ⭐ **판정의 근거는 서버 값이다.** 누적 양품은 `withProgress=true` 로 받은 `progress.goodQty`
 * 이고(`queries.ts`), 이 화면은 그것을 지시 수량과 견주기만 한다 — 실적은 여러 세션·여러
 * 단말에 흩어져 쌓이므로 화면이 본 것만 더하면 늘 실제보다 적다.
 *
 * ⛔ **`progress` 가 없으면 「모른다」다**(선례 `production-result/quantity-draft`). 0 으로
 * 접으면 「아직 안 만들었다」가 되어 안내가 조용히 사라진다 — 모를 때는 아무 말도 하지 않는다.
 *
 * ⛔ **지시 수량이 0 이하면 판정하지 않는다.** `0 >= 0` 이 참이라 「채웠다」가 되는데, 그것은
 * 수량을 채운 것이 아니라 수량을 모르는 것이다.
 *
 * ⚠ **마감 판정이 아니다.** 마감 3분류(`completionJudgmentCode`)는 허용 오차가 아직 미정이라
 * 서버 정책이 정해지면 그 값으로 옮긴다. 지금 화면이 말하는 것은 「지시 수량 이상을 만들었다」
 * 까지이고, 마감 자체는 서버·관리웹이 한다.
 */
export const isOrderQtyFulfilled = (workOrder: WorkOrder): boolean => {
  const good = workOrder.progress?.goodQty;

  if (good === undefined || workOrder.orderQty <= 0) return false;

  return good >= workOrder.orderQty;
};
