import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

/**
 * C-3, C-4, C-5 하단 고정 동작 바. 왼쪽에 안내 한 줄과 보조 동작([임시 저장] 등), 오른쪽에 [이전]과 주 동작.
 *
 * 사용자가 할 일이 있을 때만(`todo`) 「남은 일:」 머리말을 붙인다(C-5). 주 동작이 잠기면 이 줄이 사유이므로
 * 부르는 쪽이 `remainingId`를 버튼의 `aria-describedby`로 잇는다.
 * POP는 작업 시작(P-02-01)이 쓴다(`app/pop.css` 바닥 띠 규칙이 배치를 맡는다). 미구현: 모바일 셸 배치.
 */
const t = messages.screenPatterns.actionBar;

export interface ActionBarProps {
  /** 안내 문장. null이면 줄을 비운다. */
  remaining: string | null;
  /** 사용자가 할 일인가. 참이면 「남은 일:」을 붙인다. */
  todo?: boolean;
  /** 안내 뒤에 붙는 링크(고칠 곳이 다른 화면일 때, C-17). */
  remainingLink?: ReactNode;
  remainingId: string;
  /** 왼쪽 보조 동작(테두리 버튼) */
  leading?: ReactNode;
  children: ReactNode;
}

export const ActionBar = ({
  remaining,
  todo = false,
  remainingLink,
  remainingId,
  leading,
  children,
}: ActionBarProps) => (
  <div className="action-bar" role="region" aria-label={t.region}>
    <div className="action-bar-left">
      <p className="action-bar-remaining" id={remainingId} aria-live="polite">
        {remaining === null ? null : todo ? t.remaining(remaining) : remaining}
        {remainingLink !== undefined && remaining !== null && (
          <span className="action-bar-link">{remainingLink}</span>
        )}
      </p>
      {leading}
    </div>
    <div className="action-bar-actions">{children}</div>
  </div>
);
