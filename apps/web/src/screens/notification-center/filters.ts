import { PERIOD_URL_KEYS, type NotificationPeriod } from './period';

/**
 * 주소가 조회 조건의 정본이다 — 새로고침·뒤로가기·공유가 같은 결과를 낸다.
 *
 * 이 회차의 조건은 **기간 하나**다. 「안 읽음/전체」·「유형」·쪽은 뒤따르는 회차가 이 파일에
 * 더한다. 지금 그 키를 미리 만들어 두지 않는다 — 쓰지 않는 값이 주소에 서면 조건이 걸린 것처럼
 * 보이고, 읽는 사람이 그 키가 무슨 일을 하는지 코드에서 찾을 수 없다.
 */

/** 이 화면이 쓰는 주소 키 전부. 기간은 수명이 달라 `period.ts`가 소유한다. */
export const URL_KEYS = { ...PERIOD_URL_KEYS } as const;

/**
 * 기간을 주소에 심는다.
 *
 * ⭐ **받은 주소를 통째로 갈아 끼우지 않는다.** 기간 두 키만 덮고 나머지는 그대로 둔다 —
 * 새 주소를 만들어 넣으면 사용자가 걸어 둔 다른 조건이 **기본값을 채우는 김에 함께 사라진다.**
 * 뒤따르는 회차가 조건을 늘릴수록 그 손실이 커지므로 지금 형태를 정해 둔다.
 */
export const withPeriod = (
  params: URLSearchParams,
  period: NotificationPeriod,
): URLSearchParams => {
  const next = new URLSearchParams(params);

  next.set(URL_KEYS.from, period.from);
  next.set(URL_KEYS.to, period.to);

  return next;
};
