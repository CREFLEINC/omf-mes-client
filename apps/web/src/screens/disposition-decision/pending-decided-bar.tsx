import type { ReactNode } from 'react';

/** 승인 · 반려된 처분 · 특채의 한 줄 — 문구와 [적용] · [반려 확인] 단추(#352). */
export const PendingDecidedBar = ({
  tone,
  text,
  children,
}: {
  tone: 'success' | 'warning';
  text: string;
  children: ReactNode;
}) => (
  <div
    className="iqc-inspection-action-note disposition-pending-concession"
    data-tone={tone}
    role="status"
  >
    <span>{text}</span>
    {children}
  </div>
);
