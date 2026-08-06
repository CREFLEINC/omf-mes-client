import { Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import type { PageView } from './pagination';

const t = messages.inspectionStandard;

export interface PageNavProps {
  view: PageView;
  onChange: (page: number) => void;
}

/**
 * 쪽 이동 — 이전·다음과 지금 위치뿐이다.
 *
 * **쪽 번호 목록(1 2 3 … 10)을 만들지 않는다.** 생략 기호가 있는 번호 목록은 자기만의
 * 생략 규칙·현재 위치 표시·키보드 이동 규약을 갖는 별도의 부품(갈래 `d`)이 된다.
 * 여기서는 기존 `Button`의 조합(갈래 `c`)으로 남긴다.
 *
 * **좌 목록에만 둔다.** W-06-01의 좌 목록은 다른 화면이 소유한 마스터에서 고르는 자리였지만
 * 이 화면의 좌 목록은 방금 등록한 기준을 다시 찾는 자리다 — 기본 쪽 크기 밖으로 밀린 기준을
 * 찾을 방법이 없으면 그것은 기능 결함이다.
 *
 * 배치는 이미 있는 「하단 액션 줄」을 그대로 쓴다. 새 클래스를 만들지 않는다.
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
