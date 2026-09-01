/**
 * 진행현황 화면의 테스트 전용 발판. 런타임 코드는 이 모듈을 참조하지 않는다 —
 * 참조하면 예시 값이 배포 번들에 들어간다.
 *
 * 화면 감지기가 둘로 나뉘어(조회·목록 / 주소 수명) 발판을 함께 쓴다. 스텁이 갈리면 두
 * 파일이 **다른 서버를 상대로** 같은 화면을 검사하게 되므로 한자리에 둔다.
 *
 * 여기 있는 값은 전부 지어낸 합성값이다(`SYN-` 접두).
 */
import { waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router';
import { expect } from 'vitest';

import { jsonResponse, renderWithProviders, type StubFetch } from '../../test/api-harness';
import { WORK_ORDER_PROGRESS_PATH } from './filters';
import { WorkOrderProgressScreen } from './screen';

/** 감지기가 실행하는 날에 따라 결과가 달라지지 않게 「지금」을 고정한다. */
export const NOW = new Date('2026-07-15T09:00:00+09:00');

export const WORK_ORDER = {
  workOrderId: 7001,
  workOrderNo: 'SYN-WO-0007',
  itemId: 5001,
  orderQty: 3000,
  uomId: 11,
  workOrderTypeCode: 'SYN_NORMAL',
  statusCode: 'SYN_RUN',
  priorityNo: 1,
  /* 지난 계획 종료 — 기준 시각이 제대로 흐르면 「지연」으로 판정된다. */
  plannedEndAt: '2026-07-01T18:00:00+09:00',
};

export interface StubOptions {
  workOrders?: Record<string, unknown>[];
  total?: number;
  listStatus?: number;
}

const stub = (options: StubOptions = {}): { urls: string[]; fetch: StubFetch } => {
  const urls: string[] = [];
  const fetch: StubFetch = async (request) => {
    const url = new URL(request.url);
    urls.push(`${url.pathname}${url.search}`);

    if (url.pathname === '/production/work-orders') {
      if (options.listStatus !== undefined) {
        return jsonResponse({ message: '실패' }, { status: options.listStatus });
      }

      const items = options.workOrders ?? [WORK_ORDER];
      /* 요청한 쪽을 그대로 되돌려 준다 — 서버가 하는 일이고, 쪽 경계 판정이 여기에 걸린다. */
      const page = Number(url.searchParams.get('page') ?? '1');
      return jsonResponse({
        items,
        page: { page, size: 50, total: options.total ?? items.length },
      });
    }

    /* 이름표들. 목록이 식별자만 주므로 화면이 이것들로 사람이 읽는 말을 만든다. */
    const named: Record<string, unknown> = {
      '/mdm/items': {
        itemId: 5001,
        itemCode: 'SYN-ITEM-0001',
        itemName: '합성 품목',
        isActive: true,
      },
      '/mdm/code-values': {
        codeValueId: 9001,
        codeGroupId: 42,
        code: 'SYN_RUN',
        codeName: '진행중',
        displayOrder: 1,
        isActive: true,
      },
    };
    const items = named[url.pathname] === undefined ? [] : [named[url.pathname]];

    return jsonResponse({ items, page: { page: 1, size: 200, total: items.length } });
  };

  return { urls, fetch };
};

/** 주소가 화면의 상태다 — 무엇이 주소에 적혔는지를 감지기가 볼 수 있어야 한다. */
const LocationProbe = () => <output data-testid="location">{useLocation().search}</output>;

export const renderScreen = (options: StubOptions & { route?: string } = {}) => {
  const { route, ...stubOptions } = options;
  const stubbed = stub(stubOptions);
  const rendered = renderWithProviders(
    <>
      <WorkOrderProgressScreen now={NOW} />
      <LocationProbe />
    </>,
    { fetch: stubbed.fetch, route: route ?? WORK_ORDER_PROGRESS_PATH },
  );

  return { ...rendered, urls: stubbed.urls, user: userEvent.setup() };
};

export const listUrl = async (urls: string[]): Promise<string> => {
  await waitFor(() => {
    expect(urls.some((url) => url.startsWith('/production/work-orders?'))).toBe(true);
  });

  return urls.filter((url) => url.startsWith('/production/work-orders?')).at(-1) ?? '';
};
