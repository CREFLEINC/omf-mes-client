import { messages } from '@omf-mes/i18n';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter, useRoutes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { AppLayout } from '../app/layout';
import { SessionProvider } from '../patterns/session';
import { sessionBody } from '../screens/login/fixtures';
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
