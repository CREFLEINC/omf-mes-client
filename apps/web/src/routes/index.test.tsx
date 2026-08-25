import { messages } from '@omf-mes/i18n';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  RouterProvider,
  createMemoryRouter,
  useLocation,
  useNavigate,
  useRoutes,
} from 'react-router';
import { describe, expect, it } from 'vitest';

import { AppLayout } from '../app/layout';
import { SessionProvider } from '../patterns/session';
import {
  groupsResponse as equipmentGroupsResponse,
  plantsResponse as equipmentPlantsResponse,
  processesResponse as equipmentProcessesResponse,
} from '../screens/equipment-master/fixtures';
import {
  gaugesResponse,
  plantsResponse as gaugePlantsResponse,
} from '../screens/gauge-master/fixtures';
import {
  plantsResponse as toolPlantsResponse,
  toolsResponse,
} from '../screens/tool-master/fixtures';
import {
  applicationsResponse,
  calendarsResponse,
  plantsResponse as calendarPlantsResponse,
} from '../screens/work-calendar/fixtures';
import { queueResponse as iqcQueueResponse } from '../screens/iqc-inspection/fixtures';
import { sessionBody } from '../screens/login/fixtures';
import {
  notificationEventListBody,
  notificationFixtures,
  notificationListBody,
} from '../screens/notification-center/fixtures';
import { poRegisterEntryPath } from '../screens/over-receipt-split/created-receipts-pane';
import {
  businessUnitFixtures,
  inboundReceiptDetailBody,
  itemFixtures,
  partnerFixtures,
  plantFixtures,
  uomFixtures,
} from '../screens/po-register/fixtures';
import {
  ITEM_LABEL as putawayItemLabel,
  LOCATION_LABEL as putawayLocationLabel,
  balanceFixtures as putawayBalanceFixtures,
  itemFixtures as putawayItemFixtures,
  locationFixtures as putawayLocationFixtures,
  ruleFixtures as putawayRuleFixtures,
  uncoveredItemFixtures as putawayUncoveredFixtures,
  uomFixtures as putawayUomFixtures,
  warehouseFixtures as putawayWarehouseFixtures,
} from '../screens/putaway-rule/fixtures';
import {
  countFixtures as adjustCountFixtures,
  itemFixtures as adjustItemFixtures,
  locationFixtures as adjustLocationFixtures,
  lotFixtures as adjustLotFixtures,
  uomFixtures as adjustUomFixtures,
  warehouseFixtures as adjustWarehouseFixtures,
} from '../screens/stock-adjust/fixtures';
import { stockAdjustEntryPath } from '../screens/stocktaking/result-pane';
import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubRoute,
} from '../test/api-harness';
import { appRouter } from './index';

/**
 * 사이드바가 가리키는 주소와 라우트 표를 **맞춰 본다.**
 *
 * 둘은 서로 다른 파일에 있고 서로를 참조하지 않는다. 한쪽만 고치면 링크가 죽은 채로
 * 남는데, 사이드바 테스트는 `href`만 보고 화면 테스트는 라우터를 거치지 않아
 * **어느 쪽도 그 어긋남을 잡지 못한다.** 이 파일이 그 사이를 잇는다.
 */

const t = messages.poRegister;
const putaway = messages.putawayRule;

/** 라우터가 실제로 받는 경로. 자식 라우트의 `path`는 앞머리 `/`가 없다. */
const routedPaths = (): string[] =>
  (appRouter.routes[0]?.children ?? [])
    .map((route) => route.path)
    .filter((path): path is string => path !== undefined)
    .map((path) => `/${path}`);

/**
 * ⭐ **셸 자식이 아닌 라우트의 경로.**
 *
 * `routedPaths()`는 `routes[0].children`만 훑으므로 **셸 밖에 선 라우트를 보지 못한다** —
 * 그 자리에 무엇을 넣거나 빼도 위 함수를 쓰는 시험은 전부 조용하다. 셸 밖 화면이 생긴
 * 이 회차부터 그 자리를 직접 훑는 잣대를 따로 둔다.
 */
const topLevelPaths = (): string[] =>
  appRouter.routes.map((route) => route.path).filter((path): path is string => path !== undefined);

const sidebarHrefs = (): string[] => {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: (
          <SessionProvider>
            <AppLayout>본문</AppLayout>
          </SessionProvider>
        ),
      },
    ],
    { initialEntries: ['/'] },
  );

  render(<RouterProvider router={router} />);

  return within(screen.getByRole('navigation', { name: '주 메뉴' }))
    .getAllByRole('link')
    .map((link) => link.getAttribute('href') ?? '');
};

/**
 * **실제 라우트 표를 그대로 태운다.** 손으로 만든 두 줄짜리 표로 이동을 재면 그 표가 앱의
 * 표와 어긋나도 통과한다 — 이 파일이 존재하는 이유가 바로 그 어긋남이다.
 */
const AppRoutes = () => useRoutes(appRouter.routes);

/**
 * 라우트 표를 **앱과 같은 프로바이더 구성**으로 태운다. 셸이 세션을 읽으므로 프로바이더 없이는
 * 서지 않고(`useSession`이 던진다), **로그인 화면과 셸이 한 세션을 나눠 봐야** 셸 안팎 전환을
 * 잴 수 있다 — `app/providers.tsx`가 앱에서 같은 자리에 이 프로바이더를 둔다.
 */
const RoutedApp = () => (
  <SessionProvider>
    <AppRoutes />
  </SessionProvider>
);

/**
 * 주소를 읽어 내는 탐침. **이동이 일어났는지는 주소로만 판정할 수 있다** — 화면이 같아 보여도
 * 질의가 달라지는 이동이 있고(메뉴로 다시 들어오기), 그 갈래는 그린 것만 봐서는 가릴 수 없다.
 */
const LocationProbe = () => {
  const location = useLocation();

  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
};

const currentLocation = (): string => screen.getByTestId('location').textContent ?? '';

/**
 * 한 칸 뒤로 간다. **히스토리가 몇 칸 늘었는지를 판정하는 유일한 수단**이다 —
 * 기억 라우터는 브라우저 히스토리를 쓰지 않아 `window.history.back()`이 닿지 않는다.
 */
const BackProbe = () => {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => {
        void navigate(-1);
      }}
    >
      뒤로
    </button>
  );
};

/**
 * 라우트 표·셸·탐침을 한 벌로 태운다. **사이드바를 실제로 눌러** 이동을 재는 시험이 쓴다 —
 * 링크의 `href` 글자만 보면 그 주소가 라우트 표에 없어도 통과한다.
 */
const renderRoutedApp = (route: string, routes: StubRoute[]): void => {
  renderWithProviders(
    <>
      <RoutedApp />
      <LocationProbe />
      <BackProbe />
    </>,
    { fetch: createStubFetch(routes), route },
  );
};

const isGet = (request: Request, pathname: string): boolean =>
  request.method === 'GET' && new URL(request.url).pathname === pathname;

const listBody = (items: unknown[]) => ({
  items,
  page: { page: 1, size: 50, total: items.length },
});

const lookupRoute = (pathname: string, items: unknown[]): StubRoute => ({
  match: (request) => isGet(request, pathname),
  respond: () => jsonResponse(listBody(items)),
});

/** W-01-12가 첫 진입에 부르는 것들 — 실사 목록과 이름 풀이 다섯. */
const stockAdjustRoutes = (): StubRoute[] => [
  lookupRoute('/inventory/counts', adjustCountFixtures),
  lookupRoute('/mdm/warehouses', adjustWarehouseFixtures),
  lookupRoute('/mdm/locations', adjustLocationFixtures),
  lookupRoute('/mdm/items', adjustItemFixtures),
  lookupRoute('/mdm/uoms', adjustUomFixtures),
  lookupRoute('/trace/lots', adjustLotFixtures),
];

/** W-06-14가 창고를 고른 주소에서 부르는 것들 — 목록·규칙 없는 품목·잔액과 이름 풀이 넷. */
const putawayRuleRoutes = (): StubRoute[] => [
  lookupRoute('/logistics/putaway-rules/uncovered-items', putawayUncoveredFixtures),
  lookupRoute('/logistics/putaway-rules', putawayRuleFixtures),
  lookupRoute('/inventory/balances', putawayBalanceFixtures),
  lookupRoute('/mdm/warehouses', putawayWarehouseFixtures),
  lookupRoute('/mdm/locations', putawayLocationFixtures),
  lookupRoute('/mdm/items', putawayItemFixtures),
  lookupRoute('/mdm/uoms', putawayUomFixtures),
];

/** W-CO-03이 첫 진입에 부르는 것들 — 목록·유형 목록·안 읽은 수. */
const notificationCenterRoutes = (): StubRoute[] => [
  {
    match: (request) => isGet(request, '/app/notifications'),
    respond: () => jsonResponse(notificationListBody(notificationFixtures)),
  },
  {
    match: (request) => isGet(request, '/app/notification-events'),
    respond: () => jsonResponse(notificationEventListBody()),
  },
  {
    match: (request) => isGet(request, '/app/notifications/unread-count'),
    respond: () => jsonResponse({ unreadCount: 2 }),
  },
];

/** W-01-01이 첫 진입에 부르는 것 — 검사 대기 큐 하나다. 고른 의뢰가 없으면 그것뿐이다. */
const iqcInspectionRoutes = (): StubRoute[] => [
  {
    match: (request) => isGet(request, '/quality/inspection-requests'),
    respond: () => jsonResponse(iqcQueueResponse()),
  },
];

const equipmentMasterRoutes = (): StubRoute[] => [
  {
    match: (request) => isGet(request, '/mdm/equipment-groups'),
    respond: () => jsonResponse(equipmentGroupsResponse()),
  },
  {
    match: (request) => isGet(request, '/mdm/plants'),
    respond: () => jsonResponse(equipmentPlantsResponse()),
  },
  {
    match: (request) => isGet(request, '/mdm/processes'),
    respond: () => jsonResponse(equipmentProcessesResponse()),
  },
];

/** W-05-11이 첫 진입에 부르는 것들 — 목록·공장·단위·코드값. */
const gaugeMasterRoutes = (): StubRoute[] => [
  {
    match: (request) => isGet(request, '/mdm/equipments'),
    respond: () => jsonResponse(gaugesResponse()),
  },
  {
    match: (request) => isGet(request, '/mdm/plants'),
    respond: () => jsonResponse(gaugePlantsResponse()),
  },
  lookupRoute('/mdm/uoms', []),
  lookupRoute('/mdm/code-values', []),
];

