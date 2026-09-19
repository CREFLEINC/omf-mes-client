import { Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { popTouchClass } from '../../patterns/pop-touch';
import type { PageView } from './pagination';

const t = messages.popMaterialLotLabel.pageNav;

export interface PageNavProps {
  view: PageView;
  /**
   * ⛔ **실행 중에는 쪽을 옮기지 못한다.** 옮기면 고른 줄이 풀려, 끝난 실행의 결과가 어느 줄에도
   * 서지 않는다 — 목록 줄을 잠그는 것과 같은 이유다.
   */
  isLocked: boolean;
  /**
   * ⚠ **쪽 번호를 주고받지 않는다.** 쪽 나눔이 두 겹이라(줄 쪽 → 건 쪽) 「+1」이 무엇을 뜻하는지
   *   이 부품이 알 수 없다 — 다음으로 갈지 앞으로 갈지만 말하고, 어디로 가는지는 화면이 셈한다.
   */
  onPrev: () => void;
  onNext: () => void;
}

/**
 * 쪽 이동 — 이전·다음과 지금 위치뿐이다.
 *
 * **쪽 번호 목록(1 2 3 … 10)을 만들지 않는다.** 생략 기호가 있는 번호 목록은 자기만의 생략
 * 규칙·현재 위치 표시·키보드 이동 규약을 갖는 별도의 부품이 되고, 장갑 낀 손으로 터치하는
 * 단말에서 「7쪽으로 점프」는 정상 경로가 아니다.
 *
 * 이동은 되돌리기 쉬운 조작이라 **일반 등급**이다(`popTouchClass`).
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const PageNav = ({ view, isLocked, onPrev, onNext }: PageNavProps) => (
  <nav className="pop-page-nav" aria-label={t.label}>
    {view.rangeLabel === '' ? null : <p className="field-note">{view.rangeLabel}</p>}
    <Button
      className={popTouchClass('normal')}
      variant="outlined"
      size="xl"
      disabled={isLocked || !view.canPrev}
      onClick={onPrev}
    >
      {t.prev}
    </Button>
    <Button
      className={popTouchClass('normal')}
      variant="outlined"
      size="xl"
      disabled={isLocked || !view.canNext}
      onClick={onNext}
    >
      {t.next}
    </Button>
  </nav>
);
