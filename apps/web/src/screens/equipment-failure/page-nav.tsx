import { PageNav as SharedPageNav } from '../../patterns/page-nav';
import type { PageView } from './pagination';

export interface PageNavProps {
  view: PageView;
  onChange: (page: number) => void;
  /** 고를 쪽 크기 — 주면 「N건 ▾」 쪽 크기 선택을 그린다(품질 화면과 같다 · #360). */
  sizes?: readonly number[];
  onChangeSize?: (size: number) => void;
}

/**
 * 쪽 이동 — 공용 쪽 이동 줄(총 N건 · [처음] [이전] n / m [다음] [마지막])로 그린다. 1쪽뿐이거나
 * 0건이어도 늘 보인다(단추는 잠긴 채 · #360). 왼쪽 「N건 ▾」에서 쪽 크기를 고른다(품질 화면과 같다).
 */
export const PageNav = ({ view, onChange, sizes, onChangeSize }: PageNavProps) => (
  <SharedPageNav
    meta={{ page: view.page, size: view.size, total: view.total }}
    onChangePage={onChange}
    sizes={sizes}
    onChangeSize={onChangeSize}
  />
);
