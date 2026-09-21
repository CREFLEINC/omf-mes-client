import { Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import type { WorkOrderPageView } from '../work-order/pagination';

const t = messages.productionPlan.resultPageNav;

export interface ResultPageNavProps {
  view: WorkOrderPageView;
  onChange: (page: number) => void;
}

/**
 * 전개 결과 목록의 쪽 이동.
 *
 * 같은 저장소의 `work-order/page-nav` 는 이동할 수 없는 사유를 단추마다 문장으로 달아 목록보다
 * 긴 안내가 화면을 채웠다(사용자 지시 2026-09-20). 그 부품은 다른 화면도 쓰므로 그대로 두고,
 * 이 구획은 건수와 단추 셋만 한 줄에 둔다 — 갈 수 없으면 비활성으로만 말한다.
 */
export const ResultPageNav = ({ view, onChange }: ResultPageNavProps) => (
  <nav className="form-actions production-plan-result-page-nav" aria-label={t.label}>
    <p className="field-note form-actions-secondary">{view.rangeLabel}</p>
    <Button
      size="md"
      variant="outlined"
      disabled={!view.canFirst}
      onClick={() => {
        onChange(1);
      }}
    >
      {t.first}
    </Button>
    <Button
      size="md"
      variant="outlined"
      disabled={!view.canPrev}
      onClick={() => {
        onChange(view.page - 1);
      }}
    >
      {t.prev}
    </Button>
    <Button
      size="md"
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
