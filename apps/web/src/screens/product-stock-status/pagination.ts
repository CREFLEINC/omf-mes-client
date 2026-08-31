import { messages } from '@omf-mes/i18n';

import type { PageMeta } from './types';

/**
 * 쪽 계산 — 「지금 어디를 보고 있는가」와 「어디로 갈 수 있는가」.
 *
 * 서버가 준 `page`를 정본으로 쓴다. W-01-07의 같은 이름 파일을 그대로 옮겼다 — 아직 공용
 * 쪽 이동 키트가 없다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.productStockStatus;

export interface PageView {
  /** 1부터 센 현재 쪽 */
  page: number;
  totalPages: number;
  /** 「101–150 / 전체 240건」 */
  rangeLabel: string;
  canPrev: boolean;
  canNext: boolean;
  /** 결과가 있는데 이 쪽에는 없다 — 주소 조작·조건 변경으로 생긴다. */
  isBeyondLast: boolean;
}

export const toPageView = (meta: PageMeta, shown: number): PageView => {
  const size = meta.size > 0 ? meta.size : 1;
  const page = meta.page > 0 ? meta.page : 1;
  const totalPages = Math.ceil(meta.total / size);

  const start = (page - 1) * size + 1;

  return {
    page,
    totalPages,
    rangeLabel:
      shown > 0
        ? t.pageNav.range(start, start + shown - 1, meta.total)
        : t.pageNav.totalOnly(meta.total),
    canPrev: page > 1,
    canNext: page < totalPages,
    isBeyondLast: meta.total > 0 && page > totalPages,
  };
};
