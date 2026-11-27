import { PageNav as SharedPageNav } from '../../patterns/page-nav';
import type { PageView } from './pagination';

export interface PageNavProps {
  /**
   * 전송 중인가. **첫째 겹**이다 — 쪽을 옮기면 고른 전표가 풀려(수명 표 3행) 나가는 중인
   * 상신의 결과가 다른 맥락에 도착한다. 핸들러 가드(둘째 겹)와 짝이다.
   */
  isLocked?: boolean;
  view: PageView;
  onChange: (page: number) => void;
}

/**
 * 쪽 이동 — 공용 쪽 이동 줄(총 N건 · [처음] [이전] n / m [다음] [마지막])로 그린다. 1쪽뿐이거나
 * 0건이어도 늘 보인다(단추는 잠긴 채 · #360). 쪽 크기는 이 화면이 서버에 정해진 값으로 보내므로
 * 고르는 칸을 두지 않는다 — 넘기는 page · size 는 그대로다.
 */
export const PageNav = ({ view, isLocked = false, onChange }: PageNavProps) => (
  <SharedPageNav
    meta={{ page: view.page, size: view.size, total: view.total }}
    disabled={isLocked}
    onChangePage={onChange}
  />
);
