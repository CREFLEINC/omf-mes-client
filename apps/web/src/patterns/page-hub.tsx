import { createContext, useContext, type ReactNode } from 'react';

/**
 * 탭 묶음을 «제목 아래»에 세우는 자리 — 셸(`app/layout.tsx`)이 `tabsInPage` 묶음일 때 채운다.
 *
 * 보통 탭 묶음은 셸이 본문 맨 위(제목 위)에 탭 막대를 세운다. 이 자리를 쓰는 묶음은 화면 머리가 묶음 이름을 제목으로
 * 쓰고 그 바로 아래에 탭을 둔다(검사 조회·판정 · 사용자 2026-10-26). 셸 밖(화면만 그린 시험)에서는 `null` 이다 —
 * 그때 화면은 자기 제목을 쓰고 탭을 그리지 않는다.
 */
export interface PageHub {
  /** 묶음 이름 — 화면 머리의 제목 · 경로 마디. */
  title: string;
  /** 권한으로 걸러진 탭 막대. */
  tabs: ReactNode;
}

export const PageHubContext = createContext<PageHub | null>(null);

export const usePageHub = (): PageHub | null => useContext(PageHubContext);
