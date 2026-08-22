import { messages } from '@omf-mes/i18n';

import type { PageMeta } from './types';

export interface PageView {
  page: number;
  canPrev: boolean;
  canNext: boolean;
  isBeyondLast: boolean;
  rangeLabel: string;
}

export const toPageView = (meta: PageMeta, shown: number): PageView => {
  const size = meta.size > 0 ? meta.size : 1;
  const page = meta.page > 0 ? meta.page : 1;
  const totalPages = Math.ceil(meta.total / size);
  const start = (page - 1) * size + 1;

  return {
    page,
    canPrev: page > 1,
    canNext: page < totalPages,
    isBeyondLast: meta.total > 0 && page > totalPages,
    rangeLabel:
      shown === 0
        ? messages.qualityApproval.page.total(meta.total)
        : messages.qualityApproval.page.range(start, start + shown - 1, meta.total),
  };
};
