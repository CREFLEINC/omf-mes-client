import { Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import type { PageView } from './pagination';

const t = messages.shipmentSchedule;

export interface PageNavProps {
  view: PageView;
  onChange: (page: number) => void;
}

/**
 * 쪽 이동 — 이전·다음과 지금 위치뿐이다. 쪽 번호 목록(1 2 3 … 10)을 만들지 않는다
 * (W-01-09와 같은 근거 — 예정 조회에서 「7쪽으로 점프」는 정상 경로가 아니다).
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 *
 * 단추는 기본 크기다 — 작은 크기(`sm`)로는 누르기 어렵다는 지적을 받았다(사용자 지시
 * 2026-09-22). 같은 이름의 다른 화면 부품과 크기가 달라지는 것은 감수한다.
 */
export const PageNav = ({ view, onChange }: PageNavProps) => (
  <nav className="form-actions" aria-label={t.pageNav.label}>
    <p className="field-note form-actions-secondary">{view.rangeLabel}</p>
    <Button
      variant="outlined"
      disabled={!view.canPrev}
      onClick={() => {
        onChange(view.page - 1);
      }}
    >
      {t.actions.prevPage}
    </Button>
    <Button
      variant="outlined"
      disabled={!view.canNext}
      onClick={() => {
        onChange(view.page + 1);
      }}
    >
      {t.actions.nextPage}
    </Button>
  </nav>
);
