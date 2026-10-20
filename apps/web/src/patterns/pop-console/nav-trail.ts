import { useSyncExternalStore } from 'react';

import { POP_HOME_PATH } from '../pop-screen-catalog';

/**
 * **지나온 화면 기록** — [이전]이 돌아갈 곳과 홈의 「최근 화면」.
 *
 * ⭐ **브라우저 히스토리를 쓰지 않는다.** 키오스크에는 뒤로가기가 없고, 히스토리를 그대로 되짚으면
 *    세 가지가 꼬인다(현장 지적 2026-10-20 — 「화면을 옮기다 다시 못 돌아간다」).
 *    1. 맨 앞 칸이 진입 화면(사번 입력)이라 [이전]을 거듭 누르면 사번을 다시 치는 화면에 선다.
 *    2. 단말을 켠 첫 화면에서 [이전]을 누르면 앱 밖(빈 문서)으로 나간다.
 *    3. 같은 두 화면을 오가면 히스토리가 그만큼 쌓여, 돌아가려면 그 횟수만큼 눌러야 한다.
 *    그래서 앱이 직접 기록한다 — 진입 화면은 담지 않고, 같은 화면을 거듭 담지 않고, 기록이 없으면
 *    [이전]은 홈으로 간다. **어느 화면에서든 돌아갈 곳이 늘 있다.**
 *
 * ⚠ **주소째 담는다**(`pathname + search`). 작업지시는 주소가 소유하므로, 자재 투입에서 작업 중단으로
 *   갔다가 돌아올 때 같은 작업지시로 돌아와야 한다.
 *
 * ⛔ **단말 메모리에만 둔다.** 사용자 전환(진입 화면)에서 비운다 — 다음 작업자에게 앞 사람의 화면이
 *    「최근 화면」으로 보이면 남의 작업지시로 들어간다.
 */
const MAX_ENTRIES = 20;
const MAX_RECENT = 6;

let trail: readonly string[] = [];
/**
 * 「최근 화면」 — [이전] 기록과 **따로** 든다. [이전] 기록은 되돌아오면 끝을 걷어 내므로, 홈을
 * 거쳐 다른 화면으로 가면 앞서 본 화면이 사라진다. 최근 화면은 화면마다 마지막 주소 하나씩,
 * 최근 것부터 남긴다.
 */
let recent: readonly string[] = [];
const listeners = new Set<() => void>();

const notify = (): void => {
  for (const listener of listeners) listener();
};

const emit = (next: readonly string[]): void => {
  trail = next;
  notify();
};

const remember = (location: string): void => {
  const path = pathOf(location);

  if (path === POP_HOME_PATH) return;

  recent = [location, ...recent.filter((entry) => pathOf(entry) !== path)].slice(0, MAX_RECENT);
};

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
};

const pathOf = (location: string): string => location.split('?')[0] ?? location;

/**
 * 지금 선 주소를 기록한다.
 *
 * - 바로 앞과 같은 화면이면 **주소만 바꿔 끼운다** — 같은 화면에서 쪽·인자만 바뀐 것을 두 칸으로
 *   두면 [이전]이 같은 화면으로 간다.
 * - 두 칸 앞과 같으면 **되돌아온 것**으로 보고 맨 끝을 걷는다 — 오가기만 해도 기록이 늘지 않는다.
 */
export const recordVisit = (location: string): void => {
  const last = trail.at(-1);

  remember(location);

  if (last === location) return;
  if (last !== undefined && pathOf(last) === pathOf(location)) {
    emit([...trail.slice(0, -1), location]);
    return;
  }
  if (trail.at(-2) === location) {
    emit(trail.slice(0, -1));
    return;
  }

  emit([...trail, location].slice(-MAX_ENTRIES));
};

/** 사용자 전환 — 기록을 비운다. 「최근 화면」도 함께 — 다음 사람의 것이 아니다. */
export const clearTrail = (): void => {
  if (trail.length === 0 && recent.length === 0) return;

  recent = [];
  emit([]);
};

/** [이전]이 갈 곳. 기록이 없으면 홈이다 — 돌아갈 곳이 «없는» 화면은 없다. */
export const previousOf = (entries: readonly string[]): string => entries.at(-2) ?? POP_HOME_PATH;

export const usePopTrail = (): readonly string[] => useSyncExternalStore(subscribe, () => trail);

/** 홈의 「최근 화면」 — 최근 것부터, 화면마다 마지막 주소 하나씩. 홈 자신은 담지 않는다. */
export const usePopRecent = (limit = 3): readonly string[] =>
  useSyncExternalStore(subscribe, () => recent).slice(0, limit);
