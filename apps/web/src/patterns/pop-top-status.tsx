import { createContext, useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * 공통 메뉴 맨 위 줄의 «화면 상태» 자리(#291 · 사용자 지시 2026-11-17).
 *
 * ⭐ 연결(온라인·오프라인)·전송(미전송 n건·전송 완료) 표시는 화면마다 셈이 다르다 — 화면의 판정은 그대로
 *    두고, 그리던 칩만 맨 위 줄로 보낸다. 그래서 화면 머리줄에 그 한 줄만 남아 서던 행이 사라진다.
 *
 * - `undefined`: 공통 메뉴가 없다(화면 시험 · 단독 실행) — 그 자리에 그대로 그린다.
 * - `null`: 공통 메뉴는 있는데 자리가 아직 서지 않았다 — 잠깐 아무것도 그리지 않는다.
 */
export const PopTopStatusTarget = createContext<HTMLElement | null | undefined>(undefined);

export const PopTopStatus = ({ children }: { children: ReactNode }) => {
  const target = useContext(PopTopStatusTarget);

  if (target === undefined) return <>{children}</>;
  if (target === null) return null;

  return createPortal(children, target);
};
