import { Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import type { PageView } from './pagination';

const t = messages.maintenanceOrder;

export interface PageNavProps {
  view: PageView;
  onChange: (page: number) => void;
}

/**
 * 쪽 이동 — 이전·다음과 지금 위치뿐이다. 쪽 번호 목록(1 2 3 … 10)을 만들지 않는다
 * (W-01-09와 같은 근거 — 예정 조회에서 「7쪽으로 점프」는 정상 경로가 아니다).
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const PageNav = ({ view, onChange }: PageNavProps) => (
  <nav className="form-actions" aria-label={t.pageNav.label}>
    <p className="field-note form-actions-secondary">{view.rangeLabel}</p>
    <Button
      variant="outlined"
      size="sm"
      disabled={!view.canPrev}
      onClick={() => {
        onChange(view.page - 1);
      }}
    >
      {t.pageNav.prev}
    </Button>
    <Button
      variant="outlined"
      size="sm"
      disabled={!view.canNext}
      onClick={() => {
        onChange(view.page + 1);
      }}
    >
      {t.pageNav.next}
    </Button>
  </nav>
);
