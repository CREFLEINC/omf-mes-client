/**
 * 기준 시각 — **지금 보이는 목록이 언제의 것인가**(공유계약 L-5).
 *
 * 이 화면은 자동으로 갱신되지 않는다(L-6). 밝히지 않으면 사용자가 목록을 실시간으로 읽고,
 * 새 알림이 와 있는데도 「없다」로 결론짓는다.
 *
 * **순수 함수만 둔다.** 함수 안에서 `new Date()`를 부르면 아무것도 안 했는데 시각이 계속 바뀌고,
 * 테스트가 실행 환경의 시각을 검사하게 된다. 「응답이 도착한 시각」은 호출부가 인자로 준다
 * (`useQuery`의 `dataUpdatedAt` — **렌더 시각이 아니다**).
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const pad = (value: number, length: number): string => String(value).padStart(length, '0');

/**
 * 응답이 도착한 시각을 「YYYY-MM-DD HH:mm」으로 옮긴다.
 *
 * **현지 시각으로 읽는다**(`toISOString`을 쓰지 않는다). 한국 시간대에서 UTC로 읽으면
 * 아홉 시간 전으로 보여 「낡은 자료」로 오인된다.
 *
 * ⭐ **`dataUpdatedAt`은 아직 받은 자료가 없으면 `0`이다.** 그때 1970년을 내면 사용자가
 * 그 시각의 알림을 본 것으로 읽으므로 **표기 자체를 내지 않는다.**
 *
 * ⚠ 카드의 발생 시각(`types.ts`의 `formatOccurredAt`)과 규율이 **반대**다. 그쪽은 서버가 준
 * 문자열의 벽시계를 그대로 자르고(옮기면 같은 알림이 사람마다 다른 시각으로 보인다), 여기는
 * 밀리초 수치를 **보는 사람의 시간대로** 읽는다 — 이 값은 *내가 언제 받았는가*라 보는 사람의
 * 시계가 정본이다.
 */
export const formatAsOf = (updatedAt: number | null): string | null => {
  if (updatedAt === null || updatedAt === 0) return null;

  const at = new Date(updatedAt);

  const date = `${pad(at.getFullYear(), 4)}-${pad(at.getMonth() + 1, 2)}-${pad(at.getDate(), 2)}`;
  /* 초를 내지 않는다 — 조회 시점의 정밀도가 초 단위로 읽힐 이유가 없다. */
  const time = `${pad(at.getHours(), 2)}:${pad(at.getMinutes(), 2)}`;

  return `${date} ${time}`;
};
