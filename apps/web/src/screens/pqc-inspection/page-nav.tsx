import { Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import type { PageView } from './pagination';

const t = messages.pqcInspection.pageNav;

export interface PageNavProps {
  view: PageView;
  onChange: (page: number) => void;
}

/**
 * 쪽 이동 — 이전·다음과 지금 위치뿐이다.
 *
 * **쪽 번호 목록(1 2 3 … 10)을 만들지 않는다.** 생략 기호가 있는 번호 목록은 자기만의 생략
 * 규칙·현재 위치 표시·키보드 이동 규약을 갖는 별도의 부품이 되고, 검사할 의뢰를 찾는 데
 * 「7쪽으로 점프」는 정상 경로가 아니다 — 품목·공급사·의뢰번호로 좁히는 것이 정상 경로다.
 *
 * **전송 중 잠금이 아직 없다.** 이 회차에는 쓰기가 하나도 없어 잠글 것이 없다 — 결과 입력이
 * 생기는 회차에서 이 부품이 그 잠금을 받는다(쪽이 바뀌면 고른 의뢰가 풀리므로, 전송 중에
 * 열어 두면 앞 요청의 결과가 다른 맥락에 나타난다).
 *
 * 배치는 이미 있는 「하단 액션 줄」을 그대로 쓴다. 새 클래스를 만들지 않는다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const PageNav = ({ view, onChange }: PageNavProps) => (
  <nav className="form-actions" aria-label={t.label}>
    <p className="field-note form-actions-secondary">{view.rangeLabel}</p>
    <Button
      variant="outlined"
      size="sm"
      disabled={!view.canPrev}
      onClick={() => {
        onChange(view.page - 1);
      }}
    >
      {t.previous}
    </Button>
    <Button
      variant="outlined"
      size="sm"
      disabled={!view.canNext}
      onClick={() => {
        onChange(view.page + 1);
      }}
    >
      {t.next}
    </Button>
  </nav>
);
