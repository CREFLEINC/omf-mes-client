import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter, useRoutes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { AppLayout } from '../app/layout';
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

const sidebarHrefs = (): string[] => {
  const router = createMemoryRouter([{ path: '/', element: <AppLayout>본문</AppLayout> }], {
    initialEntries: ['/'],
  });

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
    renderWithProviders(<AppRoutes />, {
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

    renderWithProviders(<AppRoutes />, {
      fetch: createStubFetch(poRegisterRoutes()),
      route: pathname ?? '',
    });

    expect(await screen.findByText(t.empty.noContextTitle)).toBeInTheDocument();
    expect(screen.queryByText('SAMPLE-IR-9101')).not.toBeInTheDocument();
  });
});
