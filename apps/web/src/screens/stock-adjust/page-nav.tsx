import { messages } from '@omf-mes/i18n';

import { PageNav as SharedPageNav } from '../../patterns/page-nav';
import type { ListPageSize } from './history-filters';
import type { PageMeta } from './types';

const t = messages.stockAdjust;

/**
 * 쪽 계산 — 「지금 어디를 보고 있는가」와 「어디로 갈 수 있는가」.
 *
 * **서버가 준 `page`를 정본으로 쓴다.** 주소의 쪽 번호를 쓰면 서버가 다른 쪽을 돌려줬을 때
 * 표시와 내용이 어긋난다.
 *
 * **상세의 라인 표에는 쪽이 없다.** 계약의 조정 상세가 라인을 전건으로 주고 쪽 정보를 싣지
 * 않는다(실측) — 이 계산은 이력 목록 표만 다룬다.
 */
export interface PageView {
  /** 1부터 센 현재 쪽 */
  page: number;
  /** 한 쪽 건수 · 전체 건수 — 공용 쪽 이동 줄(총 N건 · n / m)에 그대로 넘긴다(#360). */
  size: number;
  total: number;
  totalPages: number;
  /** 「51–100 / 전체 120건」 */
  rangeLabel: string;
  canPrev: boolean;
  canNext: boolean;
  /** 결과가 있는데 이 쪽에는 없다 — 주소 조작·조건 변경으로 생긴다. 빈 상태의 안내가 갈린다 */
  isBeyondLast: boolean;
}

export const toPageView = (meta: PageMeta, shown: number): PageView => {
  /* 서버가 0을 주면 나눗셈이 무한대가 된다. 계산이 깨지지 않게 하한을 둔다. */
  const size = meta.size > 0 ? meta.size : 1;
  const page = meta.page > 0 ? meta.page : 1;
  const totalPages = Math.ceil(meta.total / size);

  const start = (page - 1) * size + 1;

  return {
    page,
    size,
    total: meta.total,
    totalPages,
    /* 보이는 것이 없으면 범위를 지어내지 않는다. 전체 건수는 그대로 밝힌다. */
    rangeLabel:
      shown > 0
        ? t.pageNav.range(start, start + shown - 1, meta.total)
        : t.pageNav.totalOnly(meta.total),
    canPrev: page > 1,
    canNext: page < totalPages,
    isBeyondLast: meta.total > 0 && page > totalPages,
  };
};

export interface PageNavProps {
  view: PageView;
  /**
   * 잠겼는가. **쪽을 옮기면 고른 전표가 풀리므로**(조건이 바뀌는 것과 같은 자리) 나가는 중인
   * 쓰기가 있으면 잠근다 — 화면의 한 문(`applyUserNavigation`)이 둘째 겹으로 다시 막는다.
   */
  isLocked?: boolean;
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
