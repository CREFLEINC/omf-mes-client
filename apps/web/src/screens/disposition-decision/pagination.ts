import { messages } from '@omf-mes/i18n';

import type { PageMeta } from './types';

export interface PageView {
  page: number;
  canPrev: boolean;
  canNext: boolean;
  isBeyondLast: boolean;
  rangeLabel: string;
}

/**
 * 쪽 이동의 경계 동작을 한 곳에 모은다 — 목록이 둘(판정 대기·처리 이력)이라
 * 각 목록이 제 나름의 경계 판정을 갖게 두면 같은 자리에서 다르게 동작한다.
 *
 * DS에 쪽 이동 전용 컴포넌트가 없어 조합으로 만든다(design-system-v2-webui#72).
 */
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
        ? messages.dispositionDecision.page.total(meta.total)
        : messages.dispositionDecision.page.range(start, start + shown - 1, meta.total),
  };
};
