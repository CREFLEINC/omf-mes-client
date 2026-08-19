import type { NotificationView } from './types';

/**
 * 「이 회차에 읽음 처리한 번호」 — **목록을 다시 부르지 않고 표시만 바꾸기 위한 집합**이다.
 *
 * ⭐ **왜 서버 값만으로는 안 되는가.** 기본 조건이 「안 읽음만」이라, 읽음 처리 성공 뒤 목록을
 * 무효화하면 **방금 누른 카드가 눈앞에서 사라진다.** 사용자는 자기가 무엇을 읽었는지 잃고
 * 되돌릴 수단도 없다(삭제·되돌리기가 없는 화면이다). 그래서 서버 값(`view.read`)에 이 집합을
 * **더해서** 읽고, 목록은 그대로 둔다(결정 ⑤).
 *
 * ⛔ **전례의 「성공 뒤 목록을 무효화한다」가 여기서 거짓인 자리다**(`patterns/master/use-master-write.ts`의
 * `invalidateKeys`). 그 형태가 참인 이유는 마스터 화면의 목록이 **저장으로 행이 사라지지 않기
 * 때문**이다 — 값이 바뀔 뿐이다. 여기서는 행이 사라진다.
 *
 * ⚠ **「모두 읽음」은 반대다** — 그쪽은 무효화한다. 사용자가 「전부 읽음으로 바꾼다」를 명시적으로
 * 눌렀으므로 안 읽음 목록이 비는 것이 그 조작의 결과 그대로다. 비대칭의 이유가 이것이고,
 * 그래서 그 갈래는 이 집합을 쓰지 않는다.
 *
 * **순수 함수만 둔다.** 집합을 제자리에서 고치지 않고 새 값을 돌려준다 — 상태로 들 값이라
 * 참조가 바뀌어야 화면이 다시 그려진다.
 */

export interface ReadState {
  ids: ReadonlySet<number>;
}

export const EMPTY_READ_STATE: ReadState = { ids: new Set<number>() };

/**
 * 번호 하나를 읽음으로 더한다.
 *
 * **이미 들어 있으면 같은 값을 그대로 돌려준다** — 새 참조를 만들면 내용이 같은데도 화면이
 * 다시 그려지고, 그 렌더가 다시 이 함수를 부르는 자리가 생기면 멈추지 않는다.
 */
export const withRead = (state: ReadState, notificationId: number): ReadState => {
  if (state.ids.has(notificationId)) return state;

  const ids = new Set(state.ids);
  ids.add(notificationId);

  return { ids };
};

/**
 * 이 알림이 읽은 것인가 — **서버 값이거나, 이 회차에 우리가 읽음 처리한 것**이다.
 *
 * 순서가 뜻을 정한다: 서버가 이미 읽음이라 말하면 집합을 볼 것도 없다. 집합은 **서버 값이
 * 아직 따라오지 않은 자리**를 메울 뿐이고, 조건·쪽·기간이 바뀌어 새 결과가 오면 그 값이
 * 정본이 된다(그때 집합을 비운다 — `screen.tsx`).
 */
export const isRead = (view: NotificationView, state: ReadState): boolean =>
  view.read || state.ids.has(view.notificationId);
