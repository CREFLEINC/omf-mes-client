import { act, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  createTestQueryClient,
  jsonResponse,
  renderHookWithProviders,
  type StubRoute,
} from '../test/api-harness';
import { uomLabelOf, useItem, useItemCodes, useItemLabels, useItemSearch } from './masters';
import { referenceLabel } from './reference';

const page = { page: 0, size: 20, totalElements: 0, totalPages: 1 };

const item = (itemId: number) => ({
  itemId,
  itemCode: `RM-${String(itemId)}`,
  itemName: `자재${String(itemId)}`,
  fifoPolicyCode: 'FEFO',
});

/** 마스터가 큰 곳을 흉내 낸다. 목록 조회는 청한 만큼만 답하고 단건 조회는 전부 답한다. */
const masterRoutes = (size: number, seen: URL[]): StubRoute[] => {
  const all = Array.from({ length: size }, (_, index) => item(index + 1));

  return [
    {
      match: (request) => /^\/mdm\/items\/\d+$/.test(new URL(request.url).pathname),
      respond: (request) => {
        const url = new URL(request.url);
        seen.push(url);
        const itemId = Number(url.pathname.split('/').pop());
        const found = all.find((each) => each.itemId === itemId);

        return found === undefined
          ? jsonResponse({ message: '없음' }, { status: 404 })
          : jsonResponse({ item: found });
      },
    },
    {
      match: (request) => new URL(request.url).pathname === '/mdm/items',
      respond: (request) => {
        const url = new URL(request.url);
        seen.push(url);
        const q = url.searchParams.get('q');
        const asked = Number(url.searchParams.get('size') ?? '20');
        /* 계약의 쪽 번호는 1 부터다. 0 부터로 답하면 첫 쪽을 두 번 받는다. */
        const at = Number(url.searchParams.get('page') ?? '1');
        const matched = q === null ? all : all.filter((each) => each.itemCode.includes(q));
        const from = (at - 1) * asked;

        return jsonResponse({
          items: matched.slice(from, from + asked),
          page: { page: at, size: asked, total: matched.length },
        });
      },
    },
  ];
};

describe('품목 표시명', () => {
  /*
   * 실기에서 마스터가 9,000건인 곳의 코드순 앞 200건 밖 품목이 전부 이름 없이 섰다.
   * 목록 한 번으로 지도를 만들면 한 쪽에 담기는 만큼만 얻고 나머지는 조용히 빈다.
   */
  it('앞 쪽 밖의 품목도 이름을 얻는다', async () => {
    const seen: URL[] = [];
    const fetch = createStubFetch(masterRoutes(9000, seen));

    const { result } = renderHookWithProviders(() => useItemLabels([8999]), { fetch });

    await waitFor(() => {
      expect(result.current.get(8999)?.itemCode).toBe('RM-8999');
    });
  });

  /* 보이는 줄만큼만 부른다. 같은 품목이 여러 줄에 있어도 한 번이다. */
  it('같은 품목이 겹쳐 나와도 한 번만 묻는다', async () => {
    const seen: URL[] = [];
    const fetch = createStubFetch(masterRoutes(9000, seen));

    const { result } = renderHookWithProviders(() => useItemLabels([31, 31, 77, 31]), { fetch });

    await waitFor(() => {
      expect(result.current.size).toBe(2);
    });
    expect(seen.map((url) => url.pathname).sort()).toEqual(['/mdm/items/31', '/mdm/items/77']);
  });

  /*
   * 한 화면이 받아 둔 것을 다른 자리가 다시 부르면, 줄이 많은 화면에서 같은 조회가
   * 곱절로 나간다. 단건 조회와 열쇠가 같아야 캐시가 이어진다.
   */
  it('단건 조회와 받아 둔 것을 나눠 쓴다', async () => {
    const seen: URL[] = [];
    const fetch = createStubFetch(masterRoutes(9000, seen));
    const queryClient = createTestQueryClient();

    const labels = renderHookWithProviders(() => useItemLabels([31]), { fetch, queryClient });

    await waitFor(() => {
      expect(labels.result.current.size).toBe(1);
    });

    const single = renderHookWithProviders(() => useItem(31), { fetch, queryClient });

    await waitFor(() => {
      expect(single.result.current.data?.itemCode).toBe('RM-31');
    });
    expect(seen).toHaveLength(1);
  });
});

