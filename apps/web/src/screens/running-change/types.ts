import type { components } from '@omf-mes/api-client';

/**
 * P-02-11 화면 슬라이스의 계약.
 *
 * `api-client`는 `import type`으로만 참조한다 — 런타임 코드를 끌어오지 않아야 화면의 순수성이
 * 유지된다.
 *
 * 이 파일은 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

type MaterialConsumptionResponse = components['schemas']['MaterialConsumption'];

/**
 * 《현재 투입》 한 줄 — **교체 대상의 모집단이기도 하다**(스펙 §3).
 *
 * ⛔ **`consumptionTypeCode`를 읽어 갈래를 나누지 않는다.** 값 목록이 확정 전이고, 계약이
 * 「화면은 서버가 내려주는 값을 그대로 표시하고 값 자체로 분기하지 않는다」고 못박았다.
 * 교체 여부는 **구조 축**(`replacedConsumptionId`)이 말한다(§5-2 · omf-mes#252).
 */
export interface CurrentInputView {
  materialConsumptionId: number;
  itemId: number;
  lotId: number;
  inputQty: number;
  uomId: number;
  /**
   * 이 투입이 **다른 투입을 교체한 것인가.** 있으면 그 대상의 번호다.
   *
   * ⚠ **정정(`correctsConsumptionId`)과 다르다**(§5-2). 정정은 원래 투입이 없었던 셈이고,
   * 교체는 이전 부품도 실재해 그 시점까지의 제품에 들어갔다. 두 축을 한 칸으로 다루면
   * 이력이 왜곡되므로 교체 축만 읽는다.
   */
  replacedConsumptionId: number | null;
}

/** 응답 한 줄을 화면 타입으로 옮기는 **유일한 지점**이다. */
export const toCurrentInputView = (row: MaterialConsumptionResponse): CurrentInputView => ({
  materialConsumptionId: row.materialConsumptionId,
  itemId: row.itemId,
  lotId: row.lotId,
  inputQty: row.inputQty,
  uomId: row.uomId,
  replacedConsumptionId: row.replacedConsumptionId ?? null,
});
