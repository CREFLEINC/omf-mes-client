import { messages } from '@omf-mes/i18n';

import type { LookupEntry } from './queries';
import { lookupLabel } from './options';
import { SCOPE_AXES, type OperationPolicy, type ScopeAxis } from './types';

const t = messages.shotConversion;

/**
 * 범위 축을 읽고 그리는 일.
 *
 * ⛔ **여기서 「무엇이 이기는가」를 판정하지 않는다.** 그 답은 서버가 `effective` 로 준다 —
 * 화면이 다시 구현하면 같은 표가 화면마다 다르게 읽힌다(스펙 §5-2 · 공유계약 B-17).
 * 여기서 하는 것은 **한 줄이 어느 범위인지를 사람의 말로 옮기는 것**뿐이다.
 */

/** 축마다 다른 이름 풀이 목록을 받는다. 축이 넷이라 하나로 묶을 수 없다. */
export type ScopeLookups = Record<ScopeAxis, readonly LookupEntry[]>;

/** 한 축의 값. 지정하지 않았으면 `null` 이고 그것이 「지정 없음」이다. */
export const axisValue = (policy: OperationPolicy, axis: ScopeAxis): number | null =>
  policy[axis] ?? null;

/**
 * 이 정책이 지정한 축들 — **우선순위 차례로.**
 *
 * ⭐ 차례가 뜻을 갖는다: 앞에 오는 축이 더 좁다. 표에 그 차례로 적어 두면 「왜 이것이
 * 이기는가」를 따로 설명하지 않아도 읽힌다.
 */
export const specifiedAxes = (policy: OperationPolicy): ScopeAxis[] =>
  SCOPE_AXES.filter((axis) => axisValue(policy, axis) !== null);

/**
 * 이 정책의 **가장 좁은 축.** 아무것도 지정하지 않았으면 `null` — 그것이 「전체」다.
 *
 * ⚠ 이것은 **이 줄이 얼마나 좁은가**이지 「이 줄이 이긴다」가 아니다. 이기는 것은 지금
 * 고른 대상에 달렸고 그 판정은 서버 몫이다.
 */
export const narrowestAxis = (policy: OperationPolicy): ScopeAxis | null =>
  specifiedAxes(policy)[0] ?? null;

/**
 * 범위를 한 줄로. 지정한 축이 없으면 「전체」다.
 *
 * ⛔ **빈 범위를 빈 칸으로 두지 않는다** — 「전체」는 값이 없는 것이 아니라 **전체를 뜻하는
 * 값**이다. 비워 두면 설정을 빠뜨린 것으로 읽힌다.
 */
export const scopeText = (policy: OperationPolicy, lookups: ScopeLookups): string => {
  const axes = specifiedAxes(policy);

  if (axes.length === 0) return t.scope.all;

  return axes
    .map((axis) => {
      const value = String(axisValue(policy, axis));

      return t.scope.entry(t.scope[axis], lookupLabel(value, lookups[axis]));
    })
    .join(t.scope.join);
};

/**
 * 유효기간을 한 줄로. 끝이 없으면 그렇게 보인다.
 *
 * ⛔ **끝이 없는 것을 「무기한」 같은 말로 바꾸지 않는다** — 계약이 「비면 끝이 없다」로
 * 정했고, 화면이 말을 지어내면 나중에 종료일이 들어왔을 때 두 표기가 어긋난다.
 */
export const periodText = (policy: OperationPolicy): string =>
  policy.effectiveTo === null || policy.effectiveTo === undefined || policy.effectiveTo === ''
    ? t.period.open(policy.effectiveFrom)
    : t.period.closed(policy.effectiveFrom, policy.effectiveTo);

/**
 * 이 정책이 이미 끝났는가. **오늘을 밖에서 받는다** — 안에서 읽으면 같은 표가 시각에 따라
 * 다르게 그려지고, 그것을 시험으로 붙들 수 없다.
 */
export const isEnded = (policy: OperationPolicy, today: string): boolean => {
  const to = policy.effectiveTo;

  return to !== null && to !== undefined && to !== '' && to < today;
};

/**
 * 비율을 계산식으로. **수가 아니라 무엇을 뜻하는지를 보인다** — 「0.25」만으로는 무엇의
 * 0.25인지 알 수 없다.
 *
 * ⚠ 값 칸이 비어 있으면 식을 지어내지 않는다 — 이 코드가 쓰는 칸은 `valueNumeric` 하나이고,
 * 비어 있다는 것은 **정책이 값을 갖지 않는다**는 뜻이라 그대로 밝힌다(공유계약 G-9).
 */
export const formulaText = (policy: OperationPolicy): string | null => {
  const ratio = policy.valueNumeric;

  return ratio === null || ratio === undefined ? null : t.formula(ratio);
};
