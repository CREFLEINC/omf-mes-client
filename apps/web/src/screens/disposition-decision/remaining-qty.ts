import {
  formatQty,
  totalAffectedQty,
  type DispositionDecision,
  type NonconformanceLot,
} from './types';

export interface RemainingQty {
  /** 낼 수 없으면 `undefined` — 0을 지어내지 않는다. */
  value: number | undefined;
  text: string;
  /** 남은 수량이 0 이하다. 더 판정할 것이 없다는 뜻이다. */
  isSettled: boolean;
}

/**
 * ⭐ **남은 수량 — 이 화면의 핵심이자, 지금 유일하게 계약에서 빠진 값이다.**
 *
 * 스펙은 이 값을 「서버가 계산한다」로 정했고(공유계약 L-2 — 잔액을 클라이언트가 계산하지
 * 않는다), 저장 시 초과 판정도 서버가 409로 낸다. 그런데 **계약 응답 어디에도 잔량 필드가
 * 없다** — `GET …/disposition-decisions`는 결정 목록만 내리고, 부적합 상세도 잔량을 내리지
 * 않는다. 설계 저장소에 **omf-mes#253**으로 올렸고, 회신 전까지 화면이 합계 차로 낸다.
 *
 * 그래서 이 값은 **참고값**이다. 지키는 선을 셋 둔다.
 *
 * 1. 파생을 이 파일 하나에 가둔다 — 서버 필드가 오면 이 함수의 속만 바꾼다
 * 2. 화면이 「참고값이며 최종 판정은 저장 시 서버가 한다」를 함께 적는다
 * 3. **초과 입력을 막지 않는다** — 판정 권한은 서버에 남기고, 409가 오면 서버 문구를 보인다
 *
 * 대상 LOT이 실려 오지 않으면(`lots`는 계약에서 required가 아니다) 낼 수 없다고 답한다.
 */
/**
 * ⭐ **보이는 값과 판정을 같은 수에서 낸다.**
 *
 * 수량이 소수일 수 있어(계약이 `double`) 뺄셈이 `5.55e-17` 같은 값을 남긴다. 표시가 소수
 * 여섯 자리에서 끊기므로 그대로 두면 **화면에는 `0`이 보이는데 「끝나지 않았다」**가 되고,
 * 사용자는 「남은 수량 0보다 많다」는, 어떤 입력으로도 만족할 수 없는 안내를 받는다.
 * 음수 쪽으로 어긋나면 `-0`이 그대로 찍힌다. 표시와 같은 자리에서 끊어 둘을 붙인다.
 */
const snapToDisplay = (value: number): number => {
  const snapped = Number(value.toFixed(6));
  return snapped === 0 ? 0 : snapped;
};

export const toRemainingQty = (
  lots: NonconformanceLot[] | undefined,
  decisions: DispositionDecision[] | undefined,
): RemainingQty => {
  const total = totalAffectedQty(lots);

  if (total === undefined || decisions === undefined) {
    return { value: undefined, text: formatQty(undefined), isSettled: false };
  }

  const decided = decisions.reduce((sum, decision) => sum + decision.decisionQty, 0);
  const value = snapToDisplay(total - decided);

  return { value, text: formatQty(value), isSettled: value <= 0 };
};
