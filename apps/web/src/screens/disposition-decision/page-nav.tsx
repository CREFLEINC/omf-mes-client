import { Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import type { PageView } from './pagination';

export interface PageNavProps {
  view: PageView;
  label: string;
  onChange: (page: number) => void;
}

/** DS에 쪽 이동 컴포넌트가 없어 조합으로 만든다(design-system-v2-webui#72). */
export const PageNav = ({ view, label, onChange }: PageNavProps) => (
  <nav className="form-actions" aria-label={label}>
    <p className="field-note form-actions-secondary">{view.rangeLabel}</p>
    <Button
      variant="outlined"
      size="sm"
      disabled={!view.canPrev}
      onClick={() => onChange(view.page - 1)}
    >
      {messages.dispositionDecision.actions.prevPage}
    </Button>
    <Button
      variant="outlined"
      size="sm"
      disabled={!view.canNext}
      onClick={() => onChange(view.page + 1)}
    >
      {messages.dispositionDecision.actions.nextPage}
    </Button>
  </nav>
);
