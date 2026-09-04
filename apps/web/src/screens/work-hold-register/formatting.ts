/**
 * 시각·길이를 사람이 읽는 글자로. **판정에 쓰지 않는다** — 보이게 하는 데만 쓴다.
 *
 * 이 파일은 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const pad = (value: number, length: number): string => String(value).padStart(length, '0');

/**
 * 계약이 준 시각 글자를 `MM-DD HH:MM`으로 — 스펙 §3 이 세션 시작을 그렇게 그린다.
 *
 * 읽을 수 없으면 `null`이다 — 깨진 글자를 시각인 척 보이지 않는다.
 */
export const toDateTimeLabel = (isoText: string): string | null => {
  const at = new Date(isoText);
  if (Number.isNaN(at.getTime())) return null;

  return `${pad(at.getMonth() + 1, 2)}-${pad(at.getDate(), 2)} ${pad(at.getHours(), 2)}:${pad(
    at.getMinutes(),
    2,
  )}`;
};

/** 이력 줄의 시각은 `HH:MM`이다 — 한 세션 안이라 날짜를 반복하지 않는다(스펙 §3). */
export const toClockLabel = (isoText: string): string | null => {
  const at = new Date(isoText);
  if (Number.isNaN(at.getTime())) return null;

  return `${pad(at.getHours(), 2)}:${pad(at.getMinutes(), 2)}`;
};

/** 분을 「n시간 n분」으로. 한 시간이 안 되면 분만 말한다. */
export const toDurationLabel = (minutes: number): string => {
  const whole = Math.max(0, Math.trunc(minutes));
  const hours = Math.floor(whole / 60);
  const rest = whole % 60;

  return hours === 0 ? `${String(rest)}분` : `${String(hours)}시간 ${String(rest)}분`;
};

/**
 * 시작부터 지금까지의 분.
 *
 * ⛔ **저장하지 않는다.** 아무도 아무것도 하지 않아도 계속 바뀌는 값이라, 어딘가에 적는 순간
 * 그 자리가 낡는다. 화면이 매번 다시 센다.
 */
export const elapsedMinutes = (startedAt: string, now: Date): number | null => {
  const from = new Date(startedAt).getTime();
  if (Number.isNaN(from)) return null;

  return Math.max(0, Math.floor((now.getTime() - from) / 60_000));
};
