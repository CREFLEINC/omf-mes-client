/**
 * 단말 시각 — **세션의 시작 시각과 사건의 발생 시각을 단말이 정한다**(공유계약 C-12).
 *
 * ⛔ **서버 수신 시각으로 덮지 않는다.** 계약이 `startedAt`·`occurredAt` 둘 다 「단말 시계가
 * 정한다」로 적었다. 현장에서 일어난 순간과 서버에 닿은 순간은 갈릴 수 있고, 기록에 남아야
 * 하는 것은 앞의 것이다.
 *
 * ⛔ **`Date.toISOString()` 을 쓰지 않는다.** 그 값은 UTC(`…Z`)라 같은 순간을 가리키기는
 * 하지만, 뒤에 이 값을 그대로 읽어 그리는 화면들이 **단말이 선 지역의 시각**을 잃는다 —
 * 이 저장소의 표시 규약이 「계약이 준 글자를 그대로 읽는다」이기 때문이다. 오프셋을 붙여
 * 보낸다.
 *
 * ⚠ 오차는 함께 보내지 않는다(C-12) — 계약에 실을 자리가 없다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const pad = (value: number, length: number): string => String(value).padStart(length, '0');

/**
 * 실행 환경이 UTC와 얼마나 떨어져 있는지. `+09:00` 꼴이다.
 *
 * 이 제품이 도는 지역에는 서머타임이 없어 순간마다 값이 갈리지 않는다 — 보내는 순간의 값을
 * 그대로 쓴다.
 */
const offsetText = (at: Date): string => {
  const minutes = -at.getTimezoneOffset();
  const sign = minutes < 0 ? '-' : '+';
  const absolute = Math.abs(minutes);

  return `${sign}${pad(Math.floor(absolute / 60), 2)}:${pad(absolute % 60, 2)}`;
};

/** 단말 시계가 읽은 지금 — `YYYY-MM-DDTHH:mm:ss+09:00` 꼴. */
export const terminalNow = (at: Date): string =>
  `${String(at.getFullYear())}-${pad(at.getMonth() + 1, 2)}-${pad(at.getDate(), 2)}T${pad(
    at.getHours(),
    2,
  )}:${pad(at.getMinutes(), 2)}:${pad(at.getSeconds(), 2)}${offsetText(at)}`;
