import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { SessionProvider, useSession, type Session } from '../patterns/session';
import { AppLayout } from './layout';

/** 합성값이다 — 계약의 예시값(`1001`·`hong.gd`·`홍길동`)을 쓰지 않는다(공개 저장소 경계). */
const SYNTHETIC_USER_NAME = '합성 사용자 가';

const sessionFixture = (): Session => ({
  userId: 8101,
  loginId: 'SYN-LOGIN-01',
  userName: SYNTHETIC_USER_NAME,
  scopes: [{ businessUnitId: 8301, plantId: 8401 }],
});

/**
 * 화면이 로그인에 성공했을 때 하는 일을 흉내 낸다. **자동으로 돌지 않고 눌러서 돈다** —
 * 「세션이 없을 때」와 「있을 때」를 같은 렌더에서 앞뒤로 잴 수 있게 시점을 시험이 정한다.
 */
const SignInProbe = () => {
  const { signIn } = useSession();

  return (
    <button
      type="button"
      onClick={() => {
        signIn(sessionFixture());
      }}
    >
      세션 담기
    </button>
  );
};

/**
 * 셸은 이제 세션을 읽으므로 **프로바이더 없이는 서지 않는다**(`useSession`이 던진다).
 * 앱에서도 `app/providers.tsx`가 같은 자리에 이 프로바이더를 둔다.
 */
const renderLayout = (children: string) => {
  const user = userEvent.setup();
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: (
          <SessionProvider>
            <SignInProbe />
            <AppLayout>{children}</AppLayout>
          </SessionProvider>
        ),
      },
    ],
    { initialEntries: ['/'] },
  );

  render(<RouterProvider router={router} />);

  return { user };
};

