import type { OperationPolicy } from './types';

/**
 * 환산 사용 여부를 읽는 일.
 *
 * ⭐ **상태가 셋이다**(공유계약 G-9) — 켬 · 끔 · **아직 정하지 않음.** 정책이 한 건도 없는
 * 것과 「끔으로 정한 것」은 다르다. 앞엣것을 뒤엣것으로 그리면 **아무도 정한 적 없는 값이
 * 정해진 것처럼 보인다.**
 */
export type EnabledState = 'on' | 'off' | 'unset';

/**
 * 지금 유효한 정책 하나를 고른다.
 *
 * ⚠ **이 화면은 전체 범위의 스위치만 다룬다** — 범위별 사용 여부는 이번 범위가 아니다.
 * 그래서 **축을 하나도 지정하지 않은 정책**만 본다. 범위가 붙은 것이 섞여 있으면 그것은
 * 다른 누군가가 넣은 것이고, 이 스위치가 그것을 대신 말하면 거짓이 된다.
 */
export const globalPolicy = (policies: readonly OperationPolicy[]): OperationPolicy | null =>
  policies.find(
    (policy) =>
      (policy.itemId ?? null) === null &&
      (policy.processId ?? null) === null &&
      (policy.plantId ?? null) === null &&
      (policy.businessUnitId ?? null) === null,
  ) ?? null;

/**
 * 지금 상태.
 *
 * ⛔ **값이 오지 않은 정책을 「끔」으로 읽지 않는다** — 이 코드가 쓰는 칸은 `valueBoolean`
 * 하나이고, 그것이 비어 있다는 것은 **정책이 값을 갖지 않는다**는 뜻이지 끄기로 정했다는
 * 뜻이 아니다.
 */
export const enabledState = (policies: readonly OperationPolicy[]): EnabledState => {
  const policy = globalPolicy(policies);

  if (policy === null) return 'unset';

  const value = policy.valueBoolean;

  if (value === null || value === undefined) return 'unset';

  return value ? 'on' : 'off';
};

/**
 * 켜 두었는데 쓸 비율이 없는가.
 *
 * ⚠ **막지 않고 알린다**(공유계약 G-12·G-15) — 정책은 나중에 더할 수 있고, 켜 두는 것이
 * 「이제 만들겠다」는 뜻일 수 있다. 다만 **지금 상태로는 동작하지 않는다**는 사실은 말한다.
 *
 * ⛔ **셀 수 없으면 경고하지 않는다**(`ratioCount === null`). 기준일로 좁힌 목록이 비었다고
 * 정책이 없는 것은 아니다 — **모르는 것을 「없다」로 단정하면 있는 정책을 두고 없다고
 * 말하게 된다**(공유계약 G-9).
 */
export const warnsNoRatio = (state: EnabledState, ratioCount: number | null): boolean =>
  state === 'on' && ratioCount === 0;
