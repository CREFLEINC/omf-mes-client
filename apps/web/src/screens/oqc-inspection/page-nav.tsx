import { Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import type { PageView } from './pagination';

const t = messages.oqcInspection.pageNav;

export interface PageNavProps {
  view: PageView;
  /** 저장이 나가 있는 동안 잠근다 — 쪽이 바뀌면 고른 의뢰가 유지되지만 목록이 통째로 갈린다 */
  disabled?: boolean;
  onChange: (page: number) => void;
}

/**
 * 쪽 이동 — 이전·다음과 지금 위치뿐이다.
 *
 * **쪽 번호 목록(1 2 3 … 10)을 만들지 않는다.** 생략 기호가 있는 번호 목록은 자기만의 생략
 * 규칙·현재 위치 표시·키보드 이동 규약을 갖는 별도의 부품이 되고, 판정할 의뢰를 찾는 데
 * 「7쪽으로 점프」는 정상 경로가 아니다 — 품목·의뢰번호로 좁히는 것이 정상 경로다.
 *
 * 배치는 이미 있는 「하단 액션 줄」을 그대로 쓴다. 새 클래스를 만들지 않는다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const PageNav = ({ view, disabled = false, onChange }: PageNavProps) => (
  <nav className="form-actions" aria-label={t.label}>
    <p className="field-note form-actions-secondary">{view.rangeLabel}</p>
    <Button
      variant="outlined"
      size="sm"
      disabled={disabled || !view.canPrev}
      onClick={() => {
        onChange(view.page - 1);
      }}
    >
      {t.previous}
    </Button>
    <Button
      variant="outlined"
      size="sm"
      disabled={disabled || !view.canNext}
      onClick={() => {
        onChange(view.page + 1);
      }}
    >
      {t.next}
    </Button>
  </nav>
);
