import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createStubFetch, jsonResponse, renderHookWithProviders } from '../../test/api-harness';
import { keepDocumentScroll } from './concession-pane';
import { useItemLookupFor } from './lookups';

/** W-03-10 품목 이름(G2 L-c) — 첫 쪽 목록 밖 품목은 단건으로 받는다. 값은 지어낸 것이다. */

const item = (itemId: number, itemCode: string, itemName: string) => ({
  itemId,
  itemCode,
  itemName,
  isActive: true,
});

describe('W-03-10 품목 이름', () => {
  it('G2 L-c 첫 쪽(/mdm/items)에 없는 품목은 /mdm/items/{id} 로 받아 이름을 채우고, 있는 품목은 다시 부르지 않는다', async () => {
    const singles: string[] = [];
    const fetch = createStubFetch([
      {
        match: (request) => new URL(request.url).pathname === '/mdm/items',
        respond: () =>
          jsonResponse({
            items: [item(1, 'SAMPLE-I-1', '합성 품목 하나')],
            page: { page: 1, size: 50, total: 9000 },
          }),
      },
      {
        match: (request) => /^\/mdm\/items\/\d+$/u.test(new URL(request.url).pathname),
        respond: (request) => {
          singles.push(new URL(request.url).pathname);
          return jsonResponse({ item: item(777, 'SAMPLE-I-777', '합성 첫 쪽 밖 품목') });
        },
      },
    ]);

    const { result } = renderHookWithProviders(() => useItemLookupFor([1, 777, null]), { fetch });

    await waitFor(() =>
      expect(result.current.entries.find((entry) => entry.value === '777')?.label).toBe(
        'SAMPLE-I-777 · 합성 첫 쪽 밖 품목',
      ),
    );
    expect(singles).toEqual(['/mdm/items/777']);
  });
});

describe('G2 L14-1 특채 요청 창이 열릴 때 문서가 밀리지 않게', () => {
  it('누른 순간의 문서 스크롤 자리로 다음 틀에서 되돌린다', async () => {
    const root = document.scrollingElement ?? document.documentElement;
    root.scrollTop = 0;
    keepDocumentScroll();
    /* 창이 열리며 포커스 이동으로 문서가 밀린 것을 흉내 낸다. */
    root.scrollTop = 152;

    await waitFor(() => expect(root.scrollTop).toBe(0));
  });
});

