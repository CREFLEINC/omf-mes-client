import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { jsonResponse, renderHookWithProviders, type StubFetch } from '../../test/api-harness';
import {
  STATUS_OPTION_SIZE,
  useWorkOrderStatusOptions,
  WORK_ORDER_STATUS_GROUP_CODE,
} from './status-options';

const codeValue = (
  code: string,
  codeName: string,
  displayOrder: number,
): Record<string, unknown> => ({
  codeValueId: 9000 + displayOrder,
  codeGroupId: 42,
  code,
  codeName,
  displayOrder,
  isActive: true,
});

const stub = (
  options: { fail?: boolean; items?: Record<string, unknown>[] } = {},
): { urls: string[]; fetch: StubFetch } => {
  const urls: string[] = [];
  const fetch: StubFetch = async (request) => {
    const url = new URL(request.url);
    urls.push(`${url.pathname}${url.search}`);

    if (options.fail === true) return jsonResponse({ message: '실패' }, { status: 500 });

    /*
     * 표시순서와 이름순이 **갈리게** 짠 값이다 — 같으면 「마스터 순서를 따른다」와 「이름순으로
     * 다시 줄 세운다」를 감지기가 구분하지 못한다. 받는 순서도 낼 순서와 다르게 둔다.
     */
    const items = options.items ?? [
      codeValue('SYN_WAIT', '대기', 2),
      codeValue('SYN_RUN', '진행중', 1),
    ];
    return jsonResponse({ items, page: { page: 1, size: 100, total: items.length } });
  };

  return { urls, fetch };
};

const renderOptions = (options: Parameters<typeof stub>[0] = {}) => {
  const stubbed = stub(options);
  const rendered = renderHookWithProviders(() => useWorkOrderStatusOptions(), {
    fetch: stubbed.fetch,
  });

  return { ...rendered, urls: stubbed.urls };
};

describe('useWorkOrderStatusOptions', () => {
  it('마스터가 정한 순서를 그대로 따른다 — 화면이 다시 줄 세우면 마스터와 어긋난다', async () => {
    const { result } = renderOptions();

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });
    expect(result.current.options).toEqual([
      { value: 'SYN_RUN', label: '진행중' },
      { value: 'SYN_WAIT', label: '대기' },
    ]);
  });

  it('코드를 표시명으로 바꾼다', async () => {
    const { result } = renderOptions();

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });
    expect(result.current.labelOf('SYN_RUN')).toBe('진행중');
  });

  /*
   * 상태 코드는 품목 식별자와 달리 그 자체가 사람이 읽을 수 있는 말이다 — 표시명을 모른다고
   * 값을 감추면 오히려 정보가 준다.
   */
  it('표시명을 모르는 코드는 받은 값을 그대로 둔다', async () => {
    const { result } = renderOptions();

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });
    expect(result.current.labelOf('SYN_UNSEEN')).toBe('SYN_UNSEEN');
  });

  it('고른 상태가 없으면 빈 글자다 — 「전체」는 필터가 적는다', async () => {
    const { result } = renderOptions();

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });
    expect(result.current.labelOf(undefined)).toBe('');
  });

  describe('그룹을 가리키는 법', () => {
    it('그룹코드로 부른다 — 채번 번호는 환경마다 다르다', async () => {
      const { urls } = renderOptions();

      await waitFor(() => {
        expect(urls).toHaveLength(1);
      });
      expect(urls[0]).toContain(`codeGroupCode=${WORK_ORDER_STATUS_GROUP_CODE}`);
      expect(urls[0]).not.toContain('codeGroupId');
    });

    it('쓰지 않게 된 상태도 받는다 — 그 상태로 만들어 둔 W/O 가 남아 있다', async () => {
      const { urls } = renderOptions();

      await waitFor(() => {
        expect(urls).toHaveLength(1);
      });
      expect(urls[0]).toContain('includeInactive=true');
    });

    it(`한 번에 ${String(STATUS_OPTION_SIZE)}건을 받는다`, async () => {
      const { urls } = renderOptions();

      await waitFor(() => {
        expect(urls).toHaveLength(1);
      });
      expect(urls[0]).toContain(`size=${String(STATUS_OPTION_SIZE)}`);
    });
  });

  /*
   * ⛔ 선택지를 세울 수 없으면 필터를 **지우지 않고 끄고 이유를 적는다**(G-1·G-2). 조용히
   * 사라지면 「원래 없는 기능」으로 읽히고, 값이 채워지는 날에도 아무도 눈치채지 못한다.
   * 실패와 빈 목록을 하나로 묶는 이유는 사용자가 할 수 있는 일이 같기 때문이다.
   */
  describe('선택지를 세울 수 없을 때', () => {
    it.each([
      ['조회가 실패하면', { fail: true }],
      ['값이 하나도 없으면', { items: [] }],
    ])('⛔ %s 그 사실을 알린다', async (_name, options) => {
      const { result } = renderOptions(options);

      await waitFor(() => {
        expect(result.current.isPending).toBe(false);
      });
      expect(result.current.isUnavailable).toBe(true);
      expect(result.current.options).toEqual([]);
    });

    it('받기 전에는 「못 세운다」고 하지 않는다 — 모르는 것을 안다고 하지 않는다', () => {
      const { result } = renderOptions();

      expect(result.current.isPending).toBe(true);
      expect(result.current.isUnavailable).toBe(false);
    });

    it('값이 있으면 「못 세운다」고 하지 않는다', async () => {
      const { result } = renderOptions();

      await waitFor(() => {
        expect(result.current.isPending).toBe(false);
      });
      expect(result.current.isUnavailable).toBe(false);
    });
  });
});
