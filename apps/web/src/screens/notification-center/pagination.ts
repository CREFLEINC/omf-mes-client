import { messages } from '@omf-mes/i18n';

import type { PageMeta } from './types';

/**
 * 쪽 계산 — 「지금 어디를 보고 있는가」와 「어디로 갈 수 있는가」.
 *
 * **서버가 준 `page`를 정본으로 쓴다.** 주소의 쪽 번호를 쓰면 서버가 다른 쪽을 돌려줬을 때
 * 표시와 내용이 어긋난다.
 *
 * **쪽 크기를 화면이 정하지 않는다** — 범위 표기가 응답의 `size`에서만 나온다. 화면이 상수를
 * 심으면 서버 기본이 바뀔 때 두 값이 갈려 「51–100 / 전체 137건」이 실제와 어긋난다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.notificationCenter;

export interface PageView {
  /** 1부터 센 현재 쪽 */
  page: number;
  totalPages: number;
  /** 「51–100 / 전체 137건」 */
  rangeLabel: string;
  canPrev: boolean;
  canNext: boolean;
  /** 결과가 있는데 이 쪽에는 없다 — 주소 조작·조건 변경으로 생긴다. 빈 상태의 안내가 갈린다. */
  isBeyondLast: boolean;
}

export const toPageView = (meta: PageMeta, shown: number): PageView => {
  // 서버가 0을 주면 나눗셈이 무한대가 된다. 계산이 깨지지 않게 하한을 둔다.
  const size = meta.size > 0 ? meta.size : 1;
  const page = meta.page > 0 ? meta.page : 1;
  const totalPages = Math.ceil(meta.total / size);

  const start = (page - 1) * size + 1;

  return {
    page,
    totalPages,
    // 보이는 것이 없으면 범위를 지어내지 않는다. 전체 건수는 그대로 밝힌다.
    rangeLabel:
      shown > 0
        ? t.pageNav.range(start, start + shown - 1, meta.total)
        : t.pageNav.totalOnly(meta.total),
    canPrev: page > 1,
    canNext: page < totalPages,
    isBeyondLast: meta.total > 0 && page > totalPages,
  };
};