/** W-05-13이 첫 진입에 부르는 것들 — 목록·공장·코드값. */
const toolMasterRoutes = (): StubRoute[] => [
  {
    match: (request) => isGet(request, '/mdm/molds'),
    respond: () => jsonResponse(toolsResponse()),
  },
  {
    match: (request) => isGet(request, '/mdm/plants'),
    respond: () => jsonResponse(toolPlantsResponse()),
  },
  lookupRoute('/mdm/code-values', []),
];

/** W-05-09가 첫 진입에 부르는 것들 — 캘린더 목록·공장 적용·공장 목록. */
const workCalendarRoutes = (): StubRoute[] => [
  {
    match: (request) => isGet(request, '/mdm/work-calendars'),
    respond: () => jsonResponse(calendarsResponse()),
  },
  {
    match: (request) => isGet(request, '/mdm/work-calendar-applications'),
    respond: () => jsonResponse(applicationsResponse()),
  },
  {
    match: (request) => isGet(request, '/mdm/plants'),
    respond: () => jsonResponse(calendarPlantsResponse()),
  },
];

/** W-05-07이 첫 진입에 부르는 것들 — 설비 목록과 공장(채널은 설비를 고른 뒤에 온다). */
const collectionChannelRoutes = (): StubRoute[] => [
  {
    match: (request) => isGet(request, '/mdm/equipments'),
    respond: () =>
      jsonResponse({
        items: [
          {
            equipmentId: 3001,
            plantId: 11,
            equipmentCode: 'EQ-101',
            equipmentName: '가상 성형기 1호',
            equipmentTypeCode: 'PRESS',
            statusCode: 'IN_SERVICE',
            calibrationRequired: false,
            isActive: true,
          },
        ],
        page: { page: 1, size: 100, total: 1 },
      }),
  },
  {
    match: (request) => isGet(request, '/mdm/plants'),
    respond: () => jsonResponse(calendarPlantsResponse()),
  },
  /*
   * ⭐ **고른 뒤에 도는 것까지 스텁을 둔다.** `createStubFetch` 는 스텁에 없는 요청을 던지지만
   * 그 던짐이 `queryFn` 안에서 삼켜져 **조용히 오류로 끝난다** — 화면이 그 오류를 그리지 않으면
   * 아무 흔적도 남지 않고, 시험은 통과하면서 실제로는 실패 경로를 돌게 된다.
   */
  {
    match: (request) => isGet(request, '/maintenance/collection-channels'),
    respond: () => jsonResponse({ items: [] }),
  },
  {
    match: (request) => isGet(request, '/maintenance/collection-channels/observations'),
    respond: () => jsonResponse({ items: [] }),
  },
  lookupRoute('/mdm/uoms', []),
];

/**
 * W-05-01이 첫 진입에 부르는 것들.
 *
 * ⚠ **정책 조회가 «둘»이다** — 비율과 사용 여부가 같은 경로를 `policyCode` 로만 가른다.
 * 하나만 스텁하면 나머지가 조용히 실패한다.
 */
const shotConversionRoutes = (): StubRoute[] => [
  {
    match: (request) => isGet(request, '/app/operation-policies'),
    respond: (request) =>
      jsonResponse(
        new URL(request.url).searchParams.get('policyCode') === 'SHOT_CONVERSION_RATIO'
          ? {
              items: [
                {
                  operationPolicyId: 9001,
                  policyCode: 'SHOT_CONVERSION_RATIO',
                  valueNumeric: 0.25,
                  itemId: 21,
                  effectiveFrom: '2026-01-01',
                },
              ],
              page: { page: 1, size: 200, total: 1 },
            }
          : { items: [], page: { page: 1, size: 200, total: 0 } },
      ),
  },
  {
    match: (request) => isGet(request, '/app/operation-policies/effective'),
    respond: () => jsonResponse({ policyCode: 'SHOT_CONVERSION_RATIO', resolved: false }),
  },
  lookupRoute('/mdm/items', [
    { itemId: 21, itemCode: 'ITM-201', itemName: '가상 하우징', isActive: true },
  ]),
  lookupRoute('/mdm/processes', []),
  lookupRoute('/mdm/plants', []),
  lookupRoute('/mdm/business-units', []),
  lookupRoute('/mdm/molds', []),
];

const lotStatusRoutes = (): StubRoute[] => [
  lookupRoute('/mdm/code-values', []),
  lookupRoute('/mdm/warehouses', []),
  lookupRoute('/mdm/items', []),
];

const workOrderCloseRoutes = (): StubRoute[] => [
  {
    match: (request) => isGet(request, '/mdm/code-values'),
    respond: (request) => {
      const isStatus =
        new URL(request.url).searchParams.get('codeGroupCode') === 'WORK_ORDER_STATUS';
      const items = isStatus
        ? [{ code: 'COMPLETED', codeName: '마감 완료', displayOrder: 1, isActive: true }]
        : [];
      return jsonResponse({ items, page: { page: 1, size: 200, total: items.length } });
    },
  },
  lookupRoute('/planning/production-orders', []),
  {
    match: (request) => isGet(request, '/production/work-orders'),
    respond: () =>
      jsonResponse({
        items: [
          {
            workOrderId: 9701,
            workOrderNo: 'SYN-WO-9701',
            productionPlanId: 9501,
            routingOperationId: 9601,
            itemId: 9801,
            orderQty: 12,
            uomId: 9901,
            workOrderTypeCode: 'NORMAL',
            priorityNo: 1,
            statusCode: 'COMPLETED',
          },
        ],
        page: { page: 1, size: 20, total: 1 },
      }),
  },
  {
    match: (request) => isGet(request, '/mdm/items/9801'),
    respond: () =>
      jsonResponse({
        item: {
          itemId: 9801,
          itemCode: 'SYN-ITEM-9801',
          itemName: '합성 마감 품목',
          itemTypeCode: 'MATERIAL',
          baseUomId: 9901,
          lotControlTypeCode: 'NONE',
          serialControlTypeCode: 'NONE',
          inspectionRequired: false,
          fifoPolicyCode: 'FIFO',
          negativeStockAllowed: false,
          isActive: true,
        },
        editability: { codeEditable: false, reason: 'RECEIVED_FROM_ERP', referenceCount: null },
      }),
  },
  lookupRoute('/mdm/uoms', [
    { uomId: 9901, uomCode: 'SYN-EA', uomName: '합성 개', decimalScale: 0, isActive: true },
  ]),
  {
    match: (request) => isGet(request, '/integration/outbound-item-settings'),
    respond: () => jsonResponse({ items: [] }),
  },
];

/** W-01-11이 첫 진입에 부르는 것들 — 대상 초과분 상세와 이름 풀이 다섯. */
const poRegisterRoutes = (): StubRoute[] => [
  {
    match: (request) => isGet(request, '/logistics/inbound-receipts/9101'),
    respond: () => jsonResponse(inboundReceiptDetailBody()),
  },
  lookupRoute('/mdm/partners', partnerFixtures),
  lookupRoute('/mdm/business-units', businessUnitFixtures),
  lookupRoute('/mdm/plants', plantFixtures),
  lookupRoute('/mdm/items', itemFixtures),
  lookupRoute('/mdm/uoms', uomFixtures),
];

