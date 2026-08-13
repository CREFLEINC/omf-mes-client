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
   * W-01-05도 같은 「자재창고」 섹션에 항목만 더한다. **차례가 업무 순서다** — 실사로 장부와
   * 실물을 맞춘 뒤 **되돌려 보낸다.** 반품은 앞의 다섯이 남긴 결과를 대상으로 삼는다.
   */
  it('사이드바 자재창고 섹션에 공급사 반품 처리 메뉴가 함께 있다', () => {
    renderLayout('본문 내용');

    const sidebar = screen.getByRole('navigation', { name: '주 메뉴' });

    expect(within(sidebar).getByRole('link', { name: '공급사 반품 처리' })).toHaveAttribute(
      'href',
      '/logistics/supplier-return',
    );
  });

  /*
   * W-01-02도 같은 「자재창고」 섹션에 항목만 더한다. 계약 경로는 결재함과 같은 `/app/**`
   * 인데 주소 앞머리는 여기서도 **섹션을 따른다** — 판정하는 것이 자재 입하 검사의 생략이라
   * 그 판단의 맥락(입하·재고·입고)이 이 섹션에 있다.
   *
   * **기존 여섯 항목 뒤다.** 앞의 여섯이 물건이 오가는 순서이고 이것은 그 흐름 위에서
   * 예외를 허가하는 일이라, 순서 사이에 끼워 넣을 자리가 없다.
   */
  it('사이드바 자재창고 섹션의 끝에 긴급 IQC 생략 한도승인 메뉴가 있다', () => {
    renderLayout('본문 내용');

    const sidebar = screen.getByRole('navigation', { name: '주 메뉴' });
    const links = within(sidebar)
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'));

    expect(within(sidebar).getByRole('link', { name: '긴급 IQC 생략 한도승인' })).toHaveAttribute(
      'href',
      '/logistics/iqc-skip-approval',
    );
    expect(links.indexOf('/logistics/iqc-skip-approval')).toBe(
      links.indexOf('/logistics/supplier-return') + 1,
    );
    /* 「승인」 섹션이 아니다 — 결재함과 같은 자리에 서면 두 화면의 축이 흐려진다. */
    expect(links.indexOf('/logistics/iqc-skip-approval')).toBeLessThan(
      links.indexOf('/approval/inbox'),
    );
  });

  /*
   * **알려진 섹션이 사이드바의 링크를 빠짐없이 담는다**를 값으로 고정한다. 섹션이 하나 더
   * 생기면 그 안의 링크가 이 합집합 밖으로 나와 곧바로 걸린다 — 분류를 늘리는 일은
   * 화면 하나를 더하는 일과 무게가 다르므로 **말없이 지나가지 않게** 한다.
   *
   * **넷이 된 것은 W-CO-09에서다.** 결재함은 기준정보(무엇을 정해 두는가)도 자재창고
   * (물건이 오가는 일)도 시스템 관리(운영 설정)도 아닌, **올라온 결재를 처리하는 일**이다.
   */
  it('사이드바 섹션이 넷이고 모든 항목이 그 안에 있다', () => {
    renderLayout('본문 내용');

    const sidebar = screen.getByRole('navigation', { name: '주 메뉴' });
    const sections = ['기준정보', '자재창고', '승인', '시스템 관리'].map(
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

  /**
   * **차례가 순서다** — 승인자를 정할 수 있게 된 다음에 결재선을 세운다.
   * 결재선은 마스터이지만 창고·품목 같은 업무 기준정보가 아니라 운영 설정이라 이 섹션에 든다.
   */
  it('사이드바에 시스템 관리 섹션의 결재선 정의 메뉴가 사용자·역할·권한 뒤에 보인다', () => {
    renderLayout('본문 내용');

    const sidebar = screen.getByRole('navigation', { name: '주 메뉴' });
    const links = within(sidebar)
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'));

    expect(within(sidebar).getByRole('link', { name: '결재선 정의' })).toHaveAttribute(
      'href',
      '/system/approval-route',
    );
    expect(links.indexOf('/system/approval-route')).toBe(links.indexOf('/system/users-roles') + 1);
  });

  /**
   * **결재함은 자기 섹션을 갖는다** — 기준정보도 시스템 운영도 아니라 일하는 자리다.
   * 결재선 정의(운영 설정)와 같은 섹션에 넣으면 「설정하는 화면」과 「일하는 화면」이 섞인다.
   */
  it('사이드바에 승인 섹션의 결재함 메뉴가 시스템 관리 앞에 보인다', () => {
    renderLayout('본문 내용');

    const sidebar = screen.getByRole('navigation', { name: '주 메뉴' });
    const links = within(sidebar)
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'));

    expect(within(sidebar).getByText('승인')).toBeInTheDocument();
    expect(within(sidebar).getByRole('link', { name: '결재함' })).toHaveAttribute(
      'href',
      '/approval/inbox',
    );
    expect(links.indexOf('/approval/inbox')).toBeLessThan(links.indexOf('/system/users-roles'));
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
      '/logistics/supplier-return',
      '/logistics/iqc-skip-approval',
      '/approval/inbox',
      '/system/users-roles',
      '/system/approval-route',
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
