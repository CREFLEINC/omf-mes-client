import { Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import type { WorkOrderPageView } from './pagination';

const t = messages.workOrder.assignmentPageNav;

export interface AssignmentPageNavProps {
  view: WorkOrderPageView;
  onChange: (page: number) => void;
}

/**
 * 4M 화면 작업지시 목록의 쪽 이동.
 *
 * 같은 슬라이스의 `page-nav` 는 쪽마다 이동할 수 없는 사유를 문장으로 달아 목록보다 긴 안내가
 * 늘어졌다(사용자 지시 2026-09-20). 그 부품은 생산계획·W/O 마감 화면도 쓰므로 그대로 두고,
 * 이 화면은 건수와 「이전」·「다음」만 두고 이동할 수 없으면 비활성으로 보인다.
 */
export const AssignmentPageNav = ({ view, onChange }: AssignmentPageNavProps) => (
  <nav className="form-actions work-order-assignment-page-nav" aria-label={t.label}>
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
