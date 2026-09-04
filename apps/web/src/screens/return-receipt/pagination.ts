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
 * 쪽 이동의 경계 동작. DS에 쪽 이동 전용 컴포넌트가 없어 조합으로 만든다(design-system-v2-webui#72).
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
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
        ? messages.returnReceipt.page.total(meta.total)
        : messages.returnReceipt.page.range(start, start + shown - 1, meta.total),
  };
};