describe('appRouter', () => {
  it('사이드바가 가리키는 주소가 전부 라우트 표에 있다', () => {
    const routes = routedPaths();

    for (const href of sidebarHrefs()) {
      expect(routes).toContain(href);
    }
  });

  it('입하 예정 조회가 자재창고 앞머리로 등록돼 있다', () => {
    expect(routedPaths()).toContain('/logistics/inbound-schedule');
  });

  /*
   * **앞머리는 사이드바 섹션(도메인)을 따르고 계약 경로를 따르지 않는다.**
   * 이 화면의 계약 경로는 `/inventory/**`·`/trace/**`인데 주소는 `/logistics/`다 —
   * 계약 경로를 따랐다면 같은 섹션 안에서 앞머리가 갈렸을 것이다.
   */
  it('재고 현황·상태 조회도 같은 자재창고 앞머리를 쓴다', () => {
    expect(routedPaths()).toContain('/logistics/stock-status');
    expect(routedPaths()).not.toContain('/inventory/stock-status');
  });

  /*
   * W-01-03은 계약 경로도 `/logistics/**`라 둘이 우연히 같다. 그래도 근거는 섹션이다 —
   * 계약 경로를 근거로 삼으면 W-01-07에서 앞머리가 갈렸을 것이다.
   */
  it('초과 입하 분리가 자재창고 앞머리로 등록돼 있다', () => {
    expect(routedPaths()).toContain('/logistics/over-receipt-split');
  });

  /*
   * W-01-10의 계약 경로는 `/logistics/goods-receipts`(복수)인데 화면 주소는 단수다 —
   * 주소는 **계약 리소스가 아니라 화면**을 가리키므로 다른 화면들과 같은 형태를 쓴다.
   */
  it('정상품 입하 처리가 자재창고 앞머리로 등록돼 있다', () => {
    expect(routedPaths()).toContain('/logistics/goods-receipt');
  });

  /*
   * W-01-04도 계약 경로(`/inventory/**`)가 아니라 **섹션**을 따른다. 화면 슬라이스 폴더
   * 이름(`stocktaking`)과 주소의 마지막 조각을 같게 두어 둘을 맞춰 보기 쉽게 한다.
   */
  it('재고실사가 자재창고 앞머리로 등록돼 있다', () => {
    expect(routedPaths()).toContain('/logistics/stocktaking');
    expect(routedPaths()).not.toContain('/inventory/stocktaking');
  });

  /*
   * W-01-05의 계약 경로는 `/logistics/goods-issues`(출고)인데 화면 주소는 **공급사 반품**이다 —
   * 주소는 계약 리소스가 아니라 **화면**을 가리킨다. 같은 경로를 일반 출고·기타 출고가 함께
   * 쓰므로(착수 이슈 §6) 리소스 이름을 주소로 삼으면 세 화면이 한 주소를 다투게 된다.
   */
  it('공급사 반품 처리가 자재창고 앞머리로 등록돼 있다', () => {
    expect(routedPaths()).toContain('/logistics/supplier-return');
    expect(routedPaths()).not.toContain('/logistics/goods-issues');
  });

  /*
   * W-01-06은 반품과 **같은 계약 경로**(`/logistics/goods-issues`)를 쓰는데 주소가 다르다 —
   * 일반 출고·반품·기타 출고가 그 경로를 함께 쓰므로(착수 이슈 §6) 리소스 이름을 주소로
   * 삼으면 세 화면이 한 주소를 다툰다. 주소는 계약 리소스가 아니라 **화면**을 가리킨다.
   */
  it('폐기 품의·기타출고가 자재창고 앞머리로 등록돼 있다', () => {
    expect(routedPaths()).toContain('/logistics/disposal-issue');
    expect(routedPaths()).not.toContain('/logistics/goods-issues');
    expect(routedPaths()).not.toContain('/approval/disposal-issue');
  });

  /*
   * W-06-15의 계약 경로는 `/app/**`이고 주소 앞머리는 `/system/`이다 — 근거는 여기서도
   * **섹션**이다. 결재선은 마스터이지만 창고·품목 같은 업무 기준정보가 아니라 운영 설정이라
   * 사용자·역할·권한과 같은 섹션에 선다.
   */
  it('결재선 정의가 시스템 관리 앞머리로 등록돼 있다', () => {
    expect(routedPaths()).toContain('/system/approval-route');
    expect(routedPaths()).not.toContain('/master-data/approval-route');
  });

  /*
   * W-CO-10의 계약 경로는 `/app/users/me:change-password`이고 주소 앞머리는 `/system/`이다 —
   * 근거는 여기서도 **섹션**이다. 자기 비밀번호를 바꾸는 일은 업무 기준정보가 아니라 계정 설정이라
   * 사용자·역할·권한과 같은 섹션에 선다. ⛔ 「내 계정」류의 새 앞머리를 만들지 않는다 — 그 섹션에
   * 들어갈 화면이 지금 이것 하나뿐이라 섹션 하나에 항목 하나가 된다.
   */
  it('비밀번호 변경이 시스템 관리 앞머리로 등록돼 있다', () => {
    expect(routedPaths()).toContain('/system/password-change');
    expect(routedPaths()).not.toContain('/account/password');
    expect(routedPaths()).not.toContain('/app/users/me:change-password');
  });

  /*
   * W-CO-09의 계약 경로는 `/app/approval-requests`인데 주소는 `/approval/inbox`다 —
   * 근거는 여기서도 **섹션**이다. 결재함은 결재선 정의(운영 설정)와 달리 **일하는 자리**라
   * 「시스템 관리」에 들어가지 않고 자기 섹션을 갖는다.
   */
  it('결재함이 승인 앞머리로 등록돼 있다', () => {
    expect(routedPaths()).toContain('/approval/inbox');
    expect(routedPaths()).not.toContain('/system/approval-inbox');
    expect(routedPaths()).not.toContain('/app/approval-requests');
  });

  /*
   * W-01-02는 결재함과 **같은 계약 경로**를 쓰는데 주소가 다르다 — 근거가 계약이 아니라
   * **섹션**임을 두 화면이 나란히 보여 주는 자리다. 이 화면이 판정하는 것은 자재 입하
   * 검사의 생략이라 그 판단의 맥락이 「자재창고」에 있고, 결재함은 올라온 결재를 두루
   * 처리하는 자리라 축이 다르다.
   */
  it('긴급 IQC 생략 한도승인이 자재창고 앞머리로 등록돼 있다', () => {
    expect(routedPaths()).toContain('/logistics/iqc-skip-approval');
    expect(routedPaths()).not.toContain('/approval/iqc-skip');
    expect(routedPaths()).not.toContain('/approval/iqc-skip-approval');
  });

  /*
   * **W-01-11 · C32** — 주소 앞머리는 다른 자재창고 화면과 같은 규칙(사이드바 섹션)을 따른다.
   * 메뉴에 서지 않아도 이 화면이 속한 업무 묶음은 자재창고이고, 주소가 그 사실을 말해야 한다.
   */
  it('신규 P/O 등록이 자재창고 앞머리로 등록돼 있다', () => {
    expect(routedPaths()).toContain('/logistics/po-register');
    expect(routedPaths()).not.toContain('/logistics/purchase-orders');
  });

  /*
   * **W-01-12 · C46** — 계약 경로는 `/inventory/adjustments`인데 주소 앞머리는 `/logistics/`다.
   * 근거는 여기서도 **섹션**이다(D-1) — 재고실사·재고 현황과 한 섹션에 서는 화면이 저 혼자
   * 계약 앞머리를 쓰면 사용자와 개발자 모두 섹션과 주소를 대응시킬 수 없다.
   *
   * **`stock-status`와 한 글자도 겹치지 않는다** — 「재고」로 시작하는 화면이 둘이라 주소가
   * 비슷하면 손으로 고칠 때 서로의 화면이 열린다.
   */
  it('재고조정이 자재창고 앞머리로 등록돼 있다', () => {
    expect(routedPaths()).toContain('/logistics/stock-adjust');
    expect(routedPaths()).not.toContain('/inventory/adjustments');
    expect(routedPaths()).not.toContain('/logistics/stock-status/adjust');
  });

  /*
   * **W-06-14 · C5-1** — 계약 경로는 `/logistics/putaway-rules`인데 주소 앞머리는
   * `/master-data/`다. 근거는 여기서도 **섹션**이다: 적치 규칙은 물건이 오가는 일이 아니라
   * 「어디에 둘지 미리 정해 두는 것」이라 창고·품목과 같은 기준정보 마스터다. 그 섹션 안에서
   * 저 혼자 계약 앞머리를 쓰면 사용자도 개발자도 섹션과 주소를 대응시킬 수 없다.
   *
   * **주소는 단수, 계약 리소스는 복수다** — 주소가 가리키는 것은 리소스가 아니라 **화면**이다.
   */
  /**
   * W-CO-03 — 계약 경로는 `/app/notifications`인데 앞머리는 **사이드바 섹션**을 따른다.
   * 알림은 자기 섹션을 가지므로 앞머리도 그 이름이다.
   */
  it('알림센터가 알림 앞머리로 등록돼 있다', () => {
    expect(routedPaths()).toContain('/notification/center');
    expect(routedPaths()).not.toContain('/app/notifications');
    expect(routedPaths()).not.toContain('/system/notification-center');
  });

  it('적치 규칙이 기준정보 앞머리로 등록돼 있다', () => {
    expect(routedPaths()).toContain('/master-data/putaway-rule');
    expect(routedPaths()).not.toContain('/logistics/putaway-rules');
    expect(routedPaths()).not.toContain('/logistics/putaway-rule');
  });

  /*
   * **W-01-13 · C5-1** — 계약 경로도 `/logistics/document-progress`라 주소와 **우연히 같다.**
   * 그래도 근거는 여기서도 **섹션**이다 — 계약을 근거로 삼았다면 W-01-07·W-01-12에서 앞머리가
   * 갈렸을 것이다(그쪽 계약은 `/inventory/**`인데 주소는 `/logistics/`다).
   *
   * ⛔ **취소 리소스의 이름을 주소로 삼지 않는다.** 이 화면이 취소를 보내는 계약 경로는 셋이고
   * (`goods-receipts`·`inbound-receipts`·`goods-issues`) 그 경로들은 이미 다른 화면들이 쓴다 —
   * 리소스를 주소로 삼으면 한 주소를 여러 화면이 다툰다. 주소는 **화면**을 가리킨다.
   *
   * ⛔ **「승인」 앞머리가 아니다.** 취소가 승인을 타지만 이 화면이 하는 일은 결재가 아니라
   * 상신과 실행이다(W-01-02가 같은 자리에서 같은 판정을 했다).
   */
  it('물류 문서 진행현황·취소가 자재창고 앞머리로 등록돼 있다', () => {
    expect(routedPaths()).toContain('/logistics/document-progress');
    expect(routedPaths()).not.toContain('/approval/document-progress');
    expect(routedPaths()).not.toContain('/logistics/goods-receipts');
    expect(routedPaths()).not.toContain('/logistics/document-progresses');
  });
});

/**
 * **W-06-14는 진입 경로가 사이드바 하나뿐이다** — 다른 화면에서 넘어오는 링크가 없다.
 *
 * **다섯 PR이 함께 여는 자리다.** 목록·사용률·등록/수정·끄기/켜기가 다 서기 전에는 라우트를
 * 두지 않았다(정책 §5.2) — 끄지 못하는 마스터를 노출하면 잘못 만든 규칙을 지울 수도 끌 수도
 * 없다. 그래서 이 describe가 **여는 쪽을 양쪽에서** 잰다: 메뉴에 있고, 그 메뉴가 가리키는
 * 주소가 실제로 이 화면을 연다.
 */
