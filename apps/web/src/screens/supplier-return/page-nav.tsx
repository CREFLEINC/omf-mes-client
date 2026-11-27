import { PageNav as SharedPageNav } from '../../patterns/page-nav';
import type { ListPageSize } from './filters';
import type { PageView } from './pagination';

export interface PageNavProps {
  view: PageView;
  /**
   * 전송 중인가. **쪽 이동도 대상을 바꾸는 길이다** — 쪽이 바뀌면 고른 전표가 풀리므로,
   * 열어 두면 앞 요청의 결과가 다른 맥락에 나타난다.
   */
  isLocked: boolean;
  onChange: (page: number) => void;
  /** 쪽 크기 선택 — 주면 「N건 ▾」를 그린다(품질 목록과 같은 10 · 20 · 50건 · #360). */
  sizes?: readonly ListPageSize[];
  onChangeSize?: (size: ListPageSize) => void;
}

/**
 * 쪽 이동 — 공용 쪽 이동 줄(총 N건 · [처음] [이전] n / m [다음] [마지막])로 그린다. 1쪽뿐이거나
 * 0건이어도 늘 보인다(단추는 잠긴 채 · #360). 쪽 크기(10 · 20 · 50건)를 고르면 그 size 로 다시 받는다 — 품질 목록과 같다.
 */
export const PageNav = ({
  view,
  isLocked = false,
  onChange,
  sizes,
  onChangeSize,
}: PageNavProps) => (
  <SharedPageNav
    meta={{ page: view.page, size: view.size, total: view.total }}
    disabled={isLocked}
    onChangePage={onChange}
    sizes={sizes}
    onChangeSize={onChangeSize}
  />
);
