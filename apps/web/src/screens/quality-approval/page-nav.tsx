import { Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import type { PageView } from './pagination';

export const PageNav = ({
  view,
  onChange,
}: {
  view: PageView;
  onChange: (page: number) => void;
}) => (
  <nav className="form-actions" aria-label={messages.qualityApproval.page.label}>
    <p className="field-note form-actions-secondary">{view.rangeLabel}</p>
    <Button
      variant="outlined"
      size="sm"
      disabled={!view.canPrev}
      onClick={() => onChange(view.page - 1)}
    >
      {messages.qualityApproval.actions.prevPage}
    </Button>
    <Button
      variant="outlined"
      size="sm"
      disabled={!view.canNext}
      onClick={() => onChange(view.page + 1)}
    >
      {messages.qualityApproval.actions.nextPage}
    </Button>
  </nav>
);
