/**
 * 홈 바로가기 고른 것(#291) — **이 단말에만** 둔다(프린터 기억과 같은 자리 · `localStorage`).
 *
 * ⭐ 단말 하나를 여러 작업자가 돌려 쓰므로 사람이 아니라 단말의 설정이다. 서버에 둘 자리가 아직 없다
 *    (화면 작업에서 서버를 고치지 않는다).
 * ⛔ 읽기·쓰기에 실패해도 화면은 선다 — 그때는 기본 바로가기를 보인다.
 */
const STORAGE_KEY = 'omf.pop.home.shortcuts';

export const MAX_SHORTCUTS = 6;

/**
 * 기본 바로가기(확정 시안의 여섯 칸 — PQC 제품 검사를 없애 다섯 칸, omf-all-around#293).
 * 피처 010 — 출하 포장(P-04-01)은 화면 이동 후보에서 감춰 기본에서도 뺐다(넷).
 */
export const DEFAULT_SHORTCUT_PATHS: readonly string[] = [
  '/pop/production-result',
  '/pop/work-start',
  '/pop/work-hold',
  '/pop/material-input',
];

/** 고른 것이 없거나 읽지 못하면 `null` — 기본을 쓴다. */
export const readShortcutPaths = (): string[] | null => {
  try {
    const raw: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (!Array.isArray(raw)) return null;
    return raw.filter((path): path is string => typeof path === 'string').slice(0, MAX_SHORTCUTS);
  } catch {
    return null;
  }
};

/** `null` 이면 지운다(기본으로). */
export const writeShortcutPaths = (paths: readonly string[] | null): void => {
  try {
    if (paths === null) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, JSON.stringify(paths));
  } catch {
    /* 저장하지 못해도 이번 화면에는 고른 대로 보인다 — 다시 켜면 기본으로 돌아간다. */
  }
};
