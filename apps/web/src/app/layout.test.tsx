import { render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { AppLayout } from './layout';

const renderLayout = (children: string) => {
  const router = createMemoryRouter([{ path: '/', element: <AppLayout>{children}</AppLayout> }], {
    initialEntries: ['/'],
  });

  return render(<RouterProvider router={router} />);
};

describe('AppLayout', () => {
  it('사이드바에 기준정보 섹션의 창고·Location 메뉴가 보인다', () => {
    renderLayout('본문 내용');

    const sidebar = screen.getByRole('navigation', { name: '주 메뉴' });

    expect(within(sidebar).getByText('기준정보')).toBeInTheDocument();
    expect(within(sidebar).getByRole('link', { name: '창고·Location' })).toHaveAttribute(
      'href',
      '/master-data/warehouse-location',
    );
  });

  it('사이드바에 Routing(공정) 메뉴가 보인다', () => {
    renderLayout('본문 내용');

    const sidebar = screen.getByRole('navigation', { name: '주 메뉴' });

    expect(within(sidebar).getByRole('link', { name: 'Routing(공정)' })).toHaveAttribute(
      'href',
      '/master-data/routing',
    );
  });

  it('사이드바에 검사기준 메뉴가 보인다', () => {
    renderLayout('본문 내용');

    const sidebar = screen.getByRole('navigation', { name: '주 메뉴' });

    expect(within(sidebar).getByRole('link', { name: '검사기준' })).toHaveAttribute(
      'href',
      '/master-data/inspection-standard',
    );
  });

  it('사이드바에 불량·원인코드 메뉴가 보인다', () => {
    renderLayout('본문 내용');

    const sidebar = screen.getByRole('navigation', { name: '주 메뉴' });

    expect(within(sidebar).getByRole('link', { name: '불량·원인코드' })).toHaveAttribute(
      'href',
      '/master-data/defect-cause-code',
    );
  });

  it('사이드바에 공통코드·조직·작업자 메뉴가 보인다', () => {
    renderLayout('본문 내용');

    const sidebar = screen.getByRole('navigation', { name: '주 메뉴' });

    expect(within(sidebar).getByRole('link', { name: '공통코드·조직·작업자' })).toHaveAttribute(
      'href',
      '/master-data/common-code',
    );
  });

  it('사이드바에 판정유형 코드 메뉴가 보인다', () => {
    renderLayout('본문 내용');

    const sidebar = screen.getByRole('navigation', { name: '주 메뉴' });

    expect(within(sidebar).getByRole('link', { name: '판정유형 코드' })).toHaveAttribute(
      'href',
      '/master-data/judgment-code',
    );
  });

  it('사이드바에 연계 동기화 현황 메뉴가 보인다', () => {
    renderLayout('본문 내용');

    const sidebar = screen.getByRole('navigation', { name: '주 메뉴' });

    expect(within(sidebar).getByRole('link', { name: '연계 동기화 현황' })).toHaveAttribute(
      'href',
      '/master-data/integration-sync',
    );
  });

  it('사이드바에 품목 확장속성 메뉴가 보인다', () => {
    renderLayout('본문 내용');

    const sidebar = screen.getByRole('navigation', { name: '주 메뉴' });

    expect(within(sidebar).getByRole('link', { name: '품목 확장속성' })).toHaveAttribute(
      'href',
      '/master-data/item-extended-attrs',
    );
  });

  it('사이드바에 마스터 변경관리 메뉴가 보인다', () => {
    renderLayout('본문 내용');

    const sidebar = screen.getByRole('navigation', { name: '주 메뉴' });

    expect(within(sidebar).getByRole('link', { name: '마스터 변경관리' })).toHaveAttribute(
      'href',
      '/master-data/master-change',
    );
  });

  /*
   * 현장 물류 화면이라 기준정보·시스템 관리 어느 쪽도 아니다 —
   * 도메인 01(자재창고)의 첫 화면이고 뒤따르는 W-01 화면들이 이 섹션에 들어온다.
   */
  it('사이드바에 자재창고 섹션의 입하 예정 조회 메뉴가 보인다', () => {
    renderLayout('본문 내용');

    const sidebar = screen.getByRole('navigation', { name: '주 메뉴' });

    expect(within(sidebar).getByText('자재창고')).toBeInTheDocument();
    expect(within(sidebar).getByRole('link', { name: '입하 예정 조회' })).toHaveAttribute(
      'href',
      '/logistics/inbound-schedule',
    );
  });

  /*
   * W-01-03 — 이 도메인의 **첫 쓰기 화면**이다. 조회 화면들과 같은 섹션·같은 앞머리를 쓰고,
   * 차례는 업무 순서(예정 → 도착 처리 → 재고)를 따른다.
   */
  it('사이드바 자재창고 섹션에 초과 입하 분리 메뉴가 있다', () => {
    renderLayout('본문 내용');

    const sidebar = screen.getByRole('navigation', { name: '주 메뉴' });

    expect(within(sidebar).getByRole('link', { name: '초과 입하 분리' })).toHaveAttribute(
      'href',
      '/logistics/over-receipt-split',
    );
  });

  /*
   * W-01-10 — 이 도메인의 **둘째 쓰기 화면**이다. 차례는 업무 순서를 따른다 —
   * 도착을 처리한 뒤(초과 입하 분리) 창고로 받아들이고(정상품 입하 처리) 재고에서 확인한다.
   */
  it('사이드바 자재창고 섹션에 정상품 입하 처리 메뉴가 있다', () => {
    renderLayout('본문 내용');

    const sidebar = screen.getByRole('navigation', { name: '주 메뉴' });

    expect(within(sidebar).getByRole('link', { name: '정상품 입하 처리' })).toHaveAttribute(
      'href',
      '/logistics/goods-receipt',
    );
  });

  /*
   * W-01-07은 같은 도메인이라 **섹션을 새로 만들지 않고** 「자재창고」에 항목만 더한다.
   * 계약 경로는 `/inventory/**`·`/trace/**`이지만 주소 앞머리는 **사이드바 섹션을 따른다** —
   * 한 섹션 안의 화면들이 서로 다른 앞머리를 가지면 섹션과 주소를 대응시킬 수 없다.
   */
  it('사이드바 자재창고 섹션에 재고 현황·상태 조회 메뉴가 함께 있다', () => {
    renderLayout('본문 내용');

    const sidebar = screen.getByRole('navigation', { name: '주 메뉴' });

    expect(within(sidebar).getByRole('link', { name: '재고 현황·상태 조회' })).toHaveAttribute(
      'href',
      '/logistics/stock-status',
    );
  });

  /*
   * W-01-04도 같은 「자재창고」 섹션에 항목만 더한다. **차례가 업무 순서다** — 재고를 확인한
   * 뒤(재고 현황·상태 조회) 장부와 실물을 맞춘다(재고실사). 계약 경로는 `/inventory/**`이지만
   * 주소 앞머리는 여기서도 **섹션을 따른다.**
   */
  it('사이드바 자재창고 섹션에 재고실사 메뉴가 함께 있다', () => {
    renderLayout('본문 내용');

    const sidebar = screen.getByRole('navigation', { name: '주 메뉴' });

    expect(within(sidebar).getByRole('link', { name: '재고실사' })).toHaveAttribute(
      'href',
      '/logistics/stocktaking',
    );
  });

  /*
   * **섹션이 새로 생기지 않았음**을 값으로 고정한다 — 항목이 늘어도 분류는 셋 그대로다.
   * 알려진 섹션 셋이 사이드바의 링크를 **빠짐없이** 담고 있는지로 판정한다. 넷째 섹션이
   * 생기면 그 안의 링크가 이 합집합 밖으로 나와 곧바로 걸린다.
   */
  it('사이드바 섹션이 셋 그대로이고 모든 항목이 그 안에 있다', () => {
    renderLayout('본문 내용');

    const sidebar = screen.getByRole('navigation', { name: '주 메뉴' });
    const sections = ['기준정보', '자재창고', '시스템 관리'].map(
      (label) => within(sidebar).getByText(label).parentElement,
    );

    const grouped = sections.flatMap((section) =>
      section === null ? [] : [...section.querySelectorAll('a')],
    );

    expect(grouped).toEqual(within(sidebar).getAllByRole('link'));
  });

  /*
   * 시스템 운영 화면이라 기준정보와 다른 섹션에 둔다 —
   * 같은 섹션에 넣으면 「창고·Location」 옆에 서서 분류가 무너진다.
   */
  it('사이드바에 시스템 관리 섹션의 사용자·역할·권한 메뉴가 보인다', () => {
    renderLayout('본문 내용');

    const sidebar = screen.getByRole('navigation', { name: '주 메뉴' });

    expect(within(sidebar).getByText('시스템 관리')).toBeInTheDocument();
    expect(within(sidebar).getByRole('link', { name: '사용자·역할·권한' })).toHaveAttribute(
      'href',
      '/system/users-roles',
    );
  });

  /* 새 섹션을 더하면서 기존 섹션의 구성이 흔들리지 않았는지 함께 본다. */
  it('기준정보 섹션의 항목 순서와 경로가 그대로다', () => {
    renderLayout('본문 내용');

    const sidebar = screen.getByRole('navigation', { name: '주 메뉴' });

    expect(
      within(sidebar)
        .getAllByRole('link')
        .map((link) => link.getAttribute('href')),
    ).toEqual([
      '/master-data/warehouse-location',
      '/master-data/routing',
      '/master-data/inspection-standard',
      '/master-data/defect-cause-code',
      '/master-data/common-code',
      '/master-data/judgment-code',
      '/master-data/integration-sync',
      '/master-data/item-extended-attrs',
      '/master-data/master-change',
      '/logistics/inbound-schedule',
      '/logistics/over-receipt-split',
      '/logistics/goods-receipt',
      '/logistics/stock-status',
      '/logistics/stocktaking',
      '/system/users-roles',
    ]);
  });

  it('본문 랜드마크가 자식 내용을 담는다', () => {
    renderLayout('본문 내용');

    expect(within(screen.getByRole('main')).getByText('본문 내용')).toBeInTheDocument();
  });

  it('상단바에 브랜드가 보인다', () => {
    renderLayout('본문 내용');

    expect(within(screen.getByRole('banner')).getByText('OMF-MES 관리웹')).toBeInTheDocument();
  });
});
