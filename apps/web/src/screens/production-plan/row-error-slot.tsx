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

  /*
   * 자리를 «매번» 다시 찾는다 — 표가 다시 그려져 자리가 바뀌면, 한 번만 찾아 둔 옛 노드로 그려
   * 저장 오류가 조용히 사라진다(리뷰 지적 2026-09-21). 같은 노드면 상태를 건드리지 않는다.
   */
  useEffect(() => {
    const found = document.querySelector<HTMLElement>(`[${PLAN_ROW_ERROR_SLOT}]`);
    setHost((prev) => (prev === found ? prev : found));
  });

  if (host === null) return <>{children}</>;
  return createPortal(children, host);
};