const topbar = (): HTMLElement => screen.getByRole('banner');

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

  /*
   * **W-06-14 · C5-2** — 같은 「기준정보」 섹션의 **창고·Location 바로 뒤**다. 적치 규칙은
   * 창고와 위치를 참조해야 성립하고 그 마스터에서 이어지는 화면이라, **인접이 관계를 드러낸다.**
   *
   * **앞뒤를 둘 다 잰다** — 창고·Location 다음 칸이면서 Routing(공정)보다 앞이다. 한쪽만
   * 재면 반대편으로 밀려나도 통과한다(맨 뒤로 밀리면 창고와의 관계가 자리에서 읽히지 않는다).
   */
  it('사이드바 기준정보 섹션에 적치 규칙 메뉴가 창고·Location 바로 뒤에 있다', () => {
    renderLayout('본문 내용');

    const sidebar = screen.getByRole('navigation', { name: '주 메뉴' });
    const links = within(sidebar)
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'));

    expect(within(sidebar).getByRole('link', { name: '적치 규칙' })).toHaveAttribute(
      'href',
      '/master-data/putaway-rule',
    );
    expect(links.indexOf('/master-data/putaway-rule')).toBe(
      links.indexOf('/master-data/warehouse-location') + 1,
    );
    expect(links.indexOf('/master-data/putaway-rule')).toBeLessThan(
      links.indexOf('/master-data/routing'),
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
   * **W-01-12 · C46 · D-19** — 같은 「자재창고」 섹션의 **재고실사 바로 뒤**다. 차례가 업무
   * 순서다: 재고를 확인하고(재고 현황) 장부와 실물을 맞춘 뒤(재고실사) **어긋난 것을 고친다.**
   *
   * **앞뒤를 둘 다 잰다** — 실사 다음 칸이면서 반품보다 앞이다. 한쪽만 재면 반대편으로 밀려나도
   * 통과한다(반품·폐기는 물건을 내보내는 일이라 장부를 맞추는 이 화면보다 뒤여야 한다).
   *
   * **W-01-11과 갈리는 자리다** — 그 화면은 맥락 없는 진입이 요구사항 위반이라 메뉴에 두지
   * 않았는데, 이 화면은 직접 등록이 정상 경로라 메뉴에 선다.
   */
  it('사이드바 자재창고 섹션에 재고조정 메뉴가 재고실사 바로 뒤에 있다', () => {
    renderLayout('본문 내용');

    const sidebar = screen.getByRole('navigation', { name: '주 메뉴' });
    const links = within(sidebar)
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'));

    expect(within(sidebar).getByRole('link', { name: '재고조정' })).toHaveAttribute(
      'href',
      '/logistics/stock-adjust',
    );
    expect(links.indexOf('/logistics/stock-adjust')).toBe(
      links.indexOf('/logistics/stocktaking') + 1,
    );
    expect(links.indexOf('/logistics/stock-adjust')).toBeLessThan(
      links.indexOf('/logistics/supplier-return'),
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
   * W-01-06도 같은 「자재창고」 섹션에 항목만 더한다. **차례가 업무 순서다** — 되돌려 보낸
   * 뒤(반품) 못 쓰게 된 것을 **장부에서 덜어낸다**(폐기). 반품과 같은 계약 경로를 쓰지만
   * 주소는 **화면**을 가리킨다.
   */
  it('사이드바 자재창고 섹션에 폐기 품의·기타출고 메뉴가 공급사 반품 처리 뒤에 있다', () => {
    renderLayout('본문 내용');

    const sidebar = screen.getByRole('navigation', { name: '주 메뉴' });
    const links = within(sidebar)
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'));

    expect(within(sidebar).getByRole('link', { name: '폐기 품의·기타출고' })).toHaveAttribute(
      'href',
      '/logistics/disposal-issue',
    );
    expect(links.indexOf('/logistics/disposal-issue')).toBe(
      links.indexOf('/logistics/supplier-return') + 1,
    );
  });

  /*
   * W-01-02도 같은 「자재창고」 섹션에 항목만 더한다. 계약 경로는 결재함과 같은 `/app/**`
   * 인데 주소 앞머리는 여기서도 **섹션을 따른다** — 판정하는 것이 자재 입하 검사의 생략이라
   * 그 판단의 맥락(입하·재고·입고)이 이 섹션에 있다.
   *
   * **물건이 오가는 항목들 뒤다.** 앞의 것들이 오가는 순서이고 이것은 그 흐름 위에서
   * 예외를 허가하는 일이라, 순서 사이에 끼워 넣을 자리가 없다.
   *
   * ⚠ **더는 섹션의 끝이 아니다**(W-01-13이 뒤에 섰다). 이 시험이 재는 것은 처음부터 「끝」이
   * 아니라 **폐기 바로 뒤 · 「승인」 섹션보다 앞**이었으므로 단언은 그대로 두고 이름만 사실로 고친다.
   */
  it('사이드바 자재창고 섹션에 긴급 IQC 생략 한도승인 메뉴가 폐기 품의·기타출고 뒤에 있다', () => {
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
      links.indexOf('/logistics/disposal-issue') + 1,
    );
    /* 「승인」 섹션이 아니다 — 결재함과 같은 자리에 서면 두 화면의 축이 흐려진다. */
    expect(links.indexOf('/logistics/iqc-skip-approval')).toBeLessThan(
      links.indexOf('/approval/inbox'),
    );
  });

  /*
   * **W-01-13 · C5-2** — 같은 「자재창고」 섹션의 **맨 뒤**다. 앞의 여덟이 물건이 오가는 순서이고
   * (예정 → 초과 분리 → 입고 → 재고 확인 → 실사 → 조정 → 반품 → 폐기) 「긴급 IQC 생략」이 그
   * 흐름 위에서 예외를 허가하는 자리인데, 이 화면은 그 흐름이 **남긴 문서들을 가로질러 보고
   * 되돌리는** 일이라 순서에 끼워 넣을 자리가 없다. 기준정보의 「마스터 변경관리」가 같은
   * 이유(횡단 조회)로 마스터 항목들 뒤에 섰다.
   *
   * **앞뒤를 둘 다 잰다** — 긴급 IQC 생략 다음 칸이면서 「승인」 섹션의 결재함보다 앞이다.
   * 한쪽만 재면 반대편으로 밀려나도 통과한다: 앞으로 밀리면 업무 순서 사슬을 끊고, 뒤로 밀리면
   * 섹션을 넘어가 **자재창고 항목이 아니게 된다.**
   *
   * ⛔ **「승인」 섹션에 두지 않는다.** 취소가 승인을 타지만 이 화면이 하는 일은 결재가 아니라
   * **상신과 실행**이다 — W-01-02가 같은 자리에서 같은 판정을 했다.
   */
  it('사이드바 자재창고 섹션의 맨 뒤에 물류 문서 진행현황·취소 메뉴가 있다', () => {
    renderLayout('본문 내용');

    const sidebar = screen.getByRole('navigation', { name: '주 메뉴' });
    const links = within(sidebar)
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'));

    expect(within(sidebar).getByRole('link', { name: '물류 문서 진행현황·취소' })).toHaveAttribute(
      'href',
      '/logistics/document-progress',
    );
    expect(links.indexOf('/logistics/document-progress')).toBe(
      links.indexOf('/logistics/iqc-skip-approval') + 1,
    );
    expect(links.indexOf('/logistics/document-progress')).toBeLessThan(
      links.indexOf('/approval/inbox'),
    );
  });

  it('품질관리 섹션의 공개 화면이 W-03-01 < W-03-02 < W-03-03 < W-03-05 < W-03-09 순서다', () => {
    renderLayout('본문 내용');

    const sidebar = screen.getByRole('navigation', { name: '주 메뉴' });
    const links = within(sidebar)
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'));

    expect(within(sidebar).getByText('품질관리')).toBeInTheDocument();
    expect(
      within(sidebar).getByRole('link', { name: 'Lot Status 현황·변경이력 조회' }),
    ).toHaveAttribute('href', '/quality/lot-status');
    expect(
      within(sidebar).getByRole('link', { name: 'Lot Status 판정·전이 처리' }),
    ).toHaveAttribute('href', '/quality/lot-status-transition');
    expect(within(sidebar).getByRole('link', { name: '의심자재 등록' })).toHaveAttribute(
      'href',
      '/quality/suspicious-material-hold',
    );
    expect(within(sidebar).getByRole('link', { name: '검사실적·검사결과 조회' })).toHaveAttribute(
      'href',
      '/quality/inspection-results',
    );
    expect(within(sidebar).getByRole('link', { name: '특채·한도승인 승인 처리' })).toHaveAttribute(
      'href',
      '/quality/approvals',
    );
    expect(links.indexOf('/quality/lot-status')).toBeGreaterThan(
      links.indexOf('/production/work-order-close'),
    );
    expect(links.indexOf('/quality/lot-status-transition')).toBeGreaterThan(
      links.indexOf('/quality/lot-status'),
    );
    expect(links.indexOf('/quality/suspicious-material-hold')).toBeGreaterThan(
      links.indexOf('/quality/lot-status-transition'),
    );
    expect(links.indexOf('/quality/inspection-results')).toBeGreaterThan(
      links.indexOf('/quality/suspicious-material-hold'),
    );
    expect(links.indexOf('/quality/approvals')).toBeGreaterThan(
      links.indexOf('/quality/inspection-results'),
    );
    expect(within(sidebar).getByRole('link', { name: '처분 판정 처리' })).toHaveAttribute(
      'href',
      '/quality/dispositions',
    );
    expect(links.indexOf('/quality/dispositions')).toBeGreaterThan(
      links.indexOf('/quality/approvals'),
    );
    expect(links.indexOf('/quality/approvals')).toBeLessThan(links.indexOf('/approval/inbox'));
  });

  it('출하 섹션(출하지시서 Import·작업지시 생성 · 출하 예정 목록 · 출하 처리)이 자재창고 뒤·생산 앞에 있다', () => {
    renderLayout('본문 내용');

    const sidebar = screen.getByRole('navigation', { name: '주 메뉴' });
    const links = within(sidebar)
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'));

    expect(within(sidebar).getByText('출하')).toBeInTheDocument();
    expect(
      within(sidebar).getByRole('link', { name: '출하지시서 Import·작업지시 생성' }),
    ).toHaveAttribute('href', '/shipment/shipment-request-create');
    expect(within(sidebar).getByRole('link', { name: '출하 예정 목록' })).toHaveAttribute(
      'href',
      '/shipment/shipment-schedule',
    );
    expect(
      within(sidebar).getByRole('link', { name: '출하 처리(상차·실물 출고)' }),
    ).toHaveAttribute('href', '/shipment/shipment-processing');
    /* 편성이 예정보다 먼저다 — 지시서를 편성해야 예정이 생긴다(업무 순서). */
    expect(links.indexOf('/shipment/shipment-request-create')).toBe(
      links.indexOf('/logistics/document-progress') + 1,
    );
    expect(links.indexOf('/shipment/shipment-schedule')).toBe(
      links.indexOf('/shipment/shipment-request-create') + 1,
    );
    /* 예정 목록에서 피킹까지 끝난 후보를 처리하므로 그 바로 뒤다(업무 순서). */
    expect(links.indexOf('/shipment/shipment-processing')).toBe(
      links.indexOf('/shipment/shipment-schedule') + 1,
    );
    expect(links.indexOf('/shipment/shipment-processing')).toBeLessThan(
      links.indexOf('/production/work-order-close'),
    );
  });

  it('생산 섹션의 P/O 조회·전개·4M 배정·배포·W/O 마감이 업무 순서대로 있다', () => {
    renderLayout('본문 내용');

    const sidebar = screen.getByRole('navigation', { name: '주 메뉴' });
    const links = within(sidebar)
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'));

    expect(within(sidebar).getByText('생산')).toBeInTheDocument();
    expect(within(sidebar).getByRole('link', { name: 'P/O 수신·조회' })).toHaveAttribute(
      'href',
      '/production/production-orders',
    );
    expect(within(sidebar).getByRole('link', { name: 'W/O 전개·편성' })).toHaveAttribute(
      'href',
      '/production/production-plans',
    );
    expect(within(sidebar).getByRole('link', { name: '4M 자원배정·유효성 점검' })).toHaveAttribute(
      'href',
      '/production/work-order-assignments',
    );
    expect(
      within(sidebar).getByRole('link', { name: 'W/O 확정·배포·생산LOT 선발행' }),
    ).toHaveAttribute('href', '/production/work-order-release');
    expect(within(sidebar).getByRole('link', { name: 'W/O 마감·ERP 실적 송신' })).toHaveAttribute(
      'href',
      '/production/work-order-close',
    );
    expect(within(sidebar).getByRole('link', { name: '긴급 W/O 발행' })).toHaveAttribute(
      'href',
      '/production/emergency-work-orders',
    );
    expect(within(sidebar).getByRole('link', { name: 'W/O 진행현황 조회' })).toHaveAttribute(
      'href',
      '/production/work-order-progress',
    );
    expect(links.indexOf('/production/production-orders')).toBe(
      links.indexOf('/shipment/shipment-processing') + 1,
    );
    expect(links.indexOf('/production/production-plans')).toBe(
      links.indexOf('/production/production-orders') + 1,
    );
    expect(links.indexOf('/production/work-order-assignments')).toBe(
      links.indexOf('/production/production-plans') + 1,
    );
    expect(links.indexOf('/production/work-order-release')).toBe(
      links.indexOf('/production/work-order-assignments') + 1,
    );
    expect(links.indexOf('/production/work-order-close')).toBe(
      links.indexOf('/production/work-order-release') + 1,
    );
    expect(links.indexOf('/production/work-order-close')).toBeLessThan(
      links.indexOf('/quality/lot-status'),
    );
  });

  /*
   * **알려진 섹션이 사이드바의 링크를 빠짐없이 담는다**를 값으로 고정한다. 섹션이 하나 더
   * 생기면 그 안의 링크가 이 합집합 밖으로 나와 곧바로 걸린다 — 분류를 늘리는 일은
   * 화면 하나를 더하는 일과 무게가 다르므로 **말없이 지나가지 않게** 한다.
   *
   * W-03-01이 Lot Status 계열의 첫 화면으로 「품질관리」를 열어 이제 여섯이다. 결재함은
   * 기준정보(무엇을 정해 두는가)도 자재창고(물건이 오가는 일)도 시스템 관리(운영 설정)도
   * 아닌, **올라온 결재를 처리하는 일**이라 기존 「승인」 섹션에 그대로 남는다.
   *
   * W-04-02가 출하(도메인 04)의 첫 화면으로 「출하」를 열어 이제 아홉이다.
   *
   * ⭐ **섹션 밖에 서는 항목이 하나 생겼다** — W-CO-05 통합 대시보드다. 그 화면은 어느 업무
   * 묶음에도 속하지 않고 **모든 묶음의 숫자를 모아** 보이므로, 어느 섹션에 넣어도 그 섹션의
   * 분류가 무너진다. 항목 하나짜리 섹션을 만들면 제목이 항목보다 무거워진다.
   *
   * ⚠ **그래서 이 감지기는 「전부 섹션 안」이 아니라 「섹션 밖은 이것 하나」를 잰다.**
   * 느슨해진 것이 아니다 — 섹션 밖에 항목이 하나 더 늘면 그때도 여기서 걸린다.
   */
  const UNSECTIONED_LINKS = ['/dashboard'];

  it('사이드바 섹션이 아홉이고 섹션 밖 항목은 통합 대시보드 하나다', () => {
    renderLayout('본문 내용');

    const sidebar = screen.getByRole('navigation', { name: '주 메뉴' });
    const sections = [
      '기준정보',
      '자재창고',
      '출하',
      '생산',
      '품질관리',
      '설비/툴',
      '승인',
      '알림',
      '시스템 관리',
    ].map((label) => within(sidebar).getByText(label).parentElement);

    const grouped = sections.flatMap((section) =>
      section === null ? [] : [...section.querySelectorAll('a')],
    );
    const all = within(sidebar).getAllByRole('link');
    const ungrouped = all.filter((link) => !grouped.some((anchor) => anchor === link));

    expect(ungrouped.map((link) => link.getAttribute('href'))).toEqual(UNSECTIONED_LINKS);
    expect(grouped.length + ungrouped.length).toBe(all.length);
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
   * ⛔ **이 항목은 「관리자 화면」이 아니다.** 앞의 둘은 관리자가 남을 설정하는 자리이고 이것은
   * 누구나 자기 것을 바꾸는 자리라 **섹션 맨 끝**에 붙인다 — 앞의 순서(권한 → 결재선)를 흔들지
   * 않기 위해서이기도 하다. 메뉴 권한이 붙는 날 **감추면 안 되는 항목**임을 코드 주석과
   * `docs/decisions.md`가 함께 적는다.
   */
  it('사이드바에 시스템 관리 섹션의 비밀번호 변경 메뉴가 맨 끝에 보인다', () => {
    renderLayout('본문 내용');

    const sidebar = screen.getByRole('navigation', { name: '주 메뉴' });
    const links = within(sidebar)
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'));

    expect(within(sidebar).getByRole('link', { name: '비밀번호 변경' })).toHaveAttribute(
      'href',
      '/system/password-change',
    );
    /*
     * ⭐ 견주는 것은 **맨 끝인가**이지 「결재선 다음인가」가 아니다. 관리자 설정 항목은 앞으로도
     * 더 붙으므로, 인접으로 못 박으면 항목이 늘 때마다 뜻과 무관하게 시험이 깨진다.
     */
    expect(links.indexOf('/system/password-change')).toBeGreaterThan(
      links.indexOf('/system/approval-route'),
    );
    expect(links.indexOf('/system/password-change')).toBe(links.length - 1);
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

  /*
   * 새 섹션·새 항목을 더하면서 기존 구성이 흔들리지 않았는지 함께 본다.
   *
   * ⚠ **이 감지기는 기준정보만 재지 않는다 — 사이드바 전체의 차례를 잰다.** 이름이
   * 「기준정보 섹션」이던 동안 다른 섹션에 항목을 더한 회차가 이 감지기를 갱신하지 않고
   * 지나가 `main` 이 붉은 채로 남았다. 어느 섹션에 무엇을 더하든 여기를 함께 고친다.
   */
  it('사이드바 전체의 항목 순서와 경로가 그대로다', () => {
    renderLayout('본문 내용');

    const sidebar = screen.getByRole('navigation', { name: '주 메뉴' });

    expect(
      within(sidebar)
        .getAllByRole('link')
        .map((link) => link.getAttribute('href')),
    ).toEqual([
      /* W-CO-05 — 섹션 밖 맨 위. 로그인 직후 첫 화면이라 모든 묶음 위에 선다. */
      '/dashboard',
      '/master-data/warehouse-location',
      '/master-data/putaway-rule',
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
      '/logistics/iqc-inspection',
      '/logistics/goods-receipt',
      '/logistics/stock-status',
      '/logistics/stocktaking',
      '/logistics/stock-adjust',
      '/logistics/supplier-return',
      '/logistics/disposal-issue',
      '/logistics/iqc-skip-approval',
      '/logistics/document-progress',
      '/shipment/shipment-request-create',
      '/shipment/shipment-schedule',
      '/shipment/shipment-processing',
      '/production/production-orders',
      '/production/production-plans',
      '/production/work-order-assignments',
      '/production/work-order-release',
      '/production/work-order-close',
      '/production/emergency-work-orders',
      '/production/work-order-progress',
      '/quality/lot-status',
      '/quality/lot-status-transition',
      '/quality/suspicious-material-hold',
      '/quality/inspection-results',
      '/quality/approvals',
      '/quality/dispositions',
      '/equipment/master',
      '/equipment/tool-master',
      '/equipment/work-calendar',
      '/equipment/collection-channels',
      '/equipment/shot-conversion',
      '/equipment/gauge-master',
      '/equipment/gauge-calibration',
      '/equipment/failures',
      '/equipment/maintenance-orders',
      '/equipment/maintenance-results',
      '/equipment/tool-pm-order',
      '/equipment/tool-pm-result',
      '/equipment/downtime-summary',
      '/approval/inbox',
      '/notification/center',
      '/system/users-roles',
      '/system/approval-route',
      '/system/terminal-process-map',
      '/system/password-change',
    ]);
  });

  /**
   * W-CO-03 — **알림은 자기 섹션을 갖는다**(설계 IA). 「시스템 관리」에 넣으면 **관리자가
   * 남을 설정하는 자리**에 **누구나 자기 것을 보는 화면**이 섞인다.
   */
  it('사이드바에 알림 섹션의 알림센터 메뉴가 승인 뒤·시스템 관리 앞에 있다', () => {
    renderLayout('본문 내용');

    const sidebar = screen.getByRole('navigation', { name: '주 메뉴' });

    expect(within(sidebar).getByText('알림')).toBeInTheDocument();

    const item = within(sidebar).getByRole('link', { name: /알림센터/ });
    expect(item).toHaveAttribute('href', '/notification/center');

    /* 전체 차례는 업무 도메인 → 승인 → 알림 → 시스템 관리까지 이어진다. */
    const labels = [
      '기준정보',
      '자재창고',
      '생산',
      '품질관리',
      '설비/툴',
      '승인',
      '알림',
      '시스템 관리',
    ].map((label) => within(sidebar).getByText(label));
    const ordered = [...labels].sort((left, right) =>
      left.compareDocumentPosition(right) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
    );

    expect(ordered).toEqual(labels);
  });

  /**
   * ⛔ **상단 바에 종 배지를 만들지 않는다**(결정 ②). 이 파일은 지금 **요청이 하나도 없고**,
   * 조회를 처음 들이면 모든 화면이 라우트 전환마다 그것을 지며 미인증 실패가 전 화면의
   * 상단 바에 나타난다.
   */
  it('상단 바에 안 읽은 알림 수 표시를 두지 않는다', () => {
    renderLayout('본문 내용');

    /* 짝 양성 — 상단 바는 실제로 서 있고 브랜드를 담는다. */
    expect(within(topbar()).getByText('OMF-MES 관리웹')).toBeInTheDocument();
    expect(within(topbar()).queryByRole('link', { name: /알림/ })).not.toBeInTheDocument();
    expect(within(topbar()).queryByRole('status')).not.toBeInTheDocument();
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

describe('AppLayout — 로그인 사용자 표시', () => {
  /**
   * ⛔ **모르는 값과 없는 값을 같은 모양으로 그리지 않는다**(공유계약 G-9). 세션이 없을 때
   * 「알 수 없음」·「게스트」류의 글자를 두면 **로그인한 것처럼** 읽힌다 — 지금은 미인증 접근을
   * 막는 장치가 없어 **비어 있는 것이 정상 상태**다.
   *
   * 음성 단언이라 **상단 바를 잡은 뒤**에 잰다.
   */
  it('세션이 없으면 이름 자리가 비어 있다', () => {
    renderLayout('본문 내용');

    /* 짝 양성 — 상단 바는 실제로 그려졌다. */
    expect(within(topbar()).getByText('OMF-MES 관리웹')).toBeInTheDocument();

    expect(within(topbar()).queryByText(SYNTHETIC_USER_NAME)).not.toBeInTheDocument();
    expect(within(topbar()).queryByText(/알 수 없음|게스트|미로그인/)).not.toBeInTheDocument();
  });

  it('세션이 있으면 상단 바에 사용자 이름이 보인다', async () => {
    const { user } = renderLayout('본문 내용');

    await user.click(screen.getByRole('button', { name: '세션 담기' }));

    expect(within(topbar()).getByText(SYNTHETIC_USER_NAME)).toBeInTheDocument();
  });

  /**
   * ⭐ **「비운다」는 「빈 요소를 둔다」가 아니라 「요소를 두지 않는다」이다.**
   *
   * 글자만 재면 빈 요소가 그대로 통과한다. 눈에는 안 보이지만 디자인 시스템이 액션 슬롯에
   * 간격·정렬을 주면 **보이지 않는 여백**이 생기고, 그것은 육안 확인으로도 잡기 어렵다.
   * T3의 「빈 줄도 「말한 것」이 된다」와 같은 계열이다.
   *
   * 요소가 **로그인 뒤에야 생긴다**는 것을 세어서 잰다 — 디자인 시스템의 내부 클래스 이름을
   * 겨냥하지 않으려고 자식 수를 쓴다. 그 이름은 버전이 바뀌면 조용히 어긋난다.
   */
  it('세션이 없으면 이름 자리의 요소 자체가 없다', async () => {
    const { user } = renderLayout('본문 내용');

    const before = topbar().childElementCount;

    await user.click(screen.getByRole('button', { name: '세션 담기' }));

    /* 짝 양성 — 이름이 실제로 섰다. */
    expect(within(topbar()).getByText(SYNTHETIC_USER_NAME)).toBeInTheDocument();

    expect(topbar().childElementCount).toBe(before + 1);
  });

  /**
   * ⛔ **귀속(사업부·공장)은 그리지 않는다.** 계약이 정수 ID만 주고 이름을 주지 않아, 사람이
   * 읽을 값을 만들려면 셸이 기준정보 조회를 지게 된다 — 미인증 상태에서도 도는 조회가 셸에
   * 생기고 셸이 기준정보 계약에 묶인다. 값 자체는 세션에 그대로 실려 있다.
   */
  it('상단 바에 내부 번호가 나오지 않는다', async () => {
    const { user } = renderLayout('본문 내용');

    await user.click(screen.getByRole('button', { name: '세션 담기' }));

    expect(within(topbar()).getByText(SYNTHETIC_USER_NAME)).toBeInTheDocument();

    for (const internalId of ['8101', '8201', '8301', '8401']) {
      expect(topbar().textContent).not.toContain(internalId);
    }
  });
});
