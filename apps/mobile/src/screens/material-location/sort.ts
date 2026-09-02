import type { InventoryBalance } from './queries';

/**
 * 여러 자리에 나뉜 잔액을 보유 수량 내림차순으로 둔다. 작은 자투리가 먼저 오면
 * 작업자가 가장 많이 쌓인 자리를 화면 아래에서 찾게 된다.
 */
export const byOnHandDesc = (balances: InventoryBalance[]): InventoryBalance[] =>
  [...balances].sort((left, right) => right.onHandQty - left.onHandQty);
