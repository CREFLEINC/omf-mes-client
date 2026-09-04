import { messages } from '@omf-mes/i18n';

import type { Mold, OperationPolicyEffective } from './types';

const t = messages.shotConversion.preview;

/** 계약이 정한 비율의 소수 자릿수(`numeric(20,6)`). 견줄 때 이 자릿수에 맞춘다. */
const RATIO_SCALE = 6;

/**
 * 미리보기가 도출하는 것.
 *
 * ⛔ **범위 해석을 여기서 하지 않는다** — 그 답은 서버가 `effective` 로 준다. 여기서 하는
 * 것은 **받은 답으로 타발수를 세고, 캐비티 수와 어긋나면 알리는 것**뿐이다.
 */

/** 생산 수량을 읽는다. 읽을 수 없거나 0 이하면 `null` — 셀 수 없다는 뜻이다. */
export const parseQuantity = (text: string): number | null => {
  const trimmed = text.trim();

  if (trimmed === '') return null;

  const parsed = Number(trimmed);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

/**
 * 지금 적용되는 비율. **없으면 `null`.**
 *
 * ⛔ **「1.0」으로 채우지 않는다**(공유계약 G-9). 없는 정책을 있는 것으로 만들면 **계산이
 * 조용히 돌고**, 사용자는 환산이 되는 줄 안다.
 */
export const appliedRatio = (effective: OperationPolicyEffective | null): number | null => {
  if (effective === null || !effective.resolved) return null;

  const ratio = effective.valueNumeric;

  return ratio === null || ratio === undefined ? null : ratio;
};

/** 이긴 축의 사람 말. 모르는 값이면 그 값을 그대로 둔다(G-9). */
export const matchedScopeText = (effective: OperationPolicyEffective | null): string | null => {
  const code = effective?.matchedScopeCode;

  if (code === null || code === undefined) return null;

  const known = t.matchedScope as Record<string, string | undefined>;

  return known[code] ?? code;
};

/**
 * 타발수. **비율과 수량이 둘 다 있어야 센다.**
 *
 * ⚠ **반올림하지 않는다** — 어떻게 반올림할지는 서버가 정하는 것이고, 화면이 임의로 접으면
 * 실제 저장되는 값과 미리보기가 어긋난다. 소수가 나오면 소수로 보인다.
 */
export const shotCount = (quantity: number | null, ratio: number | null): number | null =>
  quantity === null || ratio === null ? null : quantity * ratio;

/**
 * 캐비티 수가 비율과 어긋나는가.
 *
 * ⭐ **비율 = 1 / 캐비티 수**가 이 화면의 뜻이다(스펙 §3-2). 두 값이 서로 다른 곳에 있으므로
 * (툴 마스터 · 정책) **어긋날 수 있고, 어긋나면 타발수가 조용히 틀린다.**
 *
 * ⛔ **고쳐 주지 않는다** — 어느 쪽이 맞는지 화면이 알 수 없다. 알리기만 한다.
 */
export const cavityMismatch = (cavityCount: number | null, ratio: number | null): string | null => {
  if (cavityCount === null || cavityCount <= 0 || ratio === null) return null;

  const expected = 1 / cavityCount;

  /*
   * ⚠ **저장 자릿수에 맞춰 견준다.** 계약이 비율을 `numeric(20,6)` 으로 두어 **소수점 아래
   * 여섯 자리까지만 저장된다** — 캐비티 3이면 저장된 값은 `0.333333` 이고 `1 / 3` 과 결코
   * 정확히 같지 않다. 더 촘촘히 견주면 **캐비티 3·6·7·9… 에서 늘 어긋났다고 말하게 된다.**
   *
   * ⛔ 정확 일치(`===`)로 견주지 않는 이유도 같다 — 그것은 이 화면이 못 잡는 경고가 아니라
   * **없는 경고를 만들어 내는 일**이다.
   */
  if (expected.toFixed(RATIO_SCALE) === ratio.toFixed(RATIO_SCALE)) return null;

  return t.cavityMismatch(cavityCount, String(Number(expected.toFixed(RATIO_SCALE))));
};

/**
 * 고른 툴의 캐비티 수. **툴을 고르지 않았으면 `null`.**
 *
 * ⭐ **스펙의 「캐비티 수 미등록」 예외는 계약이 닫았다** — `cavityCount` 가 필수이고 최솟값이
 * 1이라 **툴이 있으면 반드시 있다.** 그래서 남는 「없음」은 아직 고르지 않은 것 하나뿐이고,
 * 그것은 오류가 아니라 상태다 — 경고하지 않고 「고르면 보인다」고만 말한다.
 *
 * ⚠ `?? null` 을 남겨 두는 것은 방어다. 계약이 바뀌어 선택이 되면 이 자리가 먼저 받는다.
 */
export const cavityOf = (tool: Mold | null): number | null => tool?.cavityCount ?? null;
