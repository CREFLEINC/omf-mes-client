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
      links.indexOf('/logistics/disposal-issue') + 1,
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
    expect(links.indexOf('/system/password-change')).toBe(
      links.indexOf('/system/approval-route') + 1,
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
      '/logistics/stock-adjust',
      '/logistics/supplier-return',
      '/logistics/disposal-issue',
      '/logistics/iqc-skip-approval',
      '/approval/inbox',
      '/system/users-roles',
      '/system/approval-route',
      '/system/password-change',
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
