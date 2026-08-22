import { messages } from '@omf-mes/i18n';

import type { PageMeta } from './types';

const t = messages.productionOrder;

export interface PageView {
  page: number;
  canFirst: boolean;
  canPrev: boolean;
  canNext: boolean;
  isBeyondLast: boolean;
  rangeLabel: string;
}

/** 서버 PageMeta를 방어적인 순수 표시 상태로 바꾸는 유일한 지점이다. */
export const toPageView = (meta: PageMeta, shown: number): PageView => {
  const page = Number.isSafeInteger(meta.page) && meta.page > 0 ? meta.page : 1;
  const size = Number.isSafeInteger(meta.size) && meta.size > 0 ? meta.size : 1;
  const total = Number.isSafeInteger(meta.total) && meta.total > 0 ? meta.total : 0;
  const totalPages = Math.ceil(total / size);
  const isBeyondLast = total > 0 && page > totalPages;
  const canMoveBack = page > 1;
  const safeShown = Math.max(0, Math.min(shown, size));
  const start = (page - 1) * size + 1;
  const end = Math.min(total, start + safeShown - 1);

  return {
    page,
    canFirst: canMoveBack,
    canPrev: canMoveBack,
    canNext: total > 0 && page < totalPages,
    isBeyondLast,
    rangeLabel:
      safeShown === 0 || isBeyondLast ? t.page.total(total) : t.page.range(start, end, total),
  };
};