describe('appRouter — 적치 규칙의 진입 경로', () => {
  /** 목록이 실제로 섰음을 잡는 시점. 조건이 실린 주소에서만 선다. */
  const waitForRules = async (): Promise<HTMLElement> =>
    screen.findByRole('button', {
      name: putaway.actions.selectRow(putawayItemLabel, putawayLocationLabel),
    });

  /*
   * **C5-2** — 메뉴에 항목이 있다. 주소와 글자를 **둘 다** 센다: 주소만 보면 이름이 다른
   * 메뉴가 같은 화면을 열어도 통과하고, 글자만 보면 이름만 같고 다른 곳으로 가는 메뉴가 통과한다.
   */
  it('사이드바에 이 화면 항목이 있다', () => {
    expect(sidebarHrefs()).toContain('/master-data/putaway-rule');

    const nav = screen.getByRole('navigation', { name: '주 메뉴' });

    expect(within(nav).getByText('적치 규칙')).toBeInTheDocument();
  });

  /*
   * **C5-1** — 그 주소로 들어가면 화면이 선다. **실제 라우트 표를 태우므로** 라우트 줄이
   * 없거나 다른 화면을 가리키면 여기서 운다.
   */
  it('그 주소로 들어가면 적치 규칙 화면이 첫 상태로 선다', async () => {
    renderRoutedApp('/master-data/putaway-rule', putawayRuleRoutes());

    expect(
      await screen.findByRole('heading', { level: 1, name: putaway.title }),
    ).toBeInTheDocument();
    /* 빈 표가 아니라 안내가 선다 — 화면이 자기 첫 상태로 섰다는 사실이다. */
    expect(screen.getByText(putaway.empty.noWarehouseTitle)).toBeInTheDocument();
  });

  /*
   * ⭐ **사이드바와 라우트 표를 잇는 이음매.** 둘은 서로 다른 파일에 있고 서로를 참조하지
   * 않는다 — 한쪽만 고치면 죽은 링크가 남는데, 사이드바 시험은 `href` 글자만 보고 화면 시험은
   * 라우터를 거치지 않아 **어느 쪽도 그 어긋남을 보지 못한다.** 그래서 **누른다.**
   *
   * 조건이 실린 주소에서 누르는 것은 우연이 아니다 — 이 회차가 처음 열어 준 길이
   * **「같은 라우트에 질의만 다른 이동」**이고, 사이드바가 바로 그 길이다.
   */
  it('사이드바 항목을 누르면 그 주소로 가고 화면이 첫 상태로 돌아온다', async () => {
    const user = userEvent.setup();

    renderRoutedApp('/master-data/putaway-rule?wh=9201', putawayRuleRoutes());

    /* 짝 양성 — 조건이 실린 자리에서 목록이 실제로 섰다. */
    await waitForRules();

    const nav = screen.getByRole('navigation', { name: '주 메뉴' });

    await user.click(within(nav).getByRole('link', { name: '적치 규칙' }));

    await waitFor(() => {
      expect(currentLocation()).toBe('/master-data/putaway-rule');
    });
    expect(await screen.findByText(putaway.empty.noWarehouseTitle)).toBeInTheDocument();
  });

  /*
   * **히스토리가 한 칸이다.** 메뉴 이동이 칸을 둘 이상 늘리면 사용자는 뒤로 눌러도 보던
   * 자리로 돌아오지 못한다 — 이 화면은 조건도 고른 규칙도 전부 주소에 싣는다.
   */
  it('메뉴로 들어간 뒤 뒤로가기 한 번이면 앞 자리로 돌아온다', async () => {
    const user = userEvent.setup();

    renderRoutedApp('/master-data/putaway-rule?wh=9201', putawayRuleRoutes());

    await waitForRules();

    const before = currentLocation();
    const nav = screen.getByRole('navigation', { name: '주 메뉴' });

    await user.click(within(nav).getByRole('link', { name: '적치 규칙' }));
    await waitFor(() => {
      expect(currentLocation()).toBe('/master-data/putaway-rule');
    });

    await user.click(screen.getByRole('button', { name: '뒤로' }));

    await waitFor(() => {
      expect(currentLocation()).toBe(before);
    });
    /* 돌아온 자리가 **그 조건의 화면**이다 — 주소만 되돌고 화면이 비면 돌아온 것이 아니다. */
    await waitForRules();
  });

  /*
   * ⛔ **내부 번호는 주소에만 산다**(`omf-mes#44`). 이 화면은 조건·고른 규칙을 전부 번호로
   * 주소에 싣는데, 그 번호가 글자로 새면 사용자가 읽을 수 없는 값이 화면의 사실이 된다.
   *
   * **주소에 실려 있음을 먼저 확인한 뒤** 글자에서 센다 — 값이 없어서 통과하는 일이 없게.
   */
  it('메뉴와 화면 어디에도 내부 번호가 글자로 나오지 않는다', async () => {
    renderRoutedApp('/master-data/putaway-rule?wh=9201', putawayRuleRoutes());

    await waitForRules();

    /* 짝 양성 — 그 번호는 주소에 실제로 실려 있다. */
    expect(currentLocation()).toContain('wh=9201');

    const nav = screen.getByRole('navigation', { name: '주 메뉴' });
    const main = screen.getByRole('main');

    for (const internalId of ['9201', '9101', '9301', '9401', '9001']) {
      expect(nav.textContent).not.toContain(internalId);
      expect(main.textContent).not.toContain(internalId);
    }
  });
});

/**
 * **W-01-12는 진입 경로가 둘인 첫 화면이다** — 사이드바 항목(D-19)과 재고실사 마감 결과의
 * 링크(D-18). W-01-11이 링크 하나뿐이었던 것과 갈리는 자리이고, 그 근거는 **직접 등록이
 * 다른 화면을 거치지 않고 들어오는 정상 경로**라는 것이다(원천이 셋 — 착수 이슈 §6).
 *
 * 이 describe가 두 경로를 양쪽에서 잰다 — 메뉴에 있고, 링크가 가리키는 주소가 실재한다.
 */
describe('appRouter — 재고조정의 진입 경로', () => {
  /*
   * **C46** — 메뉴에 항목이 있다. 주소와 글자를 **둘 다** 센다: 주소만 보면 이름이 다른 메뉴가
   * 같은 화면을 열어도 통과하고, 글자만 보면 이름만 같고 다른 곳으로 가는 메뉴가 통과한다.
   */
  it('사이드바에 이 화면 항목이 있다', () => {
    expect(sidebarHrefs()).toContain('/logistics/stock-adjust');

    const nav = screen.getByRole('navigation', { name: '주 메뉴' });

    expect(within(nav).getByText('재고조정')).toBeInTheDocument();
  });

  /*
   * **사이드바 대조와 같은 형태의 이음매다.** 재고실사의 마감 결과 링크와 라우트 표는 서로 다른
   * 파일에 있고 서로를 참조하지 않는다 — 한쪽만 고치면 죽은 링크가 남는데, 그 슬라이스의 시험은
   * `href` 글자만 보고 이 화면의 시험은 라우트를 거치지 않아 **어느 쪽도 그 어긋남을 보지 못한다.**
   */
  it('재고실사 마감 결과 링크가 가리키는 주소가 라우트 표에 있다', () => {
    const [pathname] = stockAdjustEntryPath(9001).split('?');

    expect(routedPaths()).toContain(pathname);
  });

  /*
   * **C46·C47** — 그 링크의 주소로 들어가면 화면이 **그 실사의 맥락으로** 선다.
   *
   * 주소를 손으로 적지 않고 **링크가 만드는 값을 그대로 태운다** — 질의 열쇠(`count`)가 받는
   * 쪽이 읽는 이름과 어긋나면 여기서 맥락 없는 화면이 서고 이 시험이 운다.
   */
  it('그 주소로 들어가면 대상 실사가 실린 화면이 선다', async () => {
    renderWithProviders(<RoutedApp />, {
      fetch: createStubFetch(stockAdjustRoutes()),
      route: stockAdjustEntryPath(9101),
    });

    expect(
      await screen.findByRole('radio', { name: messages.stockAdjust.source.count }),
    ).toBeChecked();
    /* 목록이 도착해야 고른 실사가 이름으로 선다 — 번호만 실린 주소가 이름으로 풀리는 자리다. */
    await waitFor(() => {
      expect(screen.getByLabelText(messages.stockAdjust.source.countField)).toHaveTextContent(
        'SAMPLE-IC-9101 · 2026-08-17',
      );
    });
  });

  /*
   * **짝 음성** — 위 시험이 「무엇이든 그리기만 하면 통과」가 되지 않게, 맥락을 뺀 같은 주소가
   * 실제로 **직접 등록** 갈래를 세우는 것을 함께 잰다(원천이 셋 · 실사 참조 공란이 정상).
   * 사이드바로 들어오는 길이 바로 이 갈래다.
   */
  it('맥락 없이 그 주소로 들어가면 직접 등록 갈래로 선다', async () => {
    renderWithProviders(<RoutedApp />, {
      fetch: createStubFetch(stockAdjustRoutes()),
      route: '/logistics/stock-adjust',
    });

    expect(
      await screen.findByRole('radio', { name: messages.stockAdjust.source.direct }),
    ).toBeChecked();
    /*
     * **앞 맥락이 새지 않았다**(전례가 가진 반대 축 — 리뷰 R-6②). 갈래만 재면 「고른 실사는
     * 그대로인데 라디오만 직접 등록」인 상태를 통과시킨다 — 그 상태가 곧 화면과 주소가 다른
     * 말을 하는 자리다.
     */
    expect(screen.queryByText('SAMPLE-IC-9101 · 2026-08-17')).not.toBeInTheDocument();
  });
});

/**
 * **W-01-11은 이 저장소에서 처음으로 메뉴에 서지 않는 화면이다**(착수 이슈 §6 ① · 스펙 §5-2).
 *
 * 메뉴에 「신규 P/O 등록」이 서면 맥락 없는 진입이 기본 경로가 되고, 그때 사용자가 하는 일이
 * 곧 일반 구매 발주 등록이다. 그래서 **진입은 초과 입하 분리의 등록 결과 링크 하나뿐**이고,
 * 이 describe가 그 한 갈래를 양쪽에서 잰다 — 메뉴에는 없고, 링크가 가리키는 주소는 실재한다.
 */
describe('appRouter — 신규 P/O 등록의 진입 경로', () => {
  /*
   * **C33** — 메뉴에 항목이 없다. 주소와 글자를 **둘 다** 센다: 주소만 보면 이름이 다른 메뉴가
   * 같은 화면을 열어도 통과하고, 글자만 보면 이름을 바꿔 단 메뉴가 통과한다.
   */
  it('사이드바에 이 화면 항목이 없다', () => {
    const hrefs = sidebarHrefs();

    /* 짝 양성 — 사이드바는 실제로 그려졌고 같은 섹션의 앞 화면은 거기 있다. */
    expect(hrefs).toContain('/logistics/over-receipt-split');
    expect(hrefs).not.toContain('/logistics/po-register');

    const nav = screen.getByRole('navigation', { name: '주 메뉴' });

    expect(within(nav).queryByText('신규 P/O 등록')).not.toBeInTheDocument();
  });

  /*
   * **사이드바 대조와 같은 형태의 이음매다.** 등록 결과의 링크와 라우트 표는 서로 다른 파일에
   * 있고 서로를 참조하지 않는다 — 한쪽만 고치면 죽은 링크가 남는데, 그 슬라이스의 시험은
   * `href` 글자만 보고 화면 시험은 라우트를 거치지 않아 **어느 쪽도 그 어긋남을 잡지 못한다.**
   */
  it('등록 결과 링크가 가리키는 주소가 라우트 표에 있다', () => {
    const [pathname] = poRegisterEntryPath(9101).split('?');

    expect(routedPaths()).toContain(pathname);
  });

  /*
   * **C32·C37** — 그 링크의 주소로 들어가면 화면이 **그 맥락으로** 선다.
   *
   * 주소를 손으로 적지 않고 **링크가 만드는 값을 그대로 태운다** — 질의 열쇠(`receipt`)가
   * 받는 쪽이 읽는 이름과 어긋나면 여기서 맥락 없는 화면이 서고 이 시험이 운다.
   */
  it('그 주소로 들어가면 대상 초과분이 실린 화면이 선다', async () => {
    renderWithProviders(<RoutedApp />, {
      fetch: createStubFetch(poRegisterRoutes()),
      route: poRegisterEntryPath(9101),
    });

    expect(await screen.findByText('SAMPLE-IR-9101')).toBeInTheDocument();
    /* 맥락이 실제로 실렸다 — 못 읽었으면 아래 짝 시험의 빈 상태가 이 자리에 선다. */
    expect(screen.queryByText(t.empty.noContextTitle)).not.toBeInTheDocument();
  });

  /*
   * **짝 음성** — 위 시험이 「무엇이든 그리기만 하면 통과」가 되지 않게, 맥락을 뺀 같은 주소가
   * 실제로 다른 화면을 세우는 것을 함께 잰다. 질의 열쇠가 어긋나면 위 시험이 이쪽 모습을 본다.
   */
  it('맥락 없이 그 주소로 들어가면 넘어온 초과분이 없다고 말한다', async () => {
    const [pathname] = poRegisterEntryPath(9101).split('?');

    renderWithProviders(<RoutedApp />, {
      fetch: createStubFetch(poRegisterRoutes()),
      route: pathname ?? '',
    });

    expect(await screen.findByText(t.empty.noContextTitle)).toBeInTheDocument();
    expect(screen.queryByText('SAMPLE-IR-9101')).not.toBeInTheDocument();
  });
});

