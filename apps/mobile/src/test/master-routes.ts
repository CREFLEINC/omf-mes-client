import { jsonResponse, type StubRoute } from './api-harness';

export interface StubItem {
  itemId: number;
  itemCode: string;
  itemName: string;
  fifoPolicyCode: string;
  storageConditionCode?: string | null;
  /** 수량에 붙는 단위. 계획에 없던 재고를 더할 때 화면이 이 값을 그대로 싣는다. */
  baseUomId?: number;
}

const ITEM_PATH = /^\/mdm\/items\/(\d+)$/;

/**
 * 품목 마스터 스텁.
 *
 * 화면은 보이는 줄의 품목만 하나씩 묻고, 작업자가 직접 고르는 자리만 찾는 말로 좁힌다.
 * 두 경로를 한 자리에서 답해야 스텁이 한쪽 계약만 맞는 일이 없다.
 */
export const itemRoutes = (items: readonly StubItem[]): StubRoute[] => [
  {
    match: (request) => ITEM_PATH.test(new URL(request.url).pathname),
    respond: (request) => {
      const itemId = Number(ITEM_PATH.exec(new URL(request.url).pathname)?.[1]);
      const found = items.find((item) => item.itemId === itemId);

      return found === undefined
        ? jsonResponse({ error: { code: 'NOT_FOUND' } }, { status: 404 })
        : jsonResponse({ item: found });
    },
  },
  {
    match: (request) => new URL(request.url).pathname === '/mdm/items',
    respond: (request) => {
      const url = new URL(request.url);
      const q = url.searchParams.get('q');
      /* 계약의 쪽 번호는 1 부터다. 0 부터로 답하면 첫 쪽을 두 번 받는다. */
      const at = Number(url.searchParams.get('page') ?? '1');
      const size = Number(url.searchParams.get('size') ?? '200');
      const matched =
        q === null
          ? items
          : items.filter((item) => item.itemCode.includes(q) || item.itemName.includes(q));
      const from = (at - 1) * size;

      return jsonResponse({
        items: matched.slice(from, from + size),
        page: { page: at, size, total: matched.length },
      });
    },
  },
];
