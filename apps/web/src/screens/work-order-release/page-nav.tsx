import { Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import type { WorkOrderPageView } from '../work-order/pagination';

const t = messages.workOrderRelease.candidateList.page;

export interface PageNavProps {
  view: WorkOrderPageView;
  onChange: (page: number) => void;
}

/**
 * 배포 후보 목록의 쪽 이동 — 다른 목록 화면(`work-order-progress/page-nav` 등)과 같은 모양이다.
 * 건수 글 + 「이전」「다음」 작은 테두리 단추 둘. 이동할 수 없으면 비활성으로만 보인다.
 * 4M 화면의 `work-order/page-nav` 는 쪽마다 사유 문장을 달아 좁은 좌측 목록에서 목록보다 길어졌다.
 */
export const PageNav = ({ view, onChange }: PageNavProps) => (
  <nav className="form-actions work-order-release-page-nav" aria-label={t.label}>
    <p className="field-note form-actions-secondary">{view.rangeLabel}</p>
    <Button
      variant="outlined"
      disabled={!view.canPrev}
      onClick={() => {
        onChange(view.page - 1);
      }}
    >
      {t.prev}
    </Button>
    <Button
      variant="outlined"
      disabled={!view.canNext}
      onClick={() => {
        onChange(view.page + 1);
      }}
    >
      {t.next}
    </Button>
  </nav>
);
