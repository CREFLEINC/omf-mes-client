import { PageNav as SharedPageNav } from '../../patterns/page-nav';
import type { WorkOrderPageView } from './pagination';

export interface PageNavProps {
  view: WorkOrderPageView;
  onChange: (page: number) => void;
}

/**
 * 쪽 이동 — 공용 쪽 이동 줄(총 N건 · [처음] [이전] n / m [다음] [마지막])로 그린다. 1쪽뿐이거나
 * 0건이어도 늘 보인다(단추는 잠긴 채 · #360). 쪽 크기는 이 화면이 서버에 정해진 값으로 보내므로
 * 고르는 칸을 두지 않는다 — 넘기는 page · size 는 그대로다.
 */
export const PageNav = ({ view, onChange }: PageNavProps) => (
  <SharedPageNav
    meta={{ page: view.page, size: view.size, total: view.total }}
    onChangePage={onChange}
  />
);
