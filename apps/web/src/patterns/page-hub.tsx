import { createContext, useContext } from 'react';

/**
 * 지금 화면이 탭 묶음 안에 있는가 — 셸(`app/layout.tsx`)이 본문 맨 위에 탭 막대를 세웠을 때 채운다.
 *
 * 탭 막대가 화면 이름을 말하므로, 이 값을 읽는 화면은 묶음 안에서 경로·제목(PageHeader)을 세우지 않는다
 * (입하 예정 조회와 같은 모양 · 사용자 2026-10-26). 셸 밖(화면만 그린 시험)이나 볼 수 있는 탭이 하나뿐이면 `null` 이다 —
 * 그때 화면은 자기 머리를 그대로 세운다.
 */
export interface PageHub {
  /** 묶음 이름. */
  title: string;
}

export const PageHubContext = createContext<PageHub | null>(null);

export const usePageHub = (): PageHub | null => useContext(PageHubContext);
