import { Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import type { PageView } from './pagination';

const t = messages.stocktaking;

export interface PageNavProps {
  view: PageView;
  /** 전송 중인가. 쪽을 옮기면 **앞 요청의 결과가 다른 쪽 맥락에 나타난다**. */
  isLocked: boolean;
  onChange: (page: number) => void;
}

/**
 * 쪽 이동 — 이전·다음과 지금 위치뿐이다.
 *
 * **쪽 번호 목록(1 2 3 … 10)을 만들지 않는다.** 생략 기호가 있는 번호 목록은 자기만의
 * 생략 규칙·현재 위치 표시·키보드 이동 규약을 갖는 별도의 부품이 되고, 실사를 찾는 데
 * 「7쪽으로 점프」는 정상 경로가 아니다 — 창고·계획일·「진행 중만」으로 좁히는 것이 정상 경로다.
 *
 * **전송 중에는 두 버튼이 잠긴다**(수명 표 18행 · PR ②에서 붙었다). 쪽 이동은 고른 실사를
 * 비우는 길이라, 보내는 동안 열어 두면 사용자가 다른 쪽으로 옮긴 뒤 **앞 요청의 결과가 지금
 * 보는 맥락에 나타난다.**
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
