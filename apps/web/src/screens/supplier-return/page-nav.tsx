import { Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import type { PageView } from './pagination';

const t = messages.supplierReturn;

export interface PageNavProps {
  view: PageView;
  /**
   * 전송 중인가. **쪽 이동도 대상을 바꾸는 길이다** — 쪽이 바뀌면 고른 전표가 풀리므로,
   * 열어 두면 앞 요청의 결과가 다른 맥락에 나타난다.
   */
  isLocked: boolean;
  onChange: (page: number) => void;
}

/**
 * 쪽 이동 — 이전·다음과 지금 위치뿐이다.
 *
 * **쪽 번호 목록(1 2 3 … 10)을 만들지 않는다.** 생략 기호가 있는 번호 목록은 자기만의
 * 생략 규칙·현재 위치 표시·키보드 이동 규약을 갖는 별도의 부품이 되고, 되돌려 보낼 자재를
 * 찾는 데 「7쪽으로 점프」는 정상 경로가 아니다 — 입고번호로 좁히는 것이 정상 경로다.
 *
 * **전송 중에는 두 버튼이 함께 잠긴다**(첫째 겹). 쪽이 바뀌면 고른 전표가 풀리는데, 그 순간
 * 앞서 보낸 반품의 결과가 다른 전표 맥락에 나타난다.
 *
 * 배치는 이미 있는 「하단 액션 줄」을 그대로 쓴다. 새 클래스를 만들지 않는다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const PageNav = ({ view, isLocked, onChange }: PageNavProps) => (
  <nav className="form-actions" aria-label={t.pageNav.label}>
    <p className="field-note form-actions-secondary">{view.rangeLabel}</p>
    <Button
      variant="outlined"
      size="sm"
      disabled={!view.canPrev || isLocked}
      onClick={() => {
        onChange(view.page - 1);
      }}
    >
      {t.actions.prevPage}
    </Button>
    <Button
      variant="outlined"
      size="sm"
      disabled={!view.canNext || isLocked}
      onClick={() => {
        onChange(view.page + 1);
      }}
    >
      {t.actions.nextPage}
    </Button>
  </nav>
);
