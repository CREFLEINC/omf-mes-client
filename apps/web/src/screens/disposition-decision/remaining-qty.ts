import { formatQty, type DispositionRemainingSummary } from './types';

export interface RemainingQty {
  /** 낼 수 없으면 `undefined` — 0을 지어내지 않는다. */
  value: number | undefined;
  text: string;
  /** 남은 수량이 0 이하다. 더 판정할 것이 없다는 뜻이다. */
  isSettled: boolean;
}

/**
 * ⭐ **남은 수량 — 서버가 낸다.**
 *
 * 스펙은 이 값을 「서버가 계산한다」로 정했고(공유계약 L-2 — 잔액을 클라이언트가 계산하지
 * 않는다), 저장 시 초과 판정도 서버가 409로 낸다. 판정 이력 조회 응답이 함께 싣는
 * `summary.remainingQty`가 그 값이다 — 대상 수량 합에서 결정 수량 합을 서버가 이미 뺀 값이라
 * 이 함수는 더 이상 빼지 않고 그대로 읽는다. 근거: W-03-10 §3 · §9-1 · omf-mes#253(회신 반영).
 *
 * ⚠ **그래도 조회 시점의 스냅샷이다.** 화면이 이 값을 받은 뒤 다른 사용자가 같은 부적합에
 * 판정을 저장하면 실제 남은 수량은 달라져 있을 수 있다 — 그래서 이 값으로 입력을 막지 않고
 * (`decision-form.ts:remainingNotice`), 최종 판정은 저장 시 서버가 409로 낸다.
 *
 * 판정 이력을 아직 못 받았으면(`summary`가 없으면) 낼 수 없다고 답한다.
 */
/**
 * ⭐ **보이는 값과 판정을 같은 수에서 낸다.**
 *
 * 수량이 소수일 수 있어(계약이 `double`) 서버 집계도 `5.55e-17` 같은 부동소수 찌꺼기를 실어
 * 보낼 수 있다. 표시가 소수 여섯 자리에서 끊기므로 그대로 두면 **화면에는 `0`이 보이는데
 * 「끝나지 않았다」**가 되고, 사용자는 「남은 수량 0보다 많다」는, 어떤 입력으로도 만족할 수
 * 없는 안내를 받는다. 음수 쪽으로 어긋나면 `-0`이 그대로 찍힌다. 표시와 같은 자리에서 끊어
 * 둘을 붙인다.
 */
const snapToDisplay = (value: number): number => {
  const snapped = Number(value.toFixed(6));
  return snapped === 0 ? 0 : snapped;
};

export const toRemainingQty = (summary: DispositionRemainingSummary | undefined): RemainingQty => {
  if (summary === undefined) {
    return { value: undefined, text: formatQty(undefined), isSettled: false };
  }

  const value = snapToDisplay(summary.remainingQty);

  return { value, text: formatQty(value), isSettled: value <= 0 };
};
