import { Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import type { PageView } from './page-view';

const t = messages.common.pageNav;

export interface PageNavProps {
  view: PageView;
  /** 화면이 쓰기를 보내는 중이면 쪽을 옮기지 않는다 */
  disabled?: boolean;
  onChange: (page: number) => void;
}

/**
 * 쪽 이동 — 화면 구성 규범 C-8.
 *
 * 왼쪽에 총 건수와 페이지 크기, 오른쪽에 [처음] [이전] n/N [다음] [마지막].
 * 비활성 버튼에 사유 문장을 붙이지 않는다(위치로 자명, C-8). 쪽 이동 버튼은 보조 동작이라
 * 채움 버튼을 쓰지 않는다(C-3).
 */
export const PageNav = ({ view, disabled = false, onChange }: PageNavProps) => {
  const lastPage = Math.max(view.totalPages, 1);

  return (
    <nav className="page-nav" aria-label={t.label}>
      <p className="page-nav-count">
        {t.total(view.total)}
        <span className="page-nav-size">{t.size(view.size)}</span>
      </p>
      <div className="page-nav-buttons">
        <Button
          variant="outlined"
          size="sm"
          disabled={!view.canPrev || disabled}
          onClick={() => {
            onChange(1);
          }}
        >
          {t.first}
        </Button>
        <Button
          variant="outlined"
          size="sm"
          disabled={!view.canPrev || disabled}
          onClick={() => {
            onChange(view.page - 1);
          }}
        >
          {t.prev}
        </Button>
        <span className="page-nav-position" aria-current="page">
          {t.position(Math.min(view.page, lastPage), lastPage)}
        </span>
        <Button
          variant="outlined"
          size="sm"
          disabled={!view.canNext || disabled}
          onClick={() => {
            onChange(view.page + 1);
          }}
        >
          {t.next}
        </Button>
        <Button
          variant="outlined"
          size="sm"
          disabled={!view.canNext || disabled}
          onClick={() => {
            onChange(lastPage);
          }}
        >
          {t.last}
        </Button>
      </div>
    </nav>
  );
};