/**
 * **W-CO-01은 이 저장소에서 셸 밖에 서는 첫 화면이다**(스펙 근거: omf-mes#155).
 *
 * 아직 로그인하지 않은 사람에게 사이드바를 보이면 누를 수 없는 항목만 늘어선 화면이 된다.
 * 이 describe가 그 사실을 **세 자리에서** 잰다 — 라우트 표의 어느 층에 있는가, 메뉴에 없는가,
 * 그리고 로그인하면 셸 안으로 실제로 들어가는가.
 */
describe('appRouter — 계정 로그인의 자리', () => {
  /**
   * ⭐ **셸 자식이 아니라 형제다.** `routedPaths()`(셸 자식)와 `topLevelPaths()`(최상위)를
   * **둘 다** 재야 「어느 층에 있는가」가 고정된다 — 한쪽만 보면 층이 바뀌어도 조용하다.
   */
  it('최상위 라우트에 있고 셸 자식 목록에는 없다', () => {
    expect(topLevelPaths()).toContain('/login');
    expect(routedPaths()).not.toContain('/login');
  });

  /** 앞머리를 두지 않는다 — 셸 밖 화면이라 사이드바 섹션이라는 근거 자체가 없다. */
  it('앞머리 없는 주소를 쓴다', () => {
    expect(topLevelPaths()).not.toContain('/system/login');
    expect(topLevelPaths()).not.toContain('/app/sessions');
  });

  /**
   * ⛔ **메뉴에 두지 않는다.** 로그인은 메뉴 항목이 아니다 — 이미 로그인한 사람에게는 죽은
   * 항목이고, 로그인하지 않은 사람은 그 메뉴를 볼 수 없다(이 화면에 사이드바가 없다).
   *
   * 주소와 글자를 **둘 다** 센다: 주소만 보면 이름이 다른 메뉴가 같은 화면을 열어도 통과하고,
   * 글자만 보면 이름을 바꿔 단 메뉴가 통과한다.
   */
  it('사이드바에 로그인 항목이 없다', () => {
    const hrefs = sidebarHrefs();

    /* 짝 양성 — 사이드바는 실제로 그려졌다. */
    expect(hrefs).toContain('/master-data/warehouse-location');
    expect(hrefs).not.toContain('/login');

    const nav = screen.getByRole('navigation', { name: '주 메뉴' });

    expect(within(nav).queryByText('로그인')).not.toBeInTheDocument();
  });

  /**
   * ⭐ **셸이 없다.** 라우트 표를 그대로 태워 재므로, 이 화면을 셸 자식으로 옮기면 여기서 운다.
   */
  it('그 주소로 들어가면 사이드바 없이 로그인 화면이 선다', () => {
    renderWithProviders(<RoutedApp />, { route: '/login' });

    expect(screen.getByRole('heading', { level: 1, name: messages.login.title })).toBeVisible();
    expect(screen.getByLabelText(messages.login.fields.loginId)).toBeInTheDocument();

    expect(screen.queryByRole('navigation')).toBeNull();
    expect(screen.queryByRole('banner')).toBeNull();
  });

  /**
   * ⭐ **셸 안팎 전환이 실제로 일어난다**(완료 조건 T4-7). 로그인하면 셸 밖 화면에서 셸 안으로
   * 들어가고, **그 셸의 상단 바에 방금 담긴 이름이 선다** — 세션이 화면에서 셸로 건너갔다는
   * 것을 이 한 시험이 끝에서 끝까지 잰다.
   */
  it('로그인에 성공하면 셸 안으로 들어가고 상단 바에 이름이 선다', async () => {
    const user = userEvent.setup();
    const session = sessionBody();

    renderWithProviders(<RoutedApp />, {
      route: '/login',
      /*
       * 로그인 응답만 정하고 **나머지는 빈 목록으로 받아 준다.** 넘어간 뒤 서는 화면이 무엇을
       * 부르는지는 이 시험의 관심이 아니다 — 그 화면의 조회를 하나씩 흉내 내면 이 시험이
       * 그 화면의 사정에 묶인다.
       */
      fetch: (request) =>
        Promise.resolve(
          request.method === 'POST' && new URL(request.url).pathname === '/app/sessions'
            ? jsonResponse(session)
            : jsonResponse(listBody([])),
        ),
    });

    await user.type(screen.getByLabelText(messages.login.fields.loginId), 'SYN-LOGIN-01');
    await user.type(screen.getByLabelText(messages.login.fields.password), 'SYN-PW-VALUE-01');
    await user.click(screen.getByRole('button', { name: messages.login.actions.submit }));

    /* 셸이 섰다 — 로그인 화면에는 없던 랜드마크다. */
    const nav = await screen.findByRole('navigation', { name: '주 메뉴' });

    expect(nav).toBeInTheDocument();

    /*
     * 셸 상단 바를 **브랜드로 찾는다.** 넘어간 뒤 서는 화면의 `PageHeader`도 `banner` 역할을
     * 가져 이 문서에 그 역할이 둘이다 — 순서로 고르면 화면 구성이 바뀔 때 조용히 어긋난다.
     */
    const shellTopbar = screen
      .getAllByRole('banner')
      .find((element) => within(element).queryByText('OMF-MES 관리웹') !== null);

    if (shellTopbar === undefined) {
      throw new Error('셸 상단 바를 찾지 못했습니다');
    }

    expect(within(shellTopbar).getByText(session.userName)).toBeInTheDocument();

    /* 로그인 화면은 사라졌다 — 셸 안에 그 폼이 남아 있으면 전환이 아니라 겹침이다. */
    expect(screen.queryByLabelText(messages.login.fields.password)).toBeNull();
  });
});

/**
 * **W-CO-03은 진입 경로가 사이드바 하나뿐이다** — 다른 화면에서 넘어오는 링크가 없다
 * (종 배지를 만들지 않았으므로 상단 바에도 길이 없다 · 결정 ②).
 *
 * **네 PR이 함께 여는 자리다.** 기간·목록·조건·쪽 이동·읽음 처리가 다 서기 전에는 라우트를
 * 두지 않았다(정책 §5.2) — 읽음으로 바꿀 수 없는 동안에는 알림이 계속 쌓이기만 한다.
 * 그래서 이 describe가 **여는 쪽을 양쪽에서** 잰다: 메뉴에 있고, 그 메뉴가 가리키는 주소가
 * 실제로 이 화면을 연다.
 */
describe('appRouter — IQC 수입검사·판정의 진입 경로', () => {
  it('사이드바에 이 화면 항목이 있다', () => {
    expect(sidebarHrefs()).toContain('/logistics/iqc-inspection');

    const nav = screen.getByRole('navigation', { name: '주 메뉴' });

    expect(within(nav).getByText(messages.iqcInspection.title)).toBeInTheDocument();
  });

  /**
   * ⛔ **「품질」 섹션을 새로 만들지 않는다** — 통합 IA 가 이 화면을 「자재/창고 > 입하·검사」에
   * 두었고 형제 화면(W-01-02)이 이미 그 섹션에 있다. 차례는 업무 순서다: 도착을 처리한 뒤
   * 받아들여도 되는지 판정하고, 그 다음 창고로 받아들인다.
   */
  it('초과 입하 분리와 정상품 입하 처리 사이에 선다 — 차례가 업무 순서다', () => {
    const hrefs = sidebarHrefs();

    expect(hrefs.indexOf('/logistics/iqc-inspection')).toBeGreaterThan(
      hrefs.indexOf('/logistics/over-receipt-split'),
    );
    expect(hrefs.indexOf('/logistics/iqc-inspection')).toBeLessThan(
      hrefs.indexOf('/logistics/goods-receipt'),
    );
  });

  /** **실제 라우트 표를 태우므로** 라우트 줄이 없거나 다른 화면을 가리키면 여기서 운다. */
  it('그 주소로 들어가면 화면이 첫 상태로 선다', async () => {
    renderRoutedApp('/logistics/iqc-inspection', iqcInspectionRoutes());

    expect(
      await screen.findByRole('heading', { level: 1, name: messages.iqcInspection.title }),
    ).toBeInTheDocument();
  });

  /**
   * ⭐ 라우트만 열고 화면이 서지 않는 상태를 잡으려면 **조회가 실제로 도는 것**까지 봐야 한다.
   * 이 화면의 첫 진입은 검사 대기 큐 하나다.
   */
  it('첫 진입에 검사 대기 큐가 실제로 그려진다', async () => {
    renderRoutedApp('/logistics/iqc-inspection', iqcInspectionRoutes());

    await screen.findByRole('heading', { level: 1, name: messages.iqcInspection.title });

    expect(await screen.findByText('IR-2026-0001')).toBeInTheDocument();
  });
});

describe('appRouter — Lot Status 현황·변경이력 조회의 진입 경로', () => {
  it('품질관리 사이드바 항목이 화면 주소를 가리킨다', () => {
    expect(sidebarHrefs()).toContain('/quality/lot-status');

    const nav = screen.getByRole('navigation', { name: '주 메뉴' });
    expect(within(nav).getByText('Lot Status 현황·변경이력 조회')).toBeInTheDocument();
  });

  it('그 주소로 들어가면 LOT 조회의 첫 상태가 선다', async () => {
    renderRoutedApp('/quality/lot-status', lotStatusRoutes());

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Lot Status 현황·변경이력 조회',
      }),
    ).toBeInTheDocument();
    expect(await screen.findByText('LOT 유형 기준값이 준비되지 않았습니다.')).toBeVisible();
  });
});