describe('품목 찾기', () => {
  /*
   * 찾는 말이 없어도 한 쪽은 보인다 - 적기 전에 아무것도 없으면 무엇을 적어야 하는지 모른다.
   * 다만 마스터 전부를 청하면 단말이 그것을 다 받아 늘어놓으려 한다.
   */
  it('찾는 말이 없어도 한 쪽만 청한다', async () => {
    const seen: URL[] = [];
    const fetch = createStubFetch(masterRoutes(9000, seen));

    const { result } = renderHookWithProviders(() => useItemSearch('   '), { fetch });

    await waitFor(() => {
      expect(result.current.data?.items.length).toBe(50);
    });
    expect(seen[0]?.searchParams.get('size')).toBe('50');
    expect(seen[0]?.searchParams.get('q')).toBeNull();
    /* 전체 건수를 함께 낸다. 남은 수를 못 세면 더 볼지 좁힐지 사람이 정할 수 없다. */
    expect(result.current.data?.total).toBe(9000);
  });

  /* 한 쪽으로 끝나지 않는다. 다음 쪽은 앞 쪽을 밀어내지 않고 뒤에 이어 붙는다. */
  it('더 부르면 앞 쪽 뒤에 이어 붙는다', async () => {
    const seen: URL[] = [];
    const fetch = createStubFetch(masterRoutes(120, seen));

    const { result } = renderHookWithProviders(() => useItemSearch(''), { fetch });

    await waitFor(() => {
      expect(result.current.data?.items.length).toBe(50);
    });

    await act(async () => {
      await result.current.fetchNextPage();
    });

    await waitFor(() => {
      expect(result.current.data?.items.length).toBe(100);
    });
    /* 앞 쪽이 그대로 앞에 있고 뒤 쪽이 뒤에 붙는다. */
    expect(result.current.data?.items[0]?.itemCode).toBe('RM-1');
    expect(result.current.data?.items[50]?.itemCode).toBe('RM-51');
    expect(seen[1]?.searchParams.get('page')).toBe('2');
  });

  /* 남은 것이 없으면 더 부를 자리를 내지 않는다. 끝없이 부르면 빈 쪽을 계속 받는다. */
  it('다 받으면 더 부를 것이 없다고 말한다', async () => {
    const seen: URL[] = [];
    const fetch = createStubFetch(masterRoutes(60, seen));

    const { result } = renderHookWithProviders(() => useItemSearch(''), { fetch });

    await waitFor(() => {
      expect(result.current.hasNextPage).toBe(true);
    });

    await act(async () => {
      await result.current.fetchNextPage();
    });

    await waitFor(() => {
      expect(result.current.data?.items.length).toBe(60);
    });
    expect(result.current.hasNextPage).toBe(false);
  });

  /*
   * 찾는 말이 바뀌면 쪽도 처음부터 다시 센다. 앞 말로 받아 둔 쪽이 새 말의 결과에 이어
   * 붙으면 찾지도 않은 품목이 목록에 남는다.
   */
  it('찾는 말을 지우면 쪽을 처음부터 다시 센다', async () => {
    const seen: URL[] = [];
    const fetch = createStubFetch(masterRoutes(120, seen));

    let term = '';
    const { result, rerender } = renderHookWithProviders(() => useItemSearch(term), { fetch });

    await waitFor(() => {
      expect(result.current.data?.items.length).toBe(50);
    });

    await act(async () => {
      await result.current.fetchNextPage();
    });

    await waitFor(() => {
      expect(result.current.data?.items.length).toBe(100);
    });

    term = 'RM-11';
    rerender();

    await waitFor(() => {
      expect(result.current.data?.items.every((each) => each.itemCode.includes('RM-11'))).toBe(
        true,
      );
    });

    /*
     * 지우면 첫 쪽부터 다시 본다. 앞서 펼쳐 둔 두 쪽이 그대로 돌아오면, 처음부터 다시
     * 보려고 지운 사람 앞에 100건이 펼쳐진 채로 서고 더 받을 자리는 그 끝에 있다.
     */
    term = '';
    rerender();

    await waitFor(() => {
      expect(result.current.data?.items.length).toBe(50);
    });
    expect(result.current.hasNextPage).toBe(true);
  });

  /* 앞에서 잘린 목록을 늘어놓으면 있는 품목이 없는 것으로 보여 고르지 못하고도 이유를 모른다. */
  it('앞 쪽 밖의 품목도 찾아서 고를 수 있다', async () => {
    const seen: URL[] = [];
    const fetch = createStubFetch(masterRoutes(9000, seen));

    const { result } = renderHookWithProviders(() => useItemSearch('RM-8999'), { fetch });

    await waitFor(() => {
      expect(result.current.data?.items[0]?.itemId).toBe(8999);
    });
    expect(seen[0]?.searchParams.get('q')).toBe('RM-8999');
  });
});

