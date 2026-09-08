import type { PageMeta } from './types';

export interface PagedItems<T> {
  items: T[];
  page: PageMeta;
}

export class IncompletePageError extends Error {
  constructor() {
    super('마지막 쪽까지 받지 못했습니다.');
    this.name = 'IncompletePageError';
  }
}

export interface FetchAllPagesOptions {
  /** 일부 쪽이라도 빠지면 잘못된 판정이 되는 조회인지 여부. */
  requireComplete?: boolean;
}

/**
 * 선택·판정에 쓰는 목록은 첫 쪽만 보고 끝내지 않는다.
 *
 * 서버가 요청 크기를 낮춰 적용할 수도 있으므로 응답 `size`가 아니라 실제 누적 건수와
 * `total`을 견준다. 빈 쪽이 오면 더 진행해도 새 사실을 얻을 수 없어 멈춘다.
 */
export const fetchAllPages = async <T>(
  fetchPage: (page: number) => Promise<PagedItems<T>>,
  options: FetchAllPagesOptions = {},
): Promise<PagedItems<T>> => {
  const first = await fetchPage(1);
  const items = [...first.items];
  let page = 2;

  while (items.length < first.page.total) {
    const next = await fetchPage(page);

    if (next.items.length === 0 || next.page.page !== page) {
      if (options.requireComplete) throw new IncompletePageError();
      break;
    }
    items.push(...next.items);
    page += 1;
  }

  return {
    items,
    page: { page: 1, size: items.length, total: first.page.total },
  };
};