describe('appRouter — W/O 마감·ERP 실적 송신의 진입 경로', () => {
  it('생산실행 메뉴를 키보드로 열면 실제 마감 화면의 첫 상태가 선다', async () => {
    const user = userEvent.setup();
    renderRoutedApp('/quality/lot-status', [...workOrderCloseRoutes(), ...lotStatusRoutes()]);

    const link = screen.getByRole('link', { name: messages.workOrderClose.title });
    link.focus();
    await user.keyboard('{Enter}');

    await waitFor(() => expect(currentLocation()).toBe('/production/work-order-close'));
    expect(
      screen.getAllByRole('heading', { level: 1, name: messages.workOrderClose.title }),
    ).toHaveLength(1);
    const breadcrumb = screen.getByRole('navigation', { name: '탐색 경로' });
    const breadcrumbItems = within(within(breadcrumb).getByRole('list')).getAllByRole('listitem');
    expect(breadcrumbItems).toHaveLength(2);
    expect(
      within(breadcrumbItems[0]!).getByText(messages.workOrderClose.breadcrumbRoot),
    ).toBeVisible();
    expect(within(breadcrumbItems[1]!).getByText(messages.workOrderClose.title)).toBeVisible();
    const pane = screen.getByRole('region', { name: messages.workOrderClose.candidateList.pane });
    expect(await within(pane).findByRole('button', { name: 'SYN-WO-9701 선택' })).toBeVisible();
    expect(await within(pane).findByText(/합성 마감 품목/)).toBeVisible();
  });

  it('화면 주소는 API close 리소스가 아니라 정확한 공개 route다', () => {
    expect(routedPaths()).toContain('/production/work-order-close');
    expect(routedPaths()).not.toContain('/production/work-orders/:workOrderId:close');
  });
});

describe('appRouter — 알림센터의 진입 경로', () => {
  it('사이드바에 이 화면 항목이 있다', () => {
    expect(sidebarHrefs()).toContain('/notification/center');

    const nav = screen.getByRole('navigation', { name: '주 메뉴' });

    expect(within(nav).getByText('알림센터')).toBeInTheDocument();
  });

  /** **실제 라우트 표를 태우므로** 라우트 줄이 없거나 다른 화면을 가리키면 여기서 운다. */
  it('그 주소로 들어가면 알림센터 화면이 첫 상태로 선다', async () => {
    renderRoutedApp('/notification/center', notificationCenterRoutes());

    expect(
      await screen.findByRole('heading', { level: 1, name: messages.notificationCenter.title }),
    ).toBeInTheDocument();
  });

  /**
   * ⭐ **주소에 기간이 없으면 화면이 기본 7일을 심는다** — 라우트를 거친 첫 진입이 그 경로다.
   * 라우트만 열고 화면이 서지 않는 상태를 잡으려면 **조회가 실제로 도는 것**까지 봐야 한다.
   */
  it('첫 진입에 기간이 주소에 심긴다', async () => {
    renderRoutedApp('/notification/center', notificationCenterRoutes());

    await screen.findByRole('heading', { level: 1, name: messages.notificationCenter.title });

    await waitFor(() => {
      expect(screen.getByTestId('location').textContent).toContain('from=');
    });
    expect(screen.getByTestId('location').textContent).toContain('to=');
  });
});

/**
 * **W-01-13은 진입 경로가 사이드바 하나뿐이다** — 다른 화면에서 넘어오는 링크가 없다.
 *
 * **다섯 PR이 함께 여는 자리다.** 목록·상세·취소 요청·승인 진행·취소 실행이 다 서기 전에는
 * 라우트를 두지 않았다(정책 §5.2) — 취소는 반드시 승인을 타는데 실행할 자리가 없는 채로 열면
 * 사용자가 **승인을 받아 놓고 아무것도 할 수 없다.**
 *
 * ⚠ **지금 이 화면은 목록을 한 번도 부르지 못한다.** 문서 유형 값 목록이 아직 확정되지 않아
 * (자리표시 빈 표) 계약이 필수로 두는 질의값을 만들 수 없다. 아래 감지기들은 그 **정직한 첫
 * 상태**를 그대로 재며, 표가 채워지는 순간 같은 자리에서 조회가 살아난다.
 */
describe('appRouter — 물류 문서 진행현황·취소의 진입 경로', () => {
  const docProgress = messages.documentProgress;

  /** 합성 문서번호다 — 실 운영 값을 쓰지 않는다(루트 `CLAUDE.md`). */
  const SYNTHETIC_DOCUMENT_NO = 'SYN-GR-2026-0001';

  /*
   * **C5-2** — 메뉴에 항목이 있다. 주소와 글자를 **둘 다** 센다: 주소만 보면 이름이 다른 메뉴가
   * 같은 화면을 열어도 통과하고, 글자만 보면 이름만 같고 다른 곳으로 가는 메뉴가 통과한다.
   */
  it('사이드바에 이 화면 항목이 있다', () => {
    expect(sidebarHrefs()).toContain('/logistics/document-progress');

    const nav = screen.getByRole('navigation', { name: '주 메뉴' });

    expect(within(nav).getByText('물류 문서 진행현황·취소')).toBeInTheDocument();
  });

  /*
   * **C5-1** — 그 주소로 들어가면 화면이 선다. **실제 라우트 표를 태우므로** 라우트 줄이 없거나
   * 다른 화면을 가리키면 여기서 운다.
   *
   * 스텁을 **빈 목록으로 준다** — 이 진입에서 나가는 요청이 하나라도 있으면 스텁이 던져 시험이
   * 운다. 「부르지 않는다」를 라우트 경로에서도 지키는 자리다.
   */
  it('그 주소로 들어가면 물류 문서 진행현황·취소 화면이 첫 상태로 선다', async () => {
    renderRoutedApp('/logistics/document-progress', []);

    expect(
      await screen.findByRole('heading', { level: 1, name: docProgress.title }),
    ).toBeInTheDocument();
    /* 빈 표가 아니라 **왜 비었는지 말하는 안내**가 선다 — 화면이 자기 첫 상태로 섰다는 사실이다. */
    expect(screen.getByText(docProgress.empty.typesPendingTitle)).toBeInTheDocument();
  });

  /*
   * ⭐ **라우트를 여는 것이 요청을 시작하는 것이 아니다**(완료 조건 C1-1의 라우트 쪽 짝).
   *
   * 유형 표가 비어 있는 동안 이 화면은 어떤 주소로 들어와도 조회를 내지 않는다. 위 시험은 스텁이
   * **던져서** 잡지만 그것은 「오류가 났다」로 보고돼 **몇 번 나갔는지**를 말하지 못한다 — 여기서는
   * 받아 주고 **횟수를 센다.** 둘의 차이가 곧 「막혔다」와 「막힌 줄 알았다」의 차이다.
   */
  it('그 주소로 들어가도 요청이 하나도 나가지 않는다', async () => {
    const requests: Request[] = [];

    renderWithProviders(<RoutedApp />, {
      route: '/logistics/document-progress',
      fetch: (request) => {
        requests.push(request);

        return Promise.resolve(jsonResponse(listBody([])));
      },
    });

    /* 짝 양성 — 화면이 실제로 섰다. 서지도 않은 화면에서 「0회」는 아무것도 뜻하지 않는다. */
    expect(
      await screen.findByRole('heading', { level: 1, name: docProgress.title }),
    ).toBeInTheDocument();
    expect(screen.getByText(docProgress.empty.typesPendingTitle)).toBeInTheDocument();

    expect(requests).toHaveLength(0);
  });

  /*
   * ⭐ **사이드바와 라우트 표를 잇는 이음매.** 둘은 서로 다른 파일에 있고 서로를 참조하지 않는다 —
   * 한쪽만 고치면 죽은 링크가 남는데, 사이드바 시험은 `href` 글자만 보고 화면 시험은 라우터를
   * 거치지 않아 **어느 쪽도 그 어긋남을 보지 못한다.** 그래서 **누른다.**
   *
   * 조건이 실린 주소에서 누르는 것은 우연이 아니다 — 메뉴는 **조건 없는 같은 라우트**를 가리키므로
   * 이 화면에서 사이드바가 여는 길이 곧 「같은 라우트에 질의만 다른 이동」이다. 조건 줄이 그 이동을
   * 따라오지 못하면 **주소는 비었는데 조건 줄은 옛 값을 말하는** 화면이 된다.
   */
  it('사이드바 항목을 누르면 그 주소로 가고 조건 줄이 첫 상태로 돌아온다', async () => {
    const user = userEvent.setup();

    renderRoutedApp(`/logistics/document-progress?q=${SYNTHETIC_DOCUMENT_NO}&item=9301`, []);

    /* 짝 양성 — 주소의 조건이 라우트를 지나 조건 줄까지 실려 왔다. */
    expect(await screen.findByLabelText(docProgress.fields.q)).toHaveValue(SYNTHETIC_DOCUMENT_NO);

    const nav = screen.getByRole('navigation', { name: '주 메뉴' });

    await user.click(within(nav).getByRole('link', { name: '물류 문서 진행현황·취소' }));

    await waitFor(() => {
      expect(currentLocation()).toBe('/logistics/document-progress');
    });
    expect(screen.getByLabelText(docProgress.fields.q)).toHaveValue('');
    expect(screen.getByLabelText(docProgress.fields.item)).toHaveValue('');
  });

  /*
   * **히스토리가 한 칸이다.** 메뉴 이동이 칸을 둘 이상 늘리면 사용자는 뒤로 눌러도 보던 자리로
   * 돌아오지 못한다 — 이 화면은 조건도 고른 문서도 전부 주소에 싣는다.
   *
   * **돌아온 자리가 그 조건의 화면임을 함께 본다** — 주소만 되돌고 조건 줄이 빈 채로 남으면
   * 돌아온 것이 아니다.
   */
  it('메뉴로 들어간 뒤 뒤로가기 한 번이면 앞 자리로 돌아온다', async () => {
    const user = userEvent.setup();

    renderRoutedApp(`/logistics/document-progress?q=${SYNTHETIC_DOCUMENT_NO}&item=9301`, []);

    await screen.findByRole('heading', { level: 1, name: docProgress.title });

    const before = currentLocation();
    const nav = screen.getByRole('navigation', { name: '주 메뉴' });

    await user.click(within(nav).getByRole('link', { name: '물류 문서 진행현황·취소' }));
    await waitFor(() => {
      expect(currentLocation()).toBe('/logistics/document-progress');
    });

    await user.click(screen.getByRole('button', { name: '뒤로' }));

    await waitFor(() => {
      expect(currentLocation()).toBe(before);
    });
    expect(screen.getByLabelText(docProgress.fields.q)).toHaveValue(SYNTHETIC_DOCUMENT_NO);
  });

  /*
   * ⛔ **내부 번호는 주소에만 산다**(`omf-mes#44`). 이 화면은 조건(품목·자재 LOT·창고)과 고른
   * 문서를 전부 번호로 주소에 싣는데, 그 번호가 글자로 새면 사용자가 읽을 수 없는 값이 화면의
   * 사실이 된다.
   *
   * **주소에 실려 있음을 먼저 확인한 뒤** 글자에서 센다 — 값이 없어서 통과하는 일이 없게.
   *
   * ⚠ **지금 이 감지기가 닿는 자리는 얇다.** 유형 표가 비어 있어 목록도 아래 상세 구획도 서지
   * 않고, 조건 번호는 입력 칸의 **값**으로만 있어 글자 수집에 잡히지 않는다. 그래도 이 자리에
   * 두는 이유는 **표가 채워지는 순간 같은 시험이 그 넓어진 화면을 그대로 훑기** 때문이다.
   */
  it('메뉴와 화면 어디에도 내부 번호가 글자로 나오지 않는다', async () => {
    renderRoutedApp('/logistics/document-progress?item=9301&lot=9401&wh=9501&sel=9101', []);

    await screen.findByRole('heading', { level: 1, name: docProgress.title });

    /* 짝 양성 — 그 번호들은 주소에 실제로 실려 있다. */
    expect(currentLocation()).toContain('item=9301');
    expect(currentLocation()).toContain('sel=9101');

    const nav = screen.getByRole('navigation', { name: '주 메뉴' });
    const main = screen.getByRole('main');

    for (const internalId of ['9301', '9401', '9501', '9101']) {
      expect(nav.textContent).not.toContain(internalId);
      expect(main.textContent).not.toContain(internalId);
    }
  });
});