describe('품목 코드의 상태', () => {
  /*
   * 연결이 끊기면 목록은 캐시에서 뜨는데 품목 이름은 못 받는다. 그 자리를 빈 글자로 적으면
   * 사람은 품목이 원래 없는 줄로 읽고, 기다리면 채워질 것에 담당자를 부른다. 실제로 적치
   * 화면에서 일곱 줄의 품목이 통째로 사라졌다.
   */
  it('못 받았으면 연결되면 표시된다고 말한다', async () => {
    const fetch = createStubFetch([
      {
        match: (request) => /^\/mdm\/items\/\d+$/.test(new URL(request.url).pathname),
        respond: () => {
          throw new TypeError('Failed to fetch');
        },
      },
    ]);

    const { result } = renderHookWithProviders(() => useItemCodes([31]), { fetch });

    await waitFor(() => {
      expect(result.current(31).kind).toBe('failed');
    });
    expect(referenceLabel(result.current(31))).toBe('연결되면 표시됩니다');
  });

  /* 아직 오는 중인 것을 없다고 말하면, 정상 값이 잘못된 값으로 보인다. */
  it('아직 받는 중이면 받는 중이라고 말한다', () => {
    const fetch = createStubFetch(masterRoutes(9000, []));

    const { result } = renderHookWithProviders(() => useItemCodes([31]), { fetch });

    expect(result.current(31).kind).toBe('loading');
    expect(referenceLabel(result.current(31))).toBe('이름 불러오는 중');
  });

  it('받으면 품목 코드를 말한다', async () => {
    const fetch = createStubFetch(masterRoutes(9000, []));

    const { result } = renderHookWithProviders(() => useItemCodes([31]), { fetch });

    await waitFor(() => {
      expect(referenceLabel(result.current(31))).toBe('RM-31');
    });
  });

  /* 값이 없는 칸과 못 찾은 칸은 다르다. 빈 칸에 못 찾았다고 적으면 비어 있는 것이 잘못으로 읽힌다. */
  it('번호가 없으면 빈 값으로 둔다', () => {
    const fetch = createStubFetch(masterRoutes(9000, []));

    const { result } = renderHookWithProviders(() => useItemCodes([]), { fetch });

    expect(result.current(null).kind).toBe('empty');
    expect(referenceLabel(result.current(null))).toBe('—');
  });
});

describe('단위 표기', () => {
  const uoms = new Map([[1, 'KG']]);

  it('받은 단위는 그대로 보인다', () => {
    expect(uomLabelOf(uoms, 1)).toBe('KG');
  });

  /*
   * 빈 글자를 끼우면 수량 뒤가 그냥 비어, 40 이 마흔 개인지 마흔 킬로그램인지 가릴 수 없다 -
   * 한 목록에 EA 와 KG 가 섞여 선다.
   */
  it('못 받은 단위는 없다고 말한다', () => {
    expect(uomLabelOf(uoms, 77)).toBe('단위 없음');
    expect(uomLabelOf(undefined, 1)).toBe('단위 없음');
  });

  /*
   * 단위가 없는 것과 못 받은 것은 다르다. 설비 점검의 정성 항목처럼 단위 개념이 아예 없는
   * 자리에 없다고 적으면, 정상인 항목이 자료가 빠진 것으로 읽힌다.
   */
  it('단위 번호가 없는 자리는 비운다', () => {
    expect(uomLabelOf(uoms, null)).toBe('');
    expect(uomLabelOf(uoms, undefined)).toBe('');
  });
});
