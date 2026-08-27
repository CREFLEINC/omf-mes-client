import { messages } from '@omf-mes/i18n';

import type { PageMeta } from './types';

/**
 * 쪽 계산 — 「지금 어디를 보고 있는가」와 「어디로 갈 수 있는가」.
 *
 * 서버가 준 `page`를 정본으로 쓴다. 화면이 들고 있는 쪽 번호를 쓰면 서버가 다른 쪽을
 * 돌려줬을 때 표시와 내용이 어긋난다.
 *
 * **이 화면 슬라이스가 소유한다** — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 * 디자인 시스템에 페이지 이동 부품이 없어 조합으로 만드는 자리이고, 조합물은 쓰는 화면이
 * 소유한다(루트 CLAUDE.md 갭 분류 `c`).
 */

const t = messages.popMaterialLotLabel.pageNav;

export interface PageView {
  /** 1부터 센 현재 쪽 */
  page: number;
  totalPages: number;
  /** 「51–100 / 전체 120건」 */
  rangeLabel: string;
  canPrev: boolean;
  canNext: boolean;
  /** 결과가 있는데 이 쪽에는 없다 — 조건이 바뀌면 생긴다. 빈 상태의 안내가 갈린다. */
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
    rangeLabel: shown > 0 ? t.range(start, start + shown - 1, meta.total) : t.totalOnly(meta.total),
    canPrev: page > 1,
    canNext: page < totalPages,
    isBeyondLast: meta.total > 0 && page > totalPages,
  };
};