/**
 * **W-05-12 는 도메인 05(설비/툴)의 첫 화면이자 그 섹션을 여는 자리다.**
 *
 * **여섯 PR이 함께 여는 자리다.** 그룹 목록·등록·수정·중지와 설비 목록·등록·수정·중지가
 * 다 서기 전에는 라우트를 두지 않았다(정책 §5.2) — 그룹만 있고 설비를 붙일 수 없는
 * 「설비 마스터」를 노출하면 사용자가 화면을 열어 놓고 할 일을 할 수 없다.
 *
 * 그래서 이 describe 가 **여는 쪽을 양쪽에서** 잰다: 메뉴에 있고, 그 메뉴가 가리키는 주소가
 * 실제로 이 화면을 연다.
 */
describe('appRouter — 설비·설비그룹 마스터의 진입 경로', () => {
  it('사이드바에 이 화면 항목이 있다', () => {
    expect(sidebarHrefs()).toContain('/equipment/master');

    const nav = screen.getByRole('navigation', { name: '주 메뉴' });

    expect(within(nav).getByText(messages.equipmentMaster.title)).toBeInTheDocument();
  });

  /**
   * **자재창고·품질관리 뒤, 승인 앞이다** — 업무 도메인 섹션들을 붙여 두고 그 위를 가로지르는
   * 것(승인·알림)과 운영 설정(시스템 관리)을 끝에 남긴다. 도메인 번호 차례이기도 하다
   * (자재창고 01 → 품질관리 03 → 설비/툴 05).
   */
  it('품질관리 뒤·승인 앞에 선다', () => {
    const hrefs = sidebarHrefs();

    expect(hrefs.indexOf('/equipment/master')).toBeGreaterThan(
      hrefs.indexOf('/quality/lot-status'),
    );
    expect(hrefs.indexOf('/equipment/master')).toBeLessThan(hrefs.indexOf('/approval/inbox'));
  });

  /** **실제 라우트 표를 태우므로** 라우트 줄이 없거나 다른 화면을 가리키면 여기서 운다. */
  it('그 주소로 들어가면 화면이 첫 상태로 선다', async () => {
    renderRoutedApp('/equipment/master', equipmentMasterRoutes());

    expect(
      await screen.findByRole('heading', { level: 1, name: messages.equipmentMaster.title }),
    ).toBeInTheDocument();
  });

  /**
   * ⭐ 라우트만 열고 화면이 서지 않는 상태를 잡으려면 **조회가 실제로 도는 것**까지 봐야 한다.
   * 이 화면의 첫 진입은 설비 그룹 목록 하나다.
   */
  it('첫 진입에 설비 그룹 목록이 실제로 그려진다', async () => {
    renderRoutedApp('/equipment/master', equipmentMasterRoutes());

    expect(await screen.findByRole('button', { name: 'GRP-A' })).toBeInTheDocument();
  });

  /*
   * 주소 앞머리는 계약 경로(`/mdm/**`)가 아니라 사이드바 섹션을 따른다.
   * 차례도 함께 잰다 — 한정어 없는 이름(설비 마스터)이 먼저 서고 자기 이름을 붙인 것들이 뒤따른다.
   */
  it('주소 앞머리가 섹션을 따른다', () => {
    expect(sidebarHrefs().filter((href) => href.startsWith('/equipment/'))).toEqual([
      '/equipment/master',
      '/equipment/tool-master',
      '/equipment/work-calendar',
      '/equipment/collection-channels',
      '/equipment/shot-conversion',
      '/equipment/gauge-master',
    ]);
  });
});

/**
 * **W-05-09는 미결이 있는데도 메뉴를 연다** — 형제 W-05-11 과 갈리는 근거를 이 describe 가 잰다.
 *
 * 사유 코드 값 목록이 아직 없으나(`omf-mes#145`) 사유는 계약이 **선택**으로 둔 값이라 비워도
 * 저장되고, 목록의 내용을 정하는 조건도 아니다 — 메뉴 이름이 약속하는 것은 그대로 참이다.
 */
describe('appRouter — 작업 캘린더 설정의 진입 경로', () => {
  it('사이드바에 이 화면 항목이 있다', () => {
    expect(sidebarHrefs()).toContain('/equipment/work-calendar');

    const nav = screen.getByRole('navigation', { name: '주 메뉴' });

    expect(within(nav).getByRole('link', { name: '작업 캘린더 설정' })).toHaveAttribute(
      'href',
      '/equipment/work-calendar',
    );
  });

  /* 마스터 셋 뒤다 — 앞의 둘이 「무엇이 있는가」를 정하고 이것은 「언제 도는가」를 정한다. */
  it('같은 섹션의 마스터들 뒤에 선다', () => {
    const hrefs = sidebarHrefs();

    expect(hrefs.indexOf('/equipment/work-calendar')).toBeGreaterThan(
      hrefs.indexOf('/equipment/tool-master'),
    );
  });

  it('라우트 표에 주소가 있다', () => {
    expect(routedPaths()).toContain('/equipment/work-calendar');
  });

  /** **실제 라우트 표를 태우므로** 라우트 줄이 없거나 다른 화면을 가리키면 여기서 운다. */
  it('그 주소로 들어가면 화면이 첫 상태로 선다', async () => {
    renderRoutedApp('/equipment/work-calendar', workCalendarRoutes());

    expect(
      await screen.findByRole('heading', { level: 1, name: messages.workCalendar.title }),
    ).toBeInTheDocument();
  });

  /* ⭐ 라우트만 열고 화면이 서지 않는 상태를 잡으려면 조회가 실제로 도는 것까지 봐야 한다. */
  it('첫 진입에 캘린더 목록이 실제로 그려진다', async () => {
    renderRoutedApp('/equipment/work-calendar', workCalendarRoutes());

    expect(await screen.findByRole('button', { name: 'CAL-A' })).toBeInTheDocument();
  });

  /* 일자를 고칠 수 없는 「설정」 화면을 노출하지 않는다(정책 §5.2). */
  it('첫 진입에 캘린더를 골라 일자를 고치러 갈 수 있다', async () => {
    renderRoutedApp('/equipment/work-calendar', workCalendarRoutes());

    await screen.findByRole('button', { name: 'CAL-A' });

    expect(
      screen.getByRole('button', { name: messages.workCalendar.actions.addCalendar }),
    ).toBeEnabled();
    expect(
      screen.getByRole('region', { name: messages.workCalendar.grid.title }),
    ).toBeInTheDocument();
  });
});

/**
 * **W-05-01은 도메인 05 의 마지막 화면이다** — 라우트와 메뉴를 함께 연다.
 *
 * ⚠ 낙관적 잠금이 이 자원에 없지만(`omf-mes#210`) 메뉴를 미루지 않는다 — 그것은 동시
 * 편집에서만 드러나는 한계이지 「타발수 환산 파라미터 설정」이라는 이름이 약속하는 것을
 * 어기지 않는다.
 */
describe('appRouter — 타발수 환산 파라미터 설정의 진입 경로', () => {
  it('사이드바에 이 화면 항목이 있다', () => {
    expect(sidebarHrefs()).toContain('/equipment/shot-conversion');

    const nav = screen.getByRole('navigation', { name: '주 메뉴' });

    expect(within(nav).getByRole('link', { name: '타발수 환산 파라미터 설정' })).toHaveAttribute(
      'href',
      '/equipment/shot-conversion',
    );
  });

  /* 섹션 맨 뒤다 — 세는 규칙은 셀 대상이 다 선 뒤에 온다. */
  it('같은 섹션의 앞선 넷 뒤에 선다', () => {
    const hrefs = sidebarHrefs();

    expect(hrefs.indexOf('/equipment/shot-conversion')).toBeGreaterThan(
      hrefs.indexOf('/equipment/collection-channels'),
    );
  });

  it('라우트 표에 주소가 있다', () => {
    expect(routedPaths()).toContain('/equipment/shot-conversion');
  });

  /** **실제 라우트 표를 태우므로** 라우트 줄이 없거나 다른 화면을 가리키면 여기서 운다. */
  it('그 주소로 들어가면 화면이 첫 상태로 선다', async () => {
    renderRoutedApp('/equipment/shot-conversion', shotConversionRoutes());

    expect(
      await screen.findByRole('heading', { level: 1, name: messages.shotConversion.title }),
    ).toBeInTheDocument();
  });

  /* ⭐ 라우트만 열고 화면이 서지 않는 상태를 잡으려면 조회가 실제로 도는 것까지 봐야 한다. */
  it('첫 진입에 비율 정책이 실제로 그려진다', async () => {
    renderRoutedApp('/equipment/shot-conversion', shotConversionRoutes());

    expect(
      await screen.findByText(
        messages.shotConversion.scope.entry(
          messages.shotConversion.scope.itemId,
          'ITM-201 · 가상 하우징',
        ),
      ),
    ).toBeInTheDocument();
  });

  /* 비율을 정할 수 없는 「설정」 화면을 노출하지 않는다(정책 §5.2). */
  it('첫 진입에 정책을 더하러 갈 수 있다', async () => {
    renderRoutedApp('/equipment/shot-conversion', shotConversionRoutes());

    expect(
      await screen.findByRole('button', { name: messages.shotConversion.actions.addPolicy }),
    ).toBeEnabled();
  });
});

