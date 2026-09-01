/**
 * 이 화면의 감지기 전용 발판. 런타임 코드는 이 모듈을 참조하지 않는다 — 참조하면 예시 값이
 * 배포 번들에 들어간다.
 *
 * 감지기가 여럿으로 나뉘어도 **한 스텁을 함께 쓴다.** 스텁이 갈리면 두 파일이 다른 서버를
 * 상대로 같은 화면을 검사하게 된다.
 *
 * 여기 있는 값은 전부 지어낸 합성값이다(`SYN-` 접두).
 */
import userEvent from '@testing-library/user-event';

import { jsonResponse, renderWithProviders, type StubFetch } from '../../test/api-harness';
import { EmergencyWorkOrderFieldScreen } from './screen';

/** 배정이 하나도 없는 긴급 W/O — 이것이 긴급의 정상 모습이다. */
export const EMERGENCY_WORK_ORDER = {
  workOrderId: 8001,
  workOrderNo: 'SYN-WO-E-0002',
  productionPlanId: 4001,
  routingOperationId: 3001,
  itemId: 5001,
  itemCode: 'SYN-ITEM-0999',
  orderQty: 50,
  uomId: 11,
  workOrderTypeCode: 'EMERGENCY',
  statusCode: 'SYN_RELEASED',
  priorityNo: 1,
  releasedAt: '2026-08-31T14:20:00+09:00',
};

export const UOM = { uomId: 11, uomCode: 'EA', uomName: '개', isActive: true };

export interface StubOptions {
  workOrders?: Record<string, unknown>[];
  total?: number;
  listStatus?: number;
  /** 단위 이름을 못 받는 상황. 숫자 식별자가 새어 나오는지 잰다. */
  uoms?: Record<string, unknown>[];
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

      const items = options.workOrders ?? [EMERGENCY_WORK_ORDER];
      return jsonResponse({
        items,
        page: { page: 1, size: 20, total: options.total ?? items.length },
      });
    }

    if (url.pathname === '/mdm/uoms') {
      const items = options.uoms ?? [UOM];
      return jsonResponse({ items, page: { page: 1, size: 200, total: items.length } });
    }

    throw new Error(`스텁에 없는 요청입니다: ${url.pathname}`);
  };

  return { urls, fetch };
};

export const renderScreen = (options: StubOptions & { typeCode?: string } = {}) => {
  const { typeCode, ...stubOptions } = options;
  const stubbed = stub(stubOptions);
  const rendered = renderWithProviders(<EmergencyWorkOrderFieldScreen typeCode={typeCode} />, {
    fetch: stubbed.fetch,
    route: '/pop/emergency-work-orders',
  });

  return { ...rendered, urls: stubbed.urls, user: userEvent.setup() };
};

export const listUrls = (urls: string[]): string[] =>
  urls.filter((url) => url.startsWith('/production/work-orders'));
