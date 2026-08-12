import { render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { AppLayout } from '../app/layout';
import { appRouter } from './index';

/**
 * 사이드바가 가리키는 주소와 라우트 표를 **맞춰 본다.**
 *
 * 둘은 서로 다른 파일에 있고 서로를 참조하지 않는다. 한쪽만 고치면 링크가 죽은 채로
 * 남는데, 사이드바 테스트는 `href`만 보고 화면 테스트는 라우터를 거치지 않아
 * **어느 쪽도 그 어긋남을 잡지 못한다.** 이 파일이 그 사이를 잇는다.
 */

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
});
