import type { QtyParse } from './line-draft';

/**
 * 차이 사유의 **조건부 필수를 판정하는 유일한 자리**(계획 결정 7 · 감지기 M36).
 *
 * 계약은 「차이가 0이 아니면 필수」라 적었고(`InventoryCountLineUpsert.varianceReasonCode`)
 * 착수 이슈 §6은 「차이 수량을 화면에서 다시 계산하지 마세요」라 적었다. 둘이 부딪히는 것처럼
 * 보이지만 아니다 — **차이를 만들지 않고도 「차이가 0이 아닌가」는 알 수 있다.**
 *
 * - **뺄셈을 하지 않는다.** 판정은 `친 실물 수량 !== 장부 수량` 비교 한 줄이며 차이 수량을
 *   만들지 않는다. 화면이 표시하는 차이는 **서버가 준 `varianceQty`뿐**이다.
 * - **판정을 여기 한 곳에 둔다.** 표·저장 버튼·요청 조립이 각자 다시 만들면 「사유가 필수라고
 *   표시했는데 저장은 열려 있는」 어긋남이 생긴다. 읽는 자리는 결과만 받는다.
 * - **블라인드에서는 판정하지 않는다**(어긋남 5). 장부 수량이 내려오지 않아 견줄 값이 없다.
 *   없는 값을 0으로 보면 **전 줄이 차이 있는 줄**이 되어, 코드 목록이 확정되지 않은 지금은
 *   블라인드 실사의 저장이 통째로 막힌다. 서버가 400을 주면 배너로 그대로 낸다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

export interface VarianceRuleInput {
  /** 장부 수량. **`null`이면 견줄 값이 없다**(블라인드 · 계약과 런타임의 어긋남 — 결정 4). */
  systemQty: number | null;
  qty: QtyParse;
}

/**
 * 이 줄에 차이 사유가 지금 필요한가.
 *
 * 아직 치지 않았거나 잘못 친 줄은 판정하지 않는다 — 견줄 값이 없는데 필수로 세우면
 * 「수량도 안 넣었는데 사유부터 고르라」는 안내가 된다.
 */
export const isReasonRequired = ({ systemQty, qty }: VarianceRuleInput): boolean => {
  if (systemQty === null) return false;
  if (qty.kind !== 'qty') return false;

  return qty.value !== systemQty;
};

export interface VarianceStaleInput {
  /** **서버가 준 실물 수량** — 그 값으로 서버가 차이를 계산해 내려보냈다. */
  savedQty: number;
  qty: QtyParse;
}

/**
 * 차이 칸에 보이는 값이 낡았는가(완료 조건 C41).
 *
 * 친 실물 수량이 저장된 값과 다르면 서버가 준 차이는 **다른 수량으로 계산된 값**이다.
 * 화면이 그 자리에서 차이를 다시 계산하면 서버가 정한 값과 갈리므로, 대신 **낡았다는 사실만**
 * 밝힌다 — 「화면은 차이를 계산하지 않는다」와 「낡은 값을 그대로 두지 않는다」를 함께 지키는
 * 형태가 이것뿐이다.
 *
 * 아직 치지 않은 줄은 낡지 않았다. 빈 칸에도 표식을 붙이면 위치를 여는 순간 전 줄에 표식이
 * 서서 정작 값을 고친 줄이 눈에 띄지 않는다.
 */
export const isVarianceStale = ({ savedQty, qty }: VarianceStaleInput): boolean =>
  qty.kind === 'qty' && qty.value !== savedQty;
