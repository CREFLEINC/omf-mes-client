import type { BalanceView } from './balance-lookup';
import type { RuleView } from './types';

/**
 * 규칙 용량 대비 현재 적재의 **사용률 판정**.
 *
 * ## 계산할 수 없으면 계산하지 않는다
 *
 * 이 파일의 요점은 비율을 내는 나눗셈이 아니라 **비율을 내면 안 되는 자리를 가려내는 것**이다.
 * 억지로 맞춘 숫자를 운영자가 근거로 삼기 때문이다(이슈 §6).
 *
 * | 갈래 | 왜 접는가 | 근거 |
 * | --- | --- | --- |
 * | **소유 구분이 둘 이상** | 자사 재고와 고객 지급품을 더한 비율은 오독이다 | 공유계약 L-7 |
 * | **단위가 다르다** | 환산 정의가 없는 조합이 있고, 화면에 옮길 수단이 없다 | 이슈 §6 |
 * | **용량이 0 이하** | 나누면 화면에 무한대가 서고 그 수가 사용률로 읽힌다 | 계약(「0 은 넣을 수 없다」)과 어긋난 자료 |
 *
 * ## 판정 순서가 뜻을 정한다
 *
 * **줄 없음 → 소유 → 단위 → 용량 → 비율**이다.
 *
 * - **줄 없음이 가장 앞이다.** 견줄 대상이 없으면 말할 것은 「없음」뿐이다 — 뒤에 두면
 *   확인할 잔액도 없는 자리에서 용량·단위 탓을 하는 문구가 선다.
 * - **소유가 단위보다 앞선다.** 합치는 것 자체가 금지된 축이라 단위를 보기 전에 접는다.
 *   뒤집으면 소유가 섞인 잔액이 「단위가 달라서」로 설명되고, 사용자는 단위만 맞추면 비율이
 *   선다고 읽는다.
 * - **단위가 용량보다 앞선다.** 단위가 다르면 두 수가 애초에 같은 종류가 아니다 —
 *   용량 값이 무엇이든 견줄 수 없다.
 *
 * **축이 섞인 응답은 여기 오지 않는다** — 그 판정은 `balance-lookup.ts`가 한다.
 * 같은 사실을 두 자리에서 판정하면 한쪽만 고쳐져 서로 다른 답을 낸다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

/** 합칠 수 없는 축으로 나뉜 잔액 한 묶음. 소유 구분은 서버가 준 코드를 그대로 들고 있는다. */
export interface UsageGroup {
  ownershipTypeCode: string;
  qty: number;
  uomId: number;
}

/**
 * 사용률 판정. **비율 · 판정 불가 · 없음 셋이다.**
 *
 * 미도착·실패·잘림은 이 타입에 없다 — 그것은 「비율을 낼 수 없다」가 아니라 「아직 재지
 * 못했다」이고, `RuleBalance`가 그 세 갈래를 이미 가르고 있다.
 */
export type UsageJudgment =
  | { kind: 'ratio'; percent: number; qty: number; uomId: number }
  | {
      kind: 'incomparable';
      reason: 'ownership' | 'unit' | 'capacity';
      groups: readonly UsageGroup[];
    }
  | { kind: 'none' };

/**
 * 합칠 수 있는 단위로 잔액을 묶는다 — **소유와 단위가 둘 다 같은 줄끼리만** 더한다.
 *
 * 처음 나온 차례를 지킨다. 화면이 이 배열을 그대로 그리므로 차례가 흔들리면 같은 자료가
 * 렌더마다 다른 줄로 보인다.
 */
const toGroups = (rows: readonly BalanceView[]): UsageGroup[] => {
  const groups = new Map<string, UsageGroup>();

  for (const row of rows) {
    const key = `${row.ownershipTypeCode}|${String(row.uomId)}`;
    const found = groups.get(key);

    if (found === undefined) {
      groups.set(key, {
        ownershipTypeCode: row.ownershipTypeCode,
        qty: row.onHandQty,
        uomId: row.uomId,
      });
    } else {
      found.qty += row.onHandQty;
    }
  }

  return [...groups.values()];
};

const distinctCount = <TValue>(values: readonly TValue[]): number => new Set(values).size;

export const judgeUsage = (rule: RuleView, rows: readonly BalanceView[]): UsageJudgment => {
  if (rows.length === 0) return { kind: 'none' };

  const groups = toGroups(rows);

  if (distinctCount(groups.map((group) => group.ownershipTypeCode)) > 1) {
    return { kind: 'incomparable', reason: 'ownership', groups };
  }

  /* 잔액 줄끼리 갈린 것과 규칙과 갈린 것을 같은 갈래로 둔다 — 사용자가 할 일이 같다. */
  if (groups.some((group) => group.uomId !== rule.uomId)) {
    return { kind: 'incomparable', reason: 'unit', groups };
  }

  if (rule.capacityQty <= 0) {
    return { kind: 'incomparable', reason: 'capacity', groups };
  }

  const qty = groups.reduce((sum, group) => sum + group.qty, 0);

  return {
    kind: 'ratio',
    /*
     * **100을 먼저 곱한다.** 나눗셈을 먼저 하면 0.64 같은 값이 근사되어 64가 64.00000000000001이
     * 되고, 화면과 시험이 그 꼬리를 계속 상대해야 한다.
     */
    percent: (qty * 100) / rule.capacityQty,
    qty,
    uomId: rule.uomId,
  };
};
