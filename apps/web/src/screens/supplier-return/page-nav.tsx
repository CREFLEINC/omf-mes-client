import { PageNav as SharedPageNav } from '../../patterns/page-nav';
import type { PageView } from './pagination';

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