/**
 * **W-05-07은 미결이 있는데도 메뉴를 연다** — 형제 W-05-11 과 갈리는 근거를 이 describe 가 잰다.
 *
 * 계약이 이어 둔 검사 항목의 **이름**을 내려주지 않지만(`omf-mes#203`), 그것은 표시의
 * 한계이지 「수집 채널 매핑 관리」라는 이름이 약속하는 것 — 채널을 항목에 잇는 자리 — 을
 * 어기지 않는다. 잇는 일은 온전히 된다.
 */
describe('appRouter — 수집 채널 매핑 관리의 진입 경로', () => {
  it('사이드바에 이 화면 항목이 있다', () => {
    expect(sidebarHrefs()).toContain('/equipment/collection-channels');

    const nav = screen.getByRole('navigation', { name: '주 메뉴' });

    expect(within(nav).getByRole('link', { name: '수집 채널 매핑 관리' })).toHaveAttribute(
      'href',
      '/equipment/collection-channels',
    );
  });

  /* 섹션 맨 뒤다 — 설비가 먼저 있어야 채널을 붙일 자리가 생긴다. */
  it('같은 섹션의 앞선 셋 뒤에 선다', () => {
    const hrefs = sidebarHrefs();

    expect(hrefs.indexOf('/equipment/collection-channels')).toBeGreaterThan(
      hrefs.indexOf('/equipment/work-calendar'),
    );
  });

  it('라우트 표에 주소가 있다', () => {
    expect(routedPaths()).toContain('/equipment/collection-channels');
  });

  /** **실제 라우트 표를 태우므로** 라우트 줄이 없거나 다른 화면을 가리키면 여기서 운다. */
  it('그 주소로 들어가면 화면이 첫 상태로 선다', async () => {
    renderRoutedApp('/equipment/collection-channels', collectionChannelRoutes());

    expect(
      await screen.findByRole('heading', { level: 1, name: messages.collectionChannel.title }),
    ).toBeInTheDocument();
  });

  /* ⭐ 라우트만 열고 화면이 서지 않는 상태를 잡으려면 조회가 실제로 도는 것까지 봐야 한다. */
  it('첫 진입에 설비 목록이 실제로 그려진다', async () => {
    renderRoutedApp('/equipment/collection-channels', collectionChannelRoutes());

    expect(await screen.findByText('EQ-101')).toBeInTheDocument();
  });

  /*
   * 잇지 못하는 「매핑 관리」를 노출하지 않는다(정책 §5.2). 첫 진입에서 설비를 골라
   * 채널을 더하는 데까지 갈 수 있어야 한다.
   */
  it('첫 진입에 설비를 골라 채널을 더하러 갈 수 있다', async () => {
    const user = userEvent.setup();

    renderRoutedApp('/equipment/collection-channels', collectionChannelRoutes());

    await user.click(
      await screen.findByRole('button', {
        name: messages.collectionChannel.equipment.selectLabel('EQ-101', '가상 성형기 1호'),
      }),
    );

    expect(
      await screen.findByRole('button', {
        name: messages.collectionChannel.actions.addChannel,
      }),
    ).toBeEnabled();
  });
});

/**
 * **W-05-13은 형제(W-05-11)와 갈리는 자리다** — 메뉴를 함께 연다.
 *
 * 그쪽은 계측기 전용 자원이 없어 전체 설비를 보이는 중이라 「계측기 마스터」라는 메뉴 이름이
 * 약속을 어긴다. 이쪽은 **자원이 따로 있어**(`/mdm/molds`) 목록에 서는 것이 정확히 툴이다 —
 * 도구 유형 값 목록이 미결이지만 그것은 **좁히는 축 하나**이지 목록의 내용을 정하는 조건이
 * 아니다. 두 판단이 갈리는 근거가 이 describe 가 재는 것이다.
 */
describe('appRouter — 툴/금형/지그 마스터의 진입 경로', () => {
  it('사이드바에 이 화면 항목이 있다', () => {
    expect(sidebarHrefs()).toContain('/equipment/tool-master');

    const nav = screen.getByRole('navigation', { name: '주 메뉴' });

    /*
     * 주소와 글자를 **둘 다** 센다 — 주소만 보면 이름이 다른 메뉴가 같은 화면을 열어도 통과한다.
     * 메뉴 이름은 화면 제목에서 「관리」를 뺀 형태다(형제 항목들과 같은 규칙).
     */
    expect(within(nav).getByRole('link', { name: '툴/금형/지그 마스터' })).toHaveAttribute(
      'href',
      '/equipment/tool-master',
    );
  });

  /* 한정어 없는 이름(설비 마스터)이 먼저 서고 자기 이름을 붙인 것들이 뒤따른다. */
  it('같은 섹션의 설비 마스터 뒤에 선다', () => {
    const hrefs = sidebarHrefs();

    expect(hrefs.indexOf('/equipment/tool-master')).toBeGreaterThan(
      hrefs.indexOf('/equipment/master'),
    );
  });

  it('라우트 표에 주소가 있다', () => {
    expect(routedPaths()).toContain('/equipment/tool-master');
  });

  /** **실제 라우트 표를 태우므로** 라우트 줄이 없거나 다른 화면을 가리키면 여기서 운다. */
  it('그 주소로 들어가면 화면이 첫 상태로 선다', async () => {
    renderRoutedApp('/equipment/tool-master', toolMasterRoutes());

    expect(
      await screen.findByRole('heading', { level: 1, name: messages.toolMaster.title }),
    ).toBeInTheDocument();
  });

  /* ⭐ 라우트만 열고 화면이 서지 않는 상태를 잡으려면 **조회가 실제로 도는 것**까지 봐야 한다. */
  it('첫 진입에 툴 목록이 실제로 그려진다', async () => {
    renderRoutedApp('/equipment/tool-master', toolMasterRoutes());

    expect(await screen.findByRole('button', { name: 'TL-01' })).toBeInTheDocument();
  });

  /*
   * ⚠ **메뉴를 여는 근거가 화면에 실제로 서 있는지** 함께 잰다 — 형제와 달리 「지금 보이는
   * 것이 툴만은 아니다」는 배너가 없어야 한다. 배너가 선다면 메뉴 이름이 약속을 어기는 것이고,
   * 그때는 형제와 같은 판단(메뉴를 미룬다)을 해야 한다.
   */
  it('무엇이 보이는지 변명하는 배너가 없다', async () => {
    renderRoutedApp('/equipment/tool-master', toolMasterRoutes());

    await screen.findByRole('button', { name: 'TL-01' });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  /* 되돌릴 수 없는 조작까지 다 선 뒤에 메뉴를 연다(정책 §5.2 — 접근 불가능한 경계). */
  it('첫 진입에 등록과 엑셀 올리기를 곧바로 시작할 수 있다', async () => {
    renderRoutedApp('/equipment/tool-master', toolMasterRoutes());

    await screen.findByRole('button', { name: 'TL-01' });

    expect(screen.getByRole('button', { name: messages.toolMaster.actions.addTool })).toBeEnabled();
    expect(
      screen.getByRole('button', { name: messages.toolMaster.actions.importTools }),
    ).toBeEnabled();
  });
});

/**
 * **W-05-11이 메뉴에 섰다** — 값 목록이 확정될 때까지 «잠시» 미뤄 두었던 자리다.
 *
 * 「계측기 마스터」라는 메뉴 이름은 「여기 있는 것은 계측기다」를 약속한다. 유형 값 목록이
 * 없던 동안에는 그 약속을 지킬 수 없어 미뤘고(설계 질의 `omf-mes#195`), 값이 확정돼
 * (회신 · 시드 `omf-mes#182`) 사용자가 실제로 계측기만 골라 볼 수 있게 되면서 세웠다.
 *
 * ⭐ **W-01-11과 갈린다** — 그쪽은 맥락 없는 진입이 요구사항 위반이라 **영영** 두지 않는다.
 * 이제 메뉴에 서지 않는 화면은 그것 하나뿐이다.
 */
describe('appRouter — 계측기 마스터의 진입 경로', () => {
  /*
   * 주소와 글자를 **둘 다** 센다: 주소만 보면 이름이 다른 메뉴가 같은 화면을 열어도 통과하고,
   * 글자만 보면 이름을 바꿔 단 메뉴가 통과한다.
   */
  it('사이드바에 이 화면 항목이 있다', () => {
    const hrefs = sidebarHrefs();

    expect(hrefs).toContain('/equipment/gauge-master');

    const nav = screen.getByRole('navigation', { name: '주 메뉴' });

    expect(within(nav).getByText(messages.gaugeMaster.title)).toBeInTheDocument();
  });

  /** ⭐ 형제들 뒤에 선다 — 라우트는 진작 열려 있었고 메뉴만 뒤늦게 붙은 자리다. */
  it('설비/툴 섹션의 형제들 뒤에 선다', () => {
    const hrefs = sidebarHrefs();

    expect(hrefs.indexOf('/equipment/gauge-master')).toBeGreaterThan(
      hrefs.indexOf('/equipment/shot-conversion'),
    );
  });

  it('라우트 표에는 주소가 있다', () => {
    expect(routedPaths()).toContain('/equipment/gauge-master');
  });

  /** **실제 라우트 표를 태우므로** 라우트 줄이 없거나 다른 화면을 가리키면 여기서 운다. */
  it('그 주소로 들어가면 화면이 첫 상태로 선다', async () => {
    renderRoutedApp('/equipment/gauge-master', gaugeMasterRoutes());

    expect(
      await screen.findByRole('heading', { level: 1, name: messages.gaugeMaster.title }),
    ).toBeInTheDocument();
  });

  /*
   * ⭐ 라우트만 열고 화면이 서지 않는 상태를 잡으려면 **조회가 실제로 도는 것**까지 봐야 한다.
   */
  it('첫 진입에 계측기 목록이 실제로 그려진다', async () => {
    renderRoutedApp('/equipment/gauge-master', gaugeMasterRoutes());

    expect(await screen.findByRole('cell', { name: 'GA-01' })).toBeInTheDocument();
  });

  /* 형제와 같은 섹션 앞머리를 쓴다 — 메뉴에 서지 않아도 주소가 업무 묶음을 말해야 한다. */
  it('설비 섹션 앞머리를 쓴다', () => {
    expect(routedPaths().filter((path) => path.startsWith('/equipment/'))).toEqual(
      expect.arrayContaining(['/equipment/master', '/equipment/gauge-master']),
    );
  });
});
