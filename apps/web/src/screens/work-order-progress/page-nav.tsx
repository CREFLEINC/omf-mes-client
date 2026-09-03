import { Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import type { PageView } from './pagination';

export interface PageNavProps {
  view: PageView;
  onChange: (page: number) => void;
}

/**
 * 쪽 이동. DS 에 전용 부품이 없어 조합으로 만든다(design-system-v2-webui#72).
 *
 * 경계 판정은 `pagination` 이 갖는다 — 버튼과 안내가 **같은 계산**을 보게 하려는 것이다.
 */
export const PageNav = ({ view, onChange }: PageNavProps) => {
  const t = messages.workOrderProgress.page;

  return (
    <nav className="form-actions work-order-progress-page-nav" aria-label={t.label}>
      <p className="field-note form-actions-secondary">{view.rangeLabel}</p>
      <Button
        variant="outlined"
        size="sm"
        disabled={!view.canPrev}
        onClick={() => {
          onChange(view.page - 1);
        }}
      >
        {t.prev}
      </Button>
      <Button
        variant="outlined"
        size="sm"
        disabled={!view.canNext}
        onClick={() => {
          onChange(view.page + 1);
        }}
      >
        {t.next}
      </Button>
    </nav>
  );
};
