import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** 표 아래 오류 자리를 찾는 표식. 편집 구획이 하나만 둔다. */
export const PLAN_ROW_ERROR_SLOT = 'data-plan-error-slot';

/**
 * 줄 단추가 만든 오류 안내를 표 «아래»에 모아 보인다(사용자 지시 2026-09-21).
 *
 * 안내가 「작업」 칸 안에서 그려지면 칸 너비(12rem)에 눌려 글이 한 글자씩 쪼개진다. 자리만 옮기고
 * 내용·동작은 그대로 둔다. 자리를 못 찾으면(검사 등) 있던 곳에 그대로 그린다.
 */
export const ProductionPlanRowErrorSlot = ({ children }: { children: ReactNode }) => {
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setHost(document.querySelector<HTMLElement>(`[${PLAN_ROW_ERROR_SLOT}]`));
  }, []);

  if (host === null) return <>{children}</>;
  return createPortal(children, host);
};
