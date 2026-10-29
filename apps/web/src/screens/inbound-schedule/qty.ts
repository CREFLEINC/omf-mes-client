/** 서버가 수량을 담는 자릿수(소수 여섯). 그 아래는 서버가 반올림해 버린다. */
const STORED_SCALE = 1e6;

/**
 * 수량 셈을 그 자릿수의 정수로 옮겨 한다(PDA `inbound-receipt/receipt.ts` 의 `exact` 와 같다).
 *
 * 배정밀도에서 `0.3 − 0.1` 은 `0.19999999999999998` 이다. 그대로 비교하면 남은 0.2 를 다 받는 줄에 `2.8e-17` 만큼의
 * 초과분이 생기고, 서버는 그 값을 6자리로 반올림해 0 으로 받아 「초과분 > 0」 검사에 걸린다.
 */
export const exactQty = (compute: (scale: (value: number) => number) => number): number =>
  compute((value) => Math.round(value * STORED_SCALE)) / STORED_SCALE;
