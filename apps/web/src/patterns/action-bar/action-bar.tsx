import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

const t = messages.common.processPage;

export interface ActionBarProps {
  /**
   * 「남은 일」 한 줄(C-5). 지금 해야 할 한 가지를 동사로 끝낸다.
   * 주 동작이 비활성이면 이 문장이 그 사유다 — 버튼의 `aria-describedby`에 `remainingId`를 준다(C-4).
   */
  remaining?: string;
  /** 「남은 일」 문장의 `id`. 화면이 주 동작 버튼과 잇는 데 쓴다 */
  remainingId: string;
  /**
   * 오른쪽 버튼 묶음. 왼쪽부터 보조 → 주 동작 순으로 넘긴다.
   * 채움(`filled`) 버튼은 하나만 둔다(C-3).
   */
  children: ReactNode;
}

/**
 * 하단 고정 동작 바 — 화면 구성 규범 C-3·C-4·C-5.
 *
 * 왼쪽에 「남은 일: 〈할 일〉」, 오른쪽에 버튼 묶음. 본문이 길어도 화면 아래에 붙어 있다
 * (`position: sticky`, `app.css`의 `.action-bar`). 처리 화면(`ProcessPage`)이 쓰고,
 * POP·모바일 하단 바도 같은 모양을 쓴다.
 */
export const ActionBar = ({ remaining, remainingId, children }: ActionBarProps) => (
  <div className="action-bar" role="region" aria-label={t.actionBar}>
    <p className="action-bar-remaining" id={remainingId}>
      {remaining !== undefined && (
        <>
          <span className="action-bar-remaining-label">{t.remaining}:</span> {remaining}
        </>
      )}
    </p>
    <div className="action-bar-actions">{children}</div>
  </div>
);
