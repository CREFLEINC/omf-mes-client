import { createContext, useContext } from 'react';

/**
 * 골격이 화면에 내주는 조작 — 지금은 **작업자 확인 창 열기** 하나다.
 *
 * ⭐ **왜 화면이 직접 창을 띄우지 않는가.** 작업자 확인 창은 셸이 하나만 들고 있어야 한다 —
 *    화면마다 띄우면 같은 창이 둘 겹치고, 확인한 사번이 어느 창의 것인지 갈린다. 화면(과 사번 없음
 *    띠)은 여기서 «열어 달라»고만 한다.
 *
 * ⚠ **골격 밖에서는 `null` 이다** — 화면 단위 시험·관리웹에서 그려질 때. 그때 띠는 단추 없이
 *   글만 선다.
 */
export interface PopShellActions {
  openWorkerSignIn: (() => void) | null;
}

export const PopShellActionsContext = createContext<PopShellActions>({ openWorkerSignIn: null });

export const usePopShellActions = (): PopShellActions => useContext(PopShellActionsContext);
