import { Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import type { PageView } from './pagination';

const t = messages.productionOrder;

export interface PageNavProps {
  view: PageView;
  onChange: (page: number) => void;
}

export const PageNav = ({ view, onChange }: PageNavProps) => (
  <nav className="form-actions" aria-label={t.page.label}>
    <p className="field-note form-actions-secondary">{view.rangeLabel}</p>
    <Button
      variant="outlined"
      size="sm"
      disabled={!view.canFirst}
      onClick={() => {
        onChange(1);
      }}
    >
      {t.actions.firstPage}
    </Button>
    <Button
      variant="outlined"
      size="sm"
      disabled={!view.canPrev}
      onClick={() => {
        onChange(view.page - 1);
      }}
    >
      {t.actions.prevPage}
    </Button>
    <Button
      variant="outlined"
      size="sm"
      disabled={!view.canNext}
      onClick={() => {
        onChange(view.page + 1);
      }}
    >
      {t.actions.nextPage}
    </Button>
  </nav>
);
