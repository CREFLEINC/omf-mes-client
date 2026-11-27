import { PageNav as SharedPageNav } from '../../patterns/page-nav';
import type { ListPageSize } from './filters';
import type { PageView } from './pagination';

export interface PageNavProps {
  /**
   * 전송 중인가. **첫째 겹**이다 — 쪽을 옮기면 고른 전표가 풀려(수명 표 3행) 나가는 중인
   * 상신의 결과가 다른 맥락에 도착한다. 핸들러 가드(둘째 겹)와 짝이다.
   */
  isLocked?: boolean;
  view: PageView;
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
