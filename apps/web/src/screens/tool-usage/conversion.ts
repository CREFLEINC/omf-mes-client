import type { OperationPolicyEffective } from './types';

/**
 * 환산은 **이 화면이 정하지 않는다**(스펙 §5-4).
 *
 * 「쓰는가」와 「비율」은 둘 다 운영 정책이고 그것을 정하는 화면은 W-05-01 이다. 이 화면은
 * 정책을 **읽어** 환산 옵션을 열지 말지 고르고, 쓴 비율을 실적에 함께 저장한다 — 정책이
 * 나중에 바뀌어도 과거 실적이 흔들리지 않게 하기 위해서다.
 */

/** 환산 옵션이 지금 어떤 상태인가. **못 쓰는 이유를 갈라 둔다** — 사용자가 할 일이 다르다. */
export type ConversionState =
  | { kind: 'loading' }
  /** 정책은 왔는데 「쓰지 않는다」로 정해져 있다 */
  | { kind: 'off' }
  /** 맞는 정책이 없거나 비율이 오지 않았다 — 설정 화면이 채워야 풀린다 */
  | { kind: 'unset' }
  | { kind: 'ready'; ratio: number };

/**
 * ⛔ **기본값을 지어내지 않는다.** 계약이 「`resolved` 가 거짓이면 맞는 정책이 없다 — 화면은
 * 기본값을 지어내 그리지 않고 『적용 정책 없음』으로 밝힌다」고 못박았다. 비율을 1 로 두거나
 * 환산을 켜 두면 **사용자가 지어낸 숫자를 실적으로 저장한다.**
 */
const resolvedNumber = (policy: OperationPolicyEffective | undefined): number | null => {
  if (policy === undefined || !policy.resolved) return null;

  const value = policy.valueNumeric;

  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
};

const resolvedBoolean = (policy: OperationPolicyEffective | undefined): boolean | null => {
  if (policy === undefined || !policy.resolved) return null;

  return typeof policy.valueBoolean === 'boolean' ? policy.valueBoolean : null;
};

export interface ConversionPolicies {
  enabled: OperationPolicyEffective | undefined;
  ratio: OperationPolicyEffective | undefined;
  isLoading: boolean;
}

/**
 * 두 정책을 한 상태로 읽는다.
 *
 * ⭐ **「쓰는가」가 먼저다.** 비율이 있어도 쓰지 않기로 정해져 있으면 환산은 닫힌다 — 두 정책은
 * 각각 다른 것을 말하고, 순서를 뒤집으면 꺼 둔 설정이 비율 하나로 되살아난다.
 *
 * ⚠ **불러오는 중을 「없음」과 가르지 않으면** 화면이 잠깐 「비율이 설정돼 있지 않습니다」를
 * 보였다가 곧 옵션을 여는 깜빡임이 된다 — 사용자는 설정이 방금 바뀐 줄 안다.
 */
export const conversionState = ({
  enabled,
  ratio,
  isLoading,
}: ConversionPolicies): ConversionState => {
  if (isLoading) return { kind: 'loading' };

  if (resolvedBoolean(enabled) === false) return { kind: 'off' };

  const value = resolvedNumber(ratio);

  if (resolvedBoolean(enabled) === null || value === null) return { kind: 'unset' };

  return { kind: 'ready', ratio: value };
};

/**
 * 생산 수량을 타발수로 환산한다.
 *
 * ⚠ **정수로 맞춰 보낸다** — 계약의 타발수가 정수라 소수를 실을 자리가 없다. 스펙은 반올림
 * 규칙을 정하지 않았으므로 **가장 가까운 정수**로 두고, 그 사실을 화면이 말한다(문구
 * `roundedNote`). 화면이 보이는 값과 보내는 값이 같아야 사용자가 확인할 수 있다.
 */
export const convertedShots = (baseQty: number, ratio: number): number =>
  Math.round(baseQty * ratio);
