import { messages } from '@omf-mes/i18n';
import { screen, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SessionProvider, useSession, type Session } from '../patterns/session';
import { renderWithProviders } from '../test/api-harness';
import { expandAllNavGroups } from '../test/nav-groups';
import { AppLayout } from './layout';

/** 합성값이다 — 계약의 예시값(`1001`·`hong.gd`·`홍길동`)을 쓰지 않는다(공개 저장소 경계). */
const SYNTHETIC_USER_NAME = '합성 사용자 가';

const sessionFixture = (): Session => ({
  userId: 8101,
  loginId: 'SYN-LOGIN-01',
  userName: SYNTHETIC_USER_NAME,
  scopes: [{ businessUnitId: 8301, plantId: 8401 }],
  /*
   * ⚠ **계약이 이 칸을 필수로 바꿨다**(전달본 2026-09-17 · `Session.mustChangePassword`).
   *   스텁이 서버보다 너그러우면 화면의 결손을 덮으므로 함께 싣는다. 임시 비밀번호로 들어온
   *   회차가 아니므로 `false` 다 — 아직 이 값으로 갈래를 만드는 제품 코드는 없다.
   */
  mustChangePassword: false,
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
 *
 * ⭐ **로그인하지 않은 상태로 시작한다.** 세션은 이제 서버에 물어봐야 아는 값이라(#1019)
 * 그 답을 시험이 쥔다 — 「없을 때」에서 시작해 [세션 담기]로 「있을 때」로 넘어가야
 * 상단 바의 두 모양을 한 회차에서 앞뒤로 잴 수 있다.
 */
/**
 * ⚠ **기본으로 묶음을 전부 펼친다**(#1079). 앱은 **현재 묶음만 펼친 채** 서지만, 이 파일의
 * 감지기 30건은 항목이 DOM 에 있어야 하는 것들이고 그 30건이 재려는 것은 **차례와 경로**이지
 * 접힘이 아니다. 펼치는 일을 감지기마다 되풀이하면 30곳에서 같은 준비를 적게 되고, 그중 하나를
 * 빠뜨리면 「항목이 없다」가 **접혀 있어서인지 빠져서인지** 구별되지 않는다.
 *
 * ⛔ **그래서 접힘의 기본값은 이 하네스로 덮인다 — 그 자리를 따로 재는 감지기가 반드시 있어야
 * 한다.** `expandGroups: false` 로 부르는 「셸 — 묶음 접기」 감지기들이 그 몫이다. 그 감지기를
 * 지우면 앱이 전부 펼친 채로 돌아가도 이 파일은 초록이다.
 */
const renderLayout = (
  children: string,
  options: { expandGroups?: boolean; route?: string } = {},
) => {
  const user = userEvent.setup();

  renderWithProviders(
    <SessionProvider>
      <SignInProbe />
      <AppLayout>{children}</AppLayout>
    </SessionProvider>,
    { session: null, ...(options.route === undefined ? {} : { route: options.route }) },
  );

  if (options.expandGroups !== false) expandAllNavGroups();

  return { user };
};

const topbar = (): HTMLElement => screen.getByRole('banner');

const navSidebar = (): HTMLElement => screen.getByRole('navigation', { name: '주 메뉴' });

/**
 * 묶음 손잡이를 **접근명의 앞머리**로 찾는다. 접근명이 「<이름> 펼치기 (화면 N개)」·「<이름>
 * 접기 (화면 N개)」로 상태와 개수를 함께 담으므로 완전 일치로는 집을 수 없고, 개수를 시험이
 * 되풀이하면 항목이 하나 늘 때마다 여기도 고쳐야 한다.
 */
/**
 * 묶음 손잡이를 **이름 앞머리**로 찾는다.
 *
 * ⚠ **개수까지 맞추지 않는다.** 접근명이 「<이름> (화면 N개)」이고 그 N 은 **지금 안에 든 수**라
 * 검색 중에는 걸린 항목 수로 줄어든다(그게 옳다 — 접힌 묶음을 열지 말지 판단할 값은 지금 든 수다).
 * 개수를 시험이 되풀어 적으면 검색 감지기가 그 자리에서 깨진다.
 */
const groupToggle = (label: string): HTMLElement => {
  const found = within(navSidebar())
    .getAllByRole('button')
    .find((button) => (button.getAttribute('aria-label') ?? '').startsWith(`${label} (`));

  if (found === undefined) throw new Error(`「${label}」 묶음의 손잡이를 찾지 못했습니다`);

  return found;
};

describe('AppLayout', () => {
  /**
   * 사이드바 링크의 주소를 **보이는 차례대로** 읽는다. 차례를 재는 감지기들이 같은 일을 되풀이한다.
   */
  const sidebarHrefs = (): (string | null)[] =>
    within(navSidebar())
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'));

  /**
   * 탭 막대(`hub-tabs.tsx`)의 주소를 **보이는 차례대로** 읽는다. 탭 막대는 묶음 이름을 접근명으로
   * 가진 `navigation` 이다 — 묶음 안 화면의 차례는 사이드바가 아니라 여기서 잰다.
   */
  const hubTabHrefs = (hubLabel: string): (string | null)[] =>
    within(screen.getByRole('navigation', { name: hubLabel }))
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'));

  /*
   * 창고·Location 은 이제 「창고·위치」 탭 묶음의 첫 탭이다 — 사이드바에는 묶음 한 줄이 서고 그
   * 줄이 첫 탭의 주소를 건다(`nav-tree.ts` `tabs`).
   */
  it('사이드바에 기준정보 관리 섹션의 창고·위치 묶음이 창고·Location 주소로 보인다', () => {
    renderLayout('본문 내용');

    const sidebar = screen.getByRole('navigation', { name: '주 메뉴' });

    expect(within(sidebar).getByText('기준정보 관리')).toBeInTheDocument();
    expect(within(sidebar).getByRole('link', { name: '창고·위치' })).toHaveAttribute(
      'href',
      '/master-data/warehouse-location',
    );
    /* 탭 이름은 사이드바에 서지 않는다 — 묶음 한 줄로 줄이는 것이 탭 묶음의 목적이다. */
    expect(within(sidebar).queryByRole('link', { name: '창고·Location' })).toBeNull();
  });

  /*
   * **W-06-14 · C5-2** — 같은 「창고·위치」 묶음의 **창고·Location 바로 뒤**다. 적치 규칙은
   * 창고와 위치를 참조해야 성립하고 그 마스터에서 이어지는 화면이라, **인접이 관계를 드러낸다.**
   * 묶음 안의 차례는 탭 막대의 차례다.
   *
   * **앞뒤를 둘 다 잰다** — 창고·Location 다음 칸이면서 창고 배치도보다 앞이다(창고 계열은
   * 창고·Location → 적치 규칙 → 창고 배치도 차례다). 한쪽만 재면 반대편으로 밀려나도 통과한다.
   */
  it('창고·위치 탭 막대에서 적치 규칙이 창고·Location 바로 뒤에 있다', () => {
    renderLayout('본문 내용', { route: '/master-data/putaway-rule' });

    const tabs = screen.getByRole('navigation', { name: '창고·위치' });
    const links = hubTabHrefs('창고·위치');

    expect(within(tabs).getByRole('link', { name: '적치 규칙' })).toHaveAttribute(
      'href',
      '/master-data/putaway-rule',
    );
    expect(links.indexOf('/master-data/putaway-rule')).toBe(
      links.indexOf('/master-data/warehouse-location') + 1,
    );
    expect(links.indexOf('/master-data/warehouse-layout')).toBe(
      links.indexOf('/master-data/putaway-rule') + 1,
    );
  });

  /*
   * 기준정보 관리 — 품목·BOM 정보(ERP 원본과 확장속성 편집이 한 화면이다)가 앞에 서고, 그 다음에
   * MES 가 직접 세우는 마스터(공정 → 설비 → 툴·금형 → 계측기 → 창고·위치)가 온다. 횡단 조회인
   * 마스터 변경관리는 섹션 맨 뒤다.
   *
   * ⛔ ERP 에서 받은 것을 보기만 하는 「사원정보 조회 (ERP)」는 여기 없다 — 「시스템 관리」의
   * 「ERP 연동 현황·이력」 묶음의 탭으로 옮겼다(ERP 데이터 조회를 한 묶음에 모았다).
   */
  it('기준정보 관리 섹션이 품목·BOM 정보 → 공정·설비 → 창고 → 마스터 변경관리 차례다', () => {
    renderLayout('본문 내용');

    const sidebar = screen.getByRole('navigation', { name: '주 메뉴' });
    const links = sidebarHrefs();

    expect(within(sidebar).queryByRole('link', { name: '사원정보 조회 (ERP)' })).toBeNull();
    /* 섹션 첫 항목 — 업무함의 끝(공지·전달) 바로 뒤다. 가끔 여는 묶음들이 업무함 뒤에 선다. */
    expect(links.indexOf('/master-data/item-extended-attrs')).toBe(
      links.indexOf('/notification/notices') + 1,
    );
    /* 공정이 먼저 서고 그 공정을 도는 설비가 뒤따른다. */
    expect(links.indexOf('/master-data/routing')).toBe(
      links.indexOf('/master-data/item-extended-attrs') + 1,
    );
    expect(links.indexOf('/equipment/master')).toBe(links.indexOf('/master-data/routing') + 1);
    /* 설비 → 툴·금형 → 계측기 묶음이 차례로 서고, 창고·위치 묶음이 바로 뒤에 선다. */
    expect(links.indexOf('/equipment/tool-master')).toBe(links.indexOf('/equipment/master') + 1);
    expect(links.indexOf('/equipment/gauge-master')).toBe(
      links.indexOf('/equipment/tool-master') + 1,
    );
    expect(links.indexOf('/master-data/warehouse-location')).toBe(
      links.indexOf('/equipment/gauge-master') + 1,
    );
    /* 횡단 조회라 마스터 항목들 뒤 — 섹션 끝이다. */
    expect(links.indexOf('/master-data/master-change')).toBe(
      links.indexOf('/master-data/warehouse-location') + 1,
    );
  });

  it('사이드바에 공정(Routing) 메뉴가 보인다', () => {
    renderLayout('본문 내용');

    const sidebar = screen.getByRole('navigation', { name: '주 메뉴' });

    expect(within(sidebar).getByRole('link', { name: '공정(Routing)' })).toHaveAttribute(
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

  /* 불량·원인코드는 「품질 코드」 묶음의 첫 탭이다 — 사이드바의 묶음 줄이 그 주소를 건다. */
  it('사이드바에 품질 코드 묶음이 불량·원인코드 주소로 보인다', () => {
    renderLayout('본문 내용');

    const sidebar = screen.getByRole('navigation', { name: '주 메뉴' });

    expect(within(sidebar).getByRole('link', { name: '품질 코드' })).toHaveAttribute(
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

  /* 판정유형 코드는 「품질 코드」 묶음의 둘째 탭이다 — 탭 막대에서 불량·원인코드 바로 뒤에 선다. */
  it('품질 코드 탭 막대에 판정유형 코드가 불량·원인코드 뒤에 보인다', () => {
    renderLayout('본문 내용', { route: '/master-data/judgment-code' });

    const tabs = screen.getByRole('navigation', { name: '품질 코드' });

    expect(within(tabs).getByRole('link', { name: '판정유형 코드' })).toHaveAttribute(
      'href',
      '/master-data/judgment-code',
    );
    expect(hubTabHrefs('품질 코드')).toEqual([
      '/master-data/defect-cause-code',
      '/master-data/judgment-code',
    ]);
  });

  /* 옛 「연계 동기화 현황」 — 지금 그 연계가 ERP 하나라 이름에 대상을 적었다. */
  it('사이드바에 ERP 연동 현황·이력 메뉴가 보인다', () => {
    renderLayout('본문 내용');

    const sidebar = screen.getByRole('navigation', { name: '주 메뉴' });

    expect(within(sidebar).getByRole('link', { name: 'ERP 연동 현황·이력' })).toHaveAttribute(
      'href',
      '/master-data/integration-sync',
    );
  });

  it('사이드바에 품목·BOM 정보 메뉴가 보인다 — 품목·BOM 의 ERP 조회와 확장속성이 한 화면이다', () => {
    renderLayout('본문 내용');

    const sidebar = screen.getByRole('navigation', { name: '주 메뉴' });

    expect(within(sidebar).queryByRole('link', { name: '품목정보 조회 (ERP)' })).toBeNull();
    expect(within(sidebar).queryByRole('link', { name: 'BOM 조회 (ERP)' })).toBeNull();
    expect(within(sidebar).getByRole('link', { name: '품목·BOM 정보' })).toHaveAttribute(
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
   * 구매 / 자재 관리 — **입고 → 재고 → 출고 3축이다**(`nav-tree.ts`). 사이드바 한 줄이 「대상」
   * 하나이고 동작 이름은 탭으로 내렸다. 흐름이 남긴 전표를 가로질러 보는 물류 전표 조회가 끝에
   * 선다. ERP 구매발주 조회는 「ERP 연동 현황·이력」 묶음의 탭으로 옮겼다(보기만 하는 ERP 데이터를
   * 한 묶음에 모았다).
   *
   * **앞뒤를 둘 다 잰다** — 첫 줄은 섹션 밖 대시보드 바로 뒤이고, 끝 줄 바로 뒤가 다음 섹션(품질
   * 관리)의 첫 항목이다. 한쪽만 재면 반대편으로 밀려나도 통과한다.
   */
  it('사이드바 구매 / 자재 관리 섹션이 입고 관리 → 재고 관리 → 출고 관리 → 물류 전표 조회·취소 차례다', () => {
    renderLayout('본문 내용');

    const sidebar = screen.getByRole('navigation', { name: '주 메뉴' });
    const section = within(sidebar).getByRole('group', { name: '구매 / 자재 관리' });
    const links = sidebarHrefs();

    expect(within(sidebar).queryByRole('link', { name: '구매발주 조회 (ERP)' })).toBeNull();
    const rows: [string, string][] = [
      ['입고 관리', '/logistics/inbound-schedule'],
      ['재고 관리', '/logistics/stock-status'],
      ['출고 관리', '/production/material-issue-requests'],
      ['물류 전표 조회·취소', '/logistics/document-progress'],
    ];

    for (const [name, href] of rows) {
      expect(within(section).getByRole('link', { name })).toHaveAttribute('href', href);
    }
    expect(
      within(section)
        .getAllByRole('link')
        .map((link) => link.getAttribute('href')),
    ).toEqual(rows.map(([, href]) => href));
    /* 섹션 밖 대시보드 바로 뒤 — 매일 일하는 묶음의 첫 줄이 사이드바 첫 묶음의 첫 줄이다. */
    expect(links.indexOf('/logistics/inbound-schedule')).toBe(links.indexOf('/dashboard') + 1);
    expect(links.indexOf('/logistics/iqc-inspection')).toBe(
      links.indexOf('/logistics/document-progress') + 1,
    );
  });

  /*
   * 입고 관리 — 들어올 것을 보고(W-01-09) → 도착을 등록하고(W-01-03) → 창고로 받아들인다(W-01-10). **화면 하나다** —
   * 입하 등록 · 입고 처리는 그 화면의 창이다(사용자 지시 2026-10-21 · 2026-10-23 탭 합치기). 탭이 하나면 묶음이
   * 아니라 탭 막대가 서지 않는다 — 옛 「자재 입고 처리」 · 「초과 입하 분리」 탭이 다시 서지 않는다.
   *
   * ⚠ 옛 이름 「정상품 입하 처리」는 입고 화면을 입하라 불렀다 — 입하는 «도착»이고 입고는
   * «창고로 받아들임»이다(`nav-tree.ts`).
   */
  it('입고 관리는 탭 없는 한 줄이고, 옛 자재 입고 처리 · 초과 입하 분리 탭이 없다', () => {
    renderLayout('본문 내용', { route: '/logistics/inbound-schedule' });

    const sidebar = navSidebar();

    expect(within(sidebar).getByRole('link', { name: '입고 관리' })).toHaveAttribute(
      'href',
      '/logistics/inbound-schedule',
    );
    expect(screen.queryByRole('navigation', { name: '입고 관리' })).toBeNull();
    expect(screen.queryByRole('link', { name: '자재 입고 처리' })).toBeNull();
    expect(screen.queryByRole('link', { name: '초과 입하 분리' })).toBeNull();
    expect(screen.queryByRole('link', { name: '입하 예정 조회' })).toBeNull();
    expect(screen.queryByRole('link', { name: '정상품 입하 처리' })).toBeNull();
  });

  /*
   * 재고 관리 — **가장 자주 여는 재고 현황(W-01-07)이 첫 탭이다**(사이드바 한 번에 그 화면).
   * 차례가 업무 순서다 — 재고를 확인하고, 장부와 실물을 맞추고(재고실사 W-01-04), **어긋난 것을
   * 고친다**(재고조정 W-01-12 · C46 · D-19). 옛 「재고실사·조정」 묶음을 이 묶음이 대신한다.
   *
   * **W-01-11과 갈리는 자리다** — 그 화면은 맥락 없는 진입이 요구사항 위반이라 메뉴에 두지
   * 않았는데, 재고조정은 직접 등록이 정상 경로라 탭으로 바로 연다.
   */
  it('재고 관리 탭 막대가 재고 현황·상태 조회 → 재고실사 → 재고조정 차례다', () => {
    renderLayout('본문 내용', { route: '/logistics/stock-adjust' });

    const sidebar = navSidebar();
    const tabs = screen.getByRole('navigation', { name: '재고 관리' });

    expect(within(tabs).getByRole('link', { name: '재고 현황·상태 조회' })).toHaveAttribute(
      'href',
      '/logistics/stock-status',
    );
    expect(within(tabs).getByRole('link', { name: '재고조정' })).toHaveAttribute(
      'href',
      '/logistics/stock-adjust',
    );
    expect(hubTabHrefs('재고 관리')).toEqual([
      '/logistics/stock-status',
      '/logistics/stocktaking',
      '/logistics/stock-adjust',
    ]);
    expect(within(sidebar).queryByRole('link', { name: '재고실사·조정' })).toBeNull();
    expect(screen.queryByRole('navigation', { name: '재고실사·조정' })).toBeNull();
  });

  /*
   * 출고 관리 — 셋 다 **출고 전표를 만든다**: 생산으로 내보내고(자재 불출 W-02-10) · 공급사로
   * 되돌려 보내고(반품 W-01-05) · 못 쓰게 된 것을 장부에서 덜어낸다(폐기 W-01-06).
   */
  it('출고 관리 탭 막대가 자재 불출 요청 → 공급사 반품 처리 → 폐기 품의·기타출고 차례다', () => {
    renderLayout('본문 내용', { route: '/logistics/disposal-issue' });

    const tabs = screen.getByRole('navigation', { name: '출고 관리' });

    expect(within(tabs).getByRole('link', { name: '공급사 반품 처리' })).toHaveAttribute(
      'href',
      '/logistics/supplier-return',
    );
    expect(within(tabs).getByRole('link', { name: '폐기 품의·기타출고' })).toHaveAttribute(
      'href',
      '/logistics/disposal-issue',
    );
    expect(hubTabHrefs('출고 관리')).toEqual([
      '/production/material-issue-requests',
      '/logistics/supplier-return',
      '/logistics/disposal-issue',
    ]);
  });

  /*
   * ⚠ **자재 불출 요청(W-02-10)은 생산 관리에서 옮겨 왔다**(`nav-tree.ts` · 사용자 2026-10-20).
   * 요청하는 사람은 생산 담당이지만 결과는 자재 출고다. 옛 이름 「추가 자재 출고 요청」은 출고
   * 관리 안에서 「출고」를 되풀이해 「자재 불출 요청」으로 바꿨다.
   *
   * **양쪽을 다 잰다** — 출고 관리의 첫 탭이면서 생산 관리에는 없다. 한쪽만 재면 두 곳에 함께
   * 서도 통과한다.
   */
  it('자재 불출 요청은 생산 관리에 없고 출고 관리의 첫 탭이다', () => {
    renderLayout('본문 내용', { route: '/production/material-issue-requests' });

    const sidebar = navSidebar();
    const production = within(sidebar).getByRole('group', { name: '생산 관리' });
    const purchase = within(sidebar).getByRole('group', { name: '구매 / 자재 관리' });
    const tabs = screen.getByRole('navigation', { name: '출고 관리' });

    /* 짝 양성 — 생산 관리 섹션은 실제로 펼쳐져 항목이 서 있다. */
    expect(within(production).getAllByRole('link').length).toBeGreaterThan(0);
    expect(
      within(production)
        .getAllByRole('link')
        .map((link) => link.getAttribute('href')),
    ).not.toContain('/production/material-issue-requests');
    expect(within(sidebar).queryByRole('link', { name: '자재 불출 요청' })).toBeNull();
    expect(screen.queryByRole('link', { name: '추가 자재 출고 요청' })).toBeNull();

    expect(within(purchase).getByRole('link', { name: '출고 관리' })).toHaveAttribute(
      'href',
      '/production/material-issue-requests',
    );
    const first = within(tabs).getAllByRole('link')[0];

    expect(first).toHaveTextContent('자재 불출 요청');
    expect(first).toHaveAttribute('href', '/production/material-issue-requests');
    expect(first).toHaveAttribute('aria-current', 'page');
  });

  /*
   * **W-01-13 · C5-2** — 「구매 / 자재 관리」 섹션의 **맨 뒤**다. 앞의 세 축은 물건이 오가는
   * 순서이고, 이 화면은 그 흐름이 **남긴 전표들을 가로질러 찾고 되돌리는** 일이라 세 축 어디에도
   * 들지 않는다. 옛 이름 「물류 문서 진행현황·취소」를 「물류 전표 조회·취소」로 바꿨다.
   *
   * **앞뒤를 둘 다 잰다** — 출고 관리 줄 다음 칸이면서 다음 섹션(품질 관리)의 첫 항목 바로 앞이다.
   * 한쪽만 재면 반대편으로 밀려나도 통과한다: 앞으로 밀리면 세 축 사이에 끼고, 뒤로 밀리면
   * 섹션을 넘어가 **자재 관리 항목이 아니게 된다.**
   *
   * ⛔ **「업무함」에 두지 않는다.** 취소가 승인을 타지만 이 화면이 하는 일은 결재가 아니라
   * **상신과 실행**이다.
   */
  it('사이드바 구매 / 자재 관리 섹션의 맨 뒤에 물류 전표 조회·취소 메뉴가 있다', () => {
    renderLayout('본문 내용');

    const sidebar = screen.getByRole('navigation', { name: '주 메뉴' });
    const links = sidebarHrefs();

    expect(within(sidebar).getByRole('link', { name: '물류 전표 조회·취소' })).toHaveAttribute(
      'href',
      '/logistics/document-progress',
    );
    expect(within(sidebar).queryByRole('link', { name: '물류 문서 진행현황·취소' })).toBeNull();
    expect(links.indexOf('/logistics/document-progress')).toBe(
      links.indexOf('/production/material-issue-requests') + 1,
    );
    expect(links.indexOf('/logistics/iqc-inspection')).toBe(
      links.indexOf('/logistics/document-progress') + 1,
    );
    expect(links.indexOf('/logistics/document-progress')).toBeLessThan(
      links.indexOf('/approval/inbox'),
    );
  });

  /*
   * W-01-02 — IQC 를 «생략할 것인가»를 판정하는 자리라 **IQC 수입검사 바로 뒤**다. IQC 가
   * 「품질 관리」로 옮겨 가면서 이 화면도 그 옆을 따라갔다.
   *
   * ⛔ 「승인」 섹션이 아니다 — 결재함은 올라온 결재를 두루 처리하는 자리라 축이 다르다.
   */
  it('사이드바 품질 관리 섹션에 긴급 IQC 생략 한도승인 메뉴가 IQC 수입검사·판정 바로 뒤에 있다', () => {
    renderLayout('본문 내용');

    const sidebar = screen.getByRole('navigation', { name: '주 메뉴' });
    const links = sidebarHrefs();

    expect(within(sidebar).getByRole('link', { name: '긴급 IQC 생략 한도승인' })).toHaveAttribute(
      'href',
      '/logistics/iqc-skip-approval',
    );
    expect(links.indexOf('/logistics/iqc-skip-approval')).toBe(
      links.indexOf('/logistics/iqc-inspection') + 1,
    );
    expect(links.indexOf('/logistics/iqc-skip-approval')).toBeLessThan(
      links.indexOf('/approval/inbox'),
    );
  });

  /*
   * 품질 관리 — **독립 영역이다.** 검사를 IQC(입하) → PQC(공정) → OQC(출하) 흐름 차례로 세우고,
   * 검사기준·코드, 검사 이력, 그리고 LOT 상태 → 보류 → 승인 → 처분의 판정 갈래가 뒤따른다.
   * 불량·원인코드와 판정유형 코드는 「품질 코드」, LOT 조회와 판정은 「LOT 상태」 묶음 한 줄이다.
   */
  it('품질 관리 섹션이 IQC → PQC → OQC → 검사기준·코드 → 검사실적 → LOT 상태·보류·승인·처분 순서다', () => {
    renderLayout('본문 내용');

    const sidebar = screen.getByRole('navigation', { name: '주 메뉴' });
    const links = sidebarHrefs();

    expect(within(sidebar).getByText('품질 관리')).toBeInTheDocument();
    expect(within(sidebar).getByRole('link', { name: 'IQC (수입검사) 조회·판정' })).toHaveAttribute(
      'href',
      '/logistics/iqc-inspection',
    );
    expect(within(sidebar).getByRole('link', { name: 'PQC (공정검사) 조회·판정' })).toHaveAttribute(
      'href',
      '/quality/pqc-inspections',
    );
    expect(within(sidebar).getByRole('link', { name: 'OQC (출하검사) 조회·판정' })).toHaveAttribute(
      'href',
      '/shipment/oqc-inspection',
    );
    expect(within(sidebar).getByRole('link', { name: 'LOT 상태' })).toHaveAttribute(
      'href',
      '/quality/lot-status',
    );
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
    expect(within(sidebar).getByRole('link', { name: '처분 판정 처리' })).toHaveAttribute(
      'href',
      '/quality/dispositions',
    );

    const qualityOrder = [
      '/logistics/iqc-inspection',
      '/logistics/iqc-skip-approval',
      '/quality/pqc-inspections',
      '/shipment/oqc-inspection',
      '/master-data/inspection-standard',
      /* W-06-24 — OA 제품 검사표 기준(설계보다 앞선 화면). */
      '/master-data/inspection-sheet-template',
      /* 「품질 코드」 묶음 — 불량·원인코드 → 판정유형 코드. */
      '/master-data/defect-cause-code',
      '/quality/inspection-results',
      /* W-03-13 — OA 제품 검사표 조회·서명(설계보다 앞선 화면). */
      '/quality/inspection-sheets',
      /* 「LOT 상태」 묶음 — 조회 → 판정(W-03-02 는 조회에서 찾은 LOT 을 판정·전이한다). */
      '/quality/lot-status',
      '/quality/suspicious-material-hold',
      '/quality/approvals',
      /* W-03-10 — 여기서 정한 처분이 폐기·재등록·재작업 화면의 진입을 연다. */
      '/quality/dispositions',
      /* W-03-12 — 품목별 IQC 검사 수준(설계보다 앞선 화면). */
      '/quality/inspection-levels',
    ];
    const start = links.indexOf(qualityOrder[0] ?? '');

    expect(links.slice(start, start + qualityOrder.length)).toEqual(qualityOrder);
    /* 구매 / 자재 관리 뒤 · 생산 관리 앞이다. */
    expect(start).toBe(links.indexOf('/logistics/document-progress') + 1);
    expect(links.indexOf('/production/production-orders')).toBe(start + qualityOrder.length);
  });

  /* W-03-02 — LOT 판정은 조회에서 찾은 LOT 을 판정·전이하므로 「LOT 상태」 묶음의 조회 바로 뒤 탭이다. */
  it('LOT 상태 탭 막대가 LOT 상태 조회 → LOT 상태 판정 차례다', () => {
    renderLayout('본문 내용', { route: '/quality/lot-status' });

    const tabs = screen.getByRole('navigation', { name: 'LOT 상태' });

    expect(within(tabs).getByRole('link', { name: 'LOT 상태 조회' })).toHaveAttribute(
      'href',
      '/quality/lot-status',
    );
    expect(within(tabs).getByRole('link', { name: 'LOT 상태 판정' })).toHaveAttribute(
      'href',
      '/quality/lot-status-transition',
    );
    expect(hubTabHrefs('LOT 상태')).toEqual([
      '/quality/lot-status',
      '/quality/lot-status-transition',
    ]);
  });

  it('영업 / 출하 관리 섹션(출하지시 → 예정 → 출하 처리 → 확정 → 반품 갈래)이 생산 관리 뒤·업무함 앞에 있다', () => {
    renderLayout('본문 내용');

    const sidebar = screen.getByRole('navigation', { name: '주 메뉴' });
    const links = sidebarHrefs();

    expect(within(sidebar).getByText('영업 / 출하 관리')).toBeInTheDocument();
    /* ERP 수주정보 조회는 「ERP 연동 현황·이력」 묶음의 탭으로 옮겼다. */
    expect(within(sidebar).queryByRole('link', { name: '수주정보 조회 (ERP)' })).toBeNull();
    expect(
      within(sidebar).getByRole('link', { name: '출하지시서 Import·작업지시 생성' }),
    ).toHaveAttribute('href', '/shipment/shipment-request-create');
    expect(within(sidebar).getByRole('link', { name: '출하 예정 목록' })).toHaveAttribute(
      'href',
      '/shipment/shipment-schedule',
    );
    /* 정상·긴급 직행 출하는 「출하 처리」 묶음 한 줄이다 — 줄은 정상 흐름(첫 탭)을 건다. */
    expect(within(sidebar).getByRole('link', { name: '출하 처리' })).toHaveAttribute(
      'href',
      '/shipment/shipment-processing',
    );
    expect(within(sidebar).getByRole('link', { name: '출하 확정·취소' })).toHaveAttribute(
      'href',
      '/shipment/shipment-confirm',
    );
    /* 반품·재고 갈래는 「반품·클레임」 묶음 한 줄이다 — 줄은 입고 등록(첫 탭)을 건다. */
    expect(within(sidebar).getByRole('link', { name: '반품·클레임' })).toHaveAttribute(
      'href',
      '/shipment/return-receipts',
    );

    /* 섹션 첫 항목 — 생산 관리의 끝(W/O 마감) 바로 뒤다. */
    expect(links.indexOf('/shipment/shipment-request-create')).toBe(
      links.indexOf('/production/work-order-close') + 1,
    );
    /* 편성이 예정보다 먼저다 — 지시서를 편성해야 예정이 생긴다(업무 순서). */
    expect(links.indexOf('/shipment/shipment-schedule')).toBe(
      links.indexOf('/shipment/shipment-request-create') + 1,
    );
    /*
     * OQC 판정이 「품질 관리」로 옮겨 가서 예정 목록 바로 뒤가 출하 처리다. OQC 는 이 섹션에
     * 없다 — 검사는 품질 한 곳에 모았다.
     */
    expect(links.indexOf('/shipment/shipment-processing')).toBe(
      links.indexOf('/shipment/shipment-schedule') + 1,
    );
    expect(links.indexOf('/shipment/oqc-inspection')).toBeLessThan(
      links.indexOf('/shipment/shipment-request-create'),
    );
    /* 확정은 «만드는» 묶음 뒤다 — 되돌릴 수 있는 구간이 여기서 끝난다(W-04-12). */
    expect(links.indexOf('/shipment/shipment-confirm')).toBe(
      links.indexOf('/shipment/shipment-processing') + 1,
    );
    /* W-04-06 — 반품·재고 갈래. 확정된 출하는 취소되지 않고 여기로 돌아오므로 확정·취소 바로 뒤다. */
    expect(links.indexOf('/shipment/return-receipts')).toBe(
      links.indexOf('/shipment/shipment-confirm') + 1,
    );
    /* 섹션 끝 — 바로 뒤가 「업무함」의 결재함이다. */
    expect(links.indexOf('/approval/inbox')).toBe(links.indexOf('/shipment/return-receipts') + 1);
  });

  /*
   * ⭐ 예외 흐름은 정상 흐름 «뒤»다 — 앞에 두면 창고 경유·피킹·포장을 건너뛰는 화면이 기본으로
   * 읽힌다(W-04-05). 그래서 정상 출하가 첫 탭이고 묶음 줄이 그 주소를 건다.
   */
  it('출하 처리 탭 막대가 정상 출하 → 긴급 직행 출하 차례다', () => {
    renderLayout('본문 내용', { route: '/shipment/expedited-shipment' });

    const tabs = screen.getByRole('navigation', { name: '출하 처리' });

    expect(within(tabs).getByRole('link', { name: '출하 처리(상차·실물 출고)' })).toHaveAttribute(
      'href',
      '/shipment/shipment-processing',
    );
    expect(within(tabs).getByRole('link', { name: '긴급 직행 출하 처리' })).toHaveAttribute(
      'href',
      '/shipment/expedited-shipment',
    );
    expect(hubTabHrefs('출하 처리')).toEqual([
      '/shipment/shipment-processing',
      '/shipment/expedited-shipment',
    ]);
  });

  /*
   * 반품·클레임 — 입고 등록(W-04-06) → 판정 의뢰(W-04-07) → 재고 재등록(W-04-11) → 제품 폐기
   * 요청(W-04-10). 버리는 일은 반품·재고 갈래 «뒤»다 — 앞 탭을 이름으로 잡아 두어야 다음에 또
   * 끼어들 때 여기가 울린다.
   */
  it('반품·클레임 탭 막대가 입고 등록 → 판정 의뢰 → 재고 재등록 → 제품 폐기 요청 차례다', () => {
    renderLayout('본문 내용', { route: '/shipment/return-receipts' });

    const tabs = screen.getByRole('navigation', { name: '반품·클레임' });

    expect(within(tabs).getByRole('link', { name: '반품·클레임 입고 등록' })).toHaveAttribute(
      'href',
      '/shipment/return-receipts',
    );
    expect(within(tabs).getByRole('link', { name: '재작업/폐기 판정 의뢰' })).toHaveAttribute(
      'href',
      '/shipment/disposition-requests',
    );
    expect(within(tabs).getByRole('link', { name: '재고 재등록' })).toHaveAttribute(
      'href',
      '/shipment/stock-reinstatements',
    );
    expect(within(tabs).getByRole('link', { name: '제품 폐기 요청' })).toHaveAttribute(
      'href',
      '/shipment/product-disposal-request',
    );
    expect(hubTabHrefs('반품·클레임')).toEqual([
      '/shipment/return-receipts',
      '/shipment/disposition-requests',
      '/shipment/stock-reinstatements',
      '/shipment/product-disposal-request',
    ]);
  });

  it('생산 관리 섹션의 ERP W/O·배포·진행·마감이 업무 순서대로 있다', () => {
    renderLayout('본문 내용');

    const sidebar = screen.getByRole('navigation', { name: '주 메뉴' });
    const links = sidebarHrefs();

    expect(within(sidebar).getByText('생산 관리')).toBeInTheDocument();
    /* 조회와 변경 확인은 「ERP W/O」 묶음 한 줄이다 — 줄은 조회(첫 탭)를 건다. */
    expect(within(sidebar).getByRole('link', { name: 'ERP W/O' })).toHaveAttribute(
      'href',
      '/production/production-orders',
    );
    /*
     * ⛔ 전개·편성(`W-02-02`)과 4M 배정(`W-02-03`)은 메뉴에 «없다»(omf-all-around#41) — 주소에
     * 대상이 실려야 그리는 화면이라 맨 주소로 열면 안내만 선다. 앞 화면의 이동 버튼으로 들어간다.
     */
    expect(links).not.toContain('/production/production-plans');
    expect(links).not.toContain('/production/work-order-assignments');
    /* W-02-04(확정, 배포)는 「ERP W/O 처리」 작업함의 일괄 배포와 처리 화면 마지막 단계로 합쳐 메뉴에 «없다». */
    expect(links).not.toContain('/production/work-order-release');
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
    /* 품질 관리의 끝(검사 수준 관리) 바로 뒤가 섹션의 시작이다. */
    expect(links.indexOf('/production/production-orders')).toBe(
      links.indexOf('/quality/inspection-levels') + 1,
    );
    /* W-02-07 — 계획을 거치지 않는 갈래라 정규 흐름(ERP W/O 처리) 뒤다. */
    expect(links.indexOf('/production/emergency-work-orders')).toBe(
      links.indexOf('/production/production-orders') + 1,
    );
    /*
     * W-02-10 자재 불출 요청은 「구매 / 자재 관리 > 출고 관리」로 옮겼다 — 긴급 발행 바로 뒤가
     * 진행현황이다(그쪽 자리는 「자재 불출 요청은 생산 관리에 없고 …」 감지기가 잰다).
     */
    expect(links.indexOf('/production/work-order-progress')).toBe(
      links.indexOf('/production/emergency-work-orders') + 1,
    );
    /* W-02-05 — 진행을 본 뒤 닫는다. 생산 흐름의 끝이다. */
    expect(links.indexOf('/production/work-order-close')).toBe(
      links.indexOf('/production/work-order-progress') + 1,
    );
    /* 영업 / 출하 관리가 생산 바로 뒤에 선다 — 매일 일하는 묶음끼리 붙어 있다. */
    expect(links.indexOf('/shipment/shipment-request-create')).toBe(
      links.indexOf('/production/work-order-close') + 1,
    );
  });

  /*
   * 변경 판정은 조회 바로 뒤 탭이다 — 그 화면이 만든 목록 위에서 이어진다(W-02-06).
   * 옛 「P/O 변경 관리자 확인」 — 「P/O」는 구매오더만 뜻하게 되어 「ERP W/O」로 바꿨다.
   */
  it('ERP W/O 탭 막대가 ERP W/O 처리 → ERP W/O 변경 확인 차례다', () => {
    renderLayout('본문 내용', { route: '/production/po-change-review' });

    const tabs = screen.getByRole('navigation', { name: 'ERP W/O' });

    expect(within(tabs).getByRole('link', { name: 'ERP W/O 처리' })).toHaveAttribute(
      'href',
      '/production/production-orders',
    );
    expect(within(tabs).getByRole('link', { name: 'ERP W/O 변경 확인' })).toHaveAttribute(
      'href',
      '/production/po-change-review',
    );
    expect(hubTabHrefs('ERP W/O')).toEqual([
      '/production/production-orders',
      '/production/po-change-review',
    ]);
  });

  /*
   * **알려진 섹션이 사이드바의 링크를 빠짐없이 담는다**를 값으로 고정한다. 섹션이 하나 더
   * 생기면 그 안의 링크가 이 합집합 밖으로 나와 곧바로 걸린다 — 분류를 늘리는 일은
   * 화면 하나를 더하는 일과 무게가 다르므로 **말없이 지나가지 않게** 한다.
   *
   * 메뉴 IA 개편(기준정보 관리 · 구매 / 자재 관리 · 품질 관리 · 생산 관리 · 설비 보전 관리 ·
   * 영업 / 출하 관리 · 업무함 · 시스템 관리)으로 묶음이 여덟이 됐다. 「승인」(결재함 하나)과
   * 「알림」을 「업무함」 하나로 합쳤다 — 누구나 자기에게 온 것을 보는 자리다.
   *
   * ⭐ **섹션 밖에 서는 항목은 하나다** — W-CO-05 통합 대시보드다. 그 화면은 어느 업무
   * 묶음에도 속하지 않고 **모든 묶음의 숫자를 모아** 보이므로, 어느 섹션에 넣어도 그 섹션의
   * 분류가 무너진다.
   *
   * ⚠ **그래서 이 감지기는 「전부 섹션 안」이 아니라 「섹션 밖은 이것 하나」를 잰다.**
   * 느슨해진 것이 아니다 — 섹션 밖에 항목이 하나 더 늘면 그때도 여기서 걸린다.
   */
  const UNSECTIONED_LINKS = ['/dashboard'];

  /* 매일 일하는 묶음과 업무함이 앞, 정해 두고 가끔 여는 묶음이 뒤다(`nav-tree.ts` 머리 주석). */
  const SECTION_LABELS = [
    '구매 / 자재 관리',
    '품질 관리',
    '생산 관리',
    '영업 / 출하 관리',
    '업무함',
    '기준정보 관리',
    '설비 보전 관리',
    '시스템 관리',
  ];

  it('사이드바 섹션이 여덟이고 섹션 밖 항목은 통합 대시보드 하나다', () => {
    renderLayout('본문 내용');

    const sidebar = screen.getByRole('navigation', { name: '주 메뉴' });

    /*
     * **묶음을 역할로 집는다.** 묶음은 자기 이름을 접근명으로 내놓으므로(`role="group"` +
     * `aria-label`) 이름 목록은 그대로 쓰면서 DS 의 구조 의존을 끊는다.
     */
    const sections = SECTION_LABELS.map((label) =>
      within(sidebar).getByRole('group', { name: label }),
    );

    expect(within(sidebar).getAllByRole('group')).toHaveLength(SECTION_LABELS.length);

    const grouped = sections.flatMap((section) => [...section.querySelectorAll('a')]);
    const all = within(sidebar).getAllByRole('link');
    const ungrouped = all.filter((link) => !grouped.some((anchor) => anchor === link));

    expect(ungrouped.map((link) => link.getAttribute('href'))).toEqual(UNSECTIONED_LINKS);
    expect(grouped.length + ungrouped.length).toBe(all.length);
  });

  /*
   * 시스템 운영 화면이라 기준정보와 다른 섹션에 둔다 —
   * 같은 섹션에 넣으면 「창고·위치」 옆에 서서 분류가 무너진다.
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
   * 시스템 관리 — **ERP 연동 현황 → 사용자·권한 → 결재·알림 설정 → 공통 설정** 차례다(아키텍처).
   * 운영 설정이라 맨 끝 섹션이고(설비 보전 관리 뒤), 그 첫 항목이 ERP 연동 현황·이력이다.
   */
  it('시스템 관리 섹션이 설비 보전 관리 뒤 맨 끝에 서고 ERP 연동 현황·이력으로 시작한다', () => {
    renderLayout('본문 내용');

    const links = sidebarHrefs();

    expect(links.indexOf('/master-data/integration-sync')).toBe(
      links.indexOf('/equipment/downtime-summary') + 1,
    );
    expect(links.indexOf('/system/users-roles')).toBe(
      links.indexOf('/master-data/integration-sync') + 1,
    );
    /* W-CO-11 — 결재선처럼 **누가 받을지**를 관리자가 정한다. 그래서 결재선 바로 뒤다. */
    expect(links.indexOf('/notification/recipient-settings')).toBe(
      links.indexOf('/system/approval-route') + 1,
    );
    /* 시스템 공통 설정 — 결재·알림 설정 뒤에 공통코드·조직, 그리고 단말 매핑이 선다. */
    /* W-CO-12 — 받을 사람 다음에 «어디로» 나가는지(001). */
    expect(links.indexOf('/notification/zalo-connection')).toBe(
      links.indexOf('/notification/recipient-settings') + 1,
    );
    expect(links.indexOf('/notification/dispatch-history')).toBe(
      links.indexOf('/notification/zalo-connection') + 1,
    );
    expect(links.indexOf('/master-data/common-code')).toBe(
      links.indexOf('/notification/dispatch-history') + 1,
    );
    expect(links.indexOf('/system/terminal-process-map')).toBe(
      links.indexOf('/master-data/common-code') + 1,
    );
  });

  /**
   * **차례가 순서다** — 승인자를 정할 수 있게 된 다음에 결재선을 세운다.
   * 결재선은 마스터이지만 창고·품목 같은 업무 기준정보가 아니라 운영 설정이라 이 섹션에 든다.
   */
  it('사이드바에 시스템 관리 섹션의 결재선 정의 메뉴가 사용자·역할·권한 뒤에 보인다', () => {
    renderLayout('본문 내용');

    const sidebar = screen.getByRole('navigation', { name: '주 메뉴' });
    const links = sidebarHrefs();

    expect(within(sidebar).getByRole('link', { name: '결재선 정의' })).toHaveAttribute(
      'href',
      '/system/approval-route',
    );
    expect(links.indexOf('/system/approval-route')).toBe(links.indexOf('/system/users-roles') + 1);
  });

  /**
   * ⛔ **비밀번호 변경은 사이드바에 없다** — 상단 바의 사용자 자리로 옮겼다(W-CO-10 · 사용자
   * 2026-10-20). 누구나 자기 것을 바꾸는 자리라 관리자 묶음에 둘 이유가 없다. 상단 바 쪽은
   * 「상단 바의 비밀번호 변경」 감지기가 잰다.
   */
  it('사이드바에 비밀번호 변경 메뉴가 없다', () => {
    renderLayout('본문 내용');

    const sidebar = screen.getByRole('navigation', { name: '주 메뉴' });

    /* 짝 양성 — 시스템 관리 섹션은 실제로 펼쳐져 항목이 서 있다. */
    expect(within(sidebar).getByRole('link', { name: '사용자·역할·권한' })).toBeInTheDocument();
    expect(
      within(sidebar).queryByRole('link', { name: messages.session.actions.changePassword }),
    ).toBeNull();
    expect(sidebarHrefs()).not.toContain('/system/password-change');
  });

  /**
   * **결재함은 「업무함」에 선다** — 기준정보도 시스템 운영도 아니라 일하는 자리다. 결재선
   * 정의(운영 설정)와 같은 섹션에 넣으면 「설정하는 화면」과 「일하는 화면」이 섞인다.
   */
  it('사이드바에 업무함 섹션의 결재함 메뉴가 시스템 관리 앞에 보인다', () => {
    renderLayout('본문 내용');

    const sidebar = screen.getByRole('navigation', { name: '주 메뉴' });
    const links = sidebarHrefs();

    expect(within(sidebar).getByRole('group', { name: '업무함' })).toBeInTheDocument();
    expect(within(sidebar).getByRole('link', { name: '결재함' })).toHaveAttribute(
      'href',
      '/approval/inbox',
    );
    expect(links.indexOf('/approval/inbox')).toBeLessThan(links.indexOf('/system/users-roles'));
    expect(links.indexOf('/approval/inbox')).toBeLessThan(
      links.indexOf('/master-data/integration-sync'),
    );
  });

  /*
   * 새 섹션·새 항목을 더하면서 기존 구성이 흔들리지 않았는지 함께 본다.
   *
   * ⚠ **이 감지기는 사이드바 전체의 차례를 잰다.** 어느 섹션에 무엇을 더하든 여기를 함께
   * 고친다. 배치 근거는 `nav-tree.ts` 의 항목마다 적혀 있다. 탭 묶음은 **첫 탭의 주소**로 한 줄
   * 서고(「← 묶음」 표시), 묶음 안의 차례는 아래 「탭 묶음마다 탭 차례가 그대로다」가 잰다.
   */
  it('사이드바 전체의 항목 순서와 경로가 그대로다', () => {
    renderLayout('본문 내용');

    expect(sidebarHrefs()).toEqual([
      /* W-CO-05 — 섹션 밖 맨 위. 로그인 직후 첫 화면이라 모든 묶음 위에 선다. */
      '/dashboard',
      /* 구매 / 자재 관리 — 매일 일하는 묶음이 앞이다. 입고 → 재고 → 출고 3축, 끝에 물류 전표 조회. */
      '/logistics/inbound-schedule' /* ← 입고 관리 */,
      '/logistics/stock-status' /* ← 재고 관리 */,
      '/production/material-issue-requests' /* ← 출고 관리 */,
      '/logistics/document-progress',
      /* 품질 관리 — IQC → PQC → OQC → 기준·코드 → 이력 → LOT 판정 갈래. */
      '/logistics/iqc-inspection',
      '/logistics/iqc-skip-approval',
      '/quality/pqc-inspections',
      '/shipment/oqc-inspection',
      '/master-data/inspection-standard',
      '/master-data/inspection-sheet-template',
      '/master-data/defect-cause-code' /* ← 품질 코드 */,
      '/quality/inspection-results',
      '/quality/inspection-sheets',
      '/quality/lot-status' /* ← LOT 상태 */,
      '/quality/suspicious-material-hold',
      '/quality/approvals',
      '/quality/dispositions',
      '/quality/inspection-levels',
      /* 생산 관리 — ERP W/O(처리, 변경 확인) → (긴급) → 진행 → 마감. */
      '/production/production-orders' /* ← ERP W/O */,
      '/production/emergency-work-orders',
      '/production/work-order-progress',
      '/production/work-order-close',
      /* 영업 / 출하 관리 — 편성 → 예정 → 출하 처리 → 확정 → 반품·클레임. */
      '/shipment/shipment-request-create',
      '/shipment/shipment-schedule',
      '/shipment/shipment-processing' /* ← 출하 처리 */,
      '/shipment/shipment-confirm',
      '/shipment/return-receipts' /* ← 반품·클레임 */,
      /* 업무함 — 결재함 → 알림센터(받는 자리) → 공지·전달(보내는 자리). */
      '/approval/inbox',
      '/notification/center',
      '/notification/notices',
      /* 기준정보 관리 — 품목·BOM 정보 먼저, MES 가 세우는 마스터가 뒤. */
      '/master-data/item-extended-attrs',
      '/master-data/routing',
      '/equipment/master' /* ← 설비 */,
      '/equipment/tool-master' /* ← 툴·금형 */,
      '/equipment/gauge-master' /* ← 계측기 */,
      '/master-data/warehouse-location' /* ← 창고·위치 */,
      '/master-data/master-change',
      /* 설비 보전 관리 — 일하는 화면만: 설비 보전 → 툴 보전 → 비가동. */
      '/equipment/failures' /* ← 설비 보전 */,
      '/equipment/tool-pm-order' /* ← 툴 보전 */,
      '/equipment/downtime-summary',
      /* 시스템 관리 — ERP 연동 현황 → 사용자·권한 → 결재·알림 설정 → 공통 설정. */
      '/master-data/integration-sync' /* ← ERP 연동 현황·이력 */,
      '/system/users-roles',
      '/system/approval-route',
      '/notification/recipient-settings',
      '/notification/zalo-connection',
      '/notification/dispatch-history',
      '/master-data/common-code',
      '/system/terminal-process-map',
    ]);
  });

  /*
   * 탭 묶음 열다섯 개의 **탭 차례와 경로**. 사이드바 전체 감지기가 묶음 줄만 재므로, 묶음 안의
   * 차례는 여기서 얼린다 — 묶음 줄을 **실제로 눌러** 첫 탭에 들어가고 그 자리의 탭 막대를 읽는다.
   * 줄을 누르면 첫 탭에 닿는다는 것(`to` = 첫 탭)도 함께 재진다.
   */
  it('탭 묶음마다 탭 차례와 경로가 그대로다', async () => {
    const { user } = renderLayout('본문 내용');

    const HUBS: Record<string, string[]> = {
      설비: ['/equipment/master', '/equipment/work-calendar', '/equipment/collection-channels'],
      '툴·금형': ['/equipment/tool-master', '/equipment/shot-conversion'],
      계측기: ['/equipment/gauge-master', '/equipment/gauge-calibration'],
      '창고·위치': [
        '/master-data/warehouse-location',
        '/master-data/putaway-rule',
        '/master-data/warehouse-layout',
      ],
      '재고 관리': ['/logistics/stock-status', '/logistics/stocktaking', '/logistics/stock-adjust'],
      '출고 관리': [
        '/production/material-issue-requests',
        '/logistics/supplier-return',
        '/logistics/disposal-issue',
      ],
      '품질 코드': ['/master-data/defect-cause-code', '/master-data/judgment-code'],
      'LOT 상태': ['/quality/lot-status', '/quality/lot-status-transition'],
      'ERP W/O': ['/production/production-orders', '/production/po-change-review'],
      '설비 보전': [
        '/equipment/failures',
        '/equipment/maintenance-orders',
        '/equipment/maintenance-results',
      ],
      '툴 보전': ['/equipment/tool-pm-order', '/equipment/tool-pm-result'],
      '출하 처리': ['/shipment/shipment-processing', '/shipment/expedited-shipment'],
      '반품·클레임': [
        '/shipment/return-receipts',
        '/shipment/disposition-requests',
        '/shipment/stock-reinstatements',
        '/shipment/product-disposal-request',
      ],
      /* 연동 로그가 첫 탭, 그 뒤가 받은 데이터 — 기준 데이터 다음 전표 차례다. */
      'ERP 연동 현황·이력': [
        '/master-data/integration-sync',
        '/system/erp-data/common-codes',
        '/system/erp-data/employees',
        '/system/erp-data/items',
        '/system/erp-data/partners',
        '/system/erp-data/boms',
        '/system/erp-data/purchase-orders',
        '/system/erp-data/sales-orders',
        '/system/erp-data/production-orders',
      ],
    };

    const actual: Record<string, (string | null)[]> = {};

    for (const hubLabel of Object.keys(HUBS)) {
      await user.click(within(navSidebar()).getByRole('link', { name: hubLabel }));

      actual[hubLabel] = hubTabHrefs(hubLabel);

      /* 줄을 누르면 **첫 탭**에 닿는다. */
      expect(
        within(screen.getByRole('navigation', { name: hubLabel })).getAllByRole('link')[0],
      ).toHaveAttribute('aria-current', 'page');
    }

    expect(actual).toEqual(HUBS);
  });

  /**
   * W-CO-03 — **알림센터는 「업무함」에 선다.** 결재함과 함께 누구나 자기에게 온 것을 보는
   * 자리다. 관리자가 남을 설정하는 **알림 수신자 설정은 「시스템 관리」에 있다** — 「업무함」에
   * 두면 일하는 자리에 설정 화면이 섞인다.
   */
  it('사이드바에 업무함 섹션의 알림센터 메뉴가 결재함 뒤에 있고 업무함이 기준정보 관리 앞에 선다', () => {
    renderLayout('본문 내용');

    const sidebar = screen.getByRole('navigation', { name: '주 메뉴' });
    const inbox = within(sidebar).getByRole('group', { name: '업무함' });
    const system = within(sidebar).getByRole('group', { name: '시스템 관리' });

    const item = within(inbox).getByRole('link', { name: /알림센터/ });
    expect(item).toHaveAttribute('href', '/notification/center');
    expect(within(system).getByRole('link', { name: '알림 수신자 설정' })).toHaveAttribute(
      'href',
      '/notification/recipient-settings',
    );
    expect(within(inbox).queryByRole('link', { name: '알림 수신자 설정' })).toBeNull();

    expect(
      within(inbox)
        .getAllByRole('link')
        .map((link) => link.getAttribute('href')),
    ).toEqual(['/approval/inbox', '/notification/center', '/notification/notices']);

    /* 전체 차례는 업무 묶음 → 업무함 → 가끔 여는 묶음(기준정보·설비 보전) → 시스템 관리다. */
    const labels = SECTION_LABELS.map((label) =>
      within(sidebar).getByRole('group', { name: label }),
    );
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
   * 「알 수 없음」·「게스트」류의 글자를 두면 **로그인한 것처럼** 읽힌다. 앱에서는 가드가
   * 앞에 서므로(#1019) 이 갈래로 서는 일이 없지만, 셸이 그것을 강제할 수는 없다.
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

/**
 * **나가는 길**(#1019).
 *
 * ⭐ **가드가 서면 로그아웃 없이는 세션을 끊을 수 없다.** 그전에는 브라우저를 껐다 켜는 것이
 * 사실상의 로그아웃이었지만, 이제 그렇게 해도 세션 쿠키가 살아 있어 그대로 다시 들어온다.
 */
describe('AppLayout — 로그아웃', () => {
  it('세션이 있으면 상단 바에 로그아웃이 선다', async () => {
    const { user } = renderLayout('본문 내용');

    await user.click(screen.getByRole('button', { name: '세션 담기' }));

    expect(
      within(topbar()).getByRole('button', { name: messages.session.actions.signOut }),
    ).toBeEnabled();
  });

  /** 로그인하지 않은 사람에게 나가는 길을 보이면 누를 수 없는 항목이 하나 는다. */
  it('세션이 없으면 로그아웃이 없다', () => {
    renderLayout('본문 내용');

    expect(
      within(topbar()).queryByRole('button', { name: messages.session.actions.signOut }),
    ).toBeNull();
  });

  /** ⭐ **이름 없이 로그아웃만 두지 않는다** — 나가기 전에 지금 누구로 있는지 확인해야 한다. */
  it('이름과 로그아웃이 같은 자리에 함께 선다', async () => {
    const { user } = renderLayout('본문 내용');

    await user.click(screen.getByRole('button', { name: '세션 담기' }));

    const actions = within(topbar()).getByText(SYNTHETIC_USER_NAME).parentElement;

    if (actions === null) throw new Error('이름을 담은 자리를 찾지 못했습니다');

    expect(
      within(actions).getByRole('button', { name: messages.session.actions.signOut }),
    ).toBeInTheDocument();
  });
});

/**
 * **언어를 고르는 자리**(#1113).
 *
 * ⭐ **로그아웃과 같은 자리에 둔다.** 공용 PC 를 한국인 관리자와 베트남인 관리자가 번갈아 쓰므로,
 * 자리에 앉은 사람이 먼저 하는 일이 「내 언어로 바꾸고 내 계정으로 들어가기」다.
 *
 * ⚠ **고르는 동작 자체는 여기서 재지 않는다** — 새로고침까지가 한 동작이라
 * `patterns/locale-select.test.tsx` 가 갈아 끼운 새로고침으로 잰다. 여기서 재는 것은 **자리**다.
 */
describe('AppLayout — 언어 선택', () => {
  it('세션이 있으면 로그아웃과 같은 자리에 언어 선택이 선다', async () => {
    const { user } = renderLayout('본문 내용');

    await user.click(screen.getByRole('button', { name: '세션 담기' }));

    const actions = within(topbar()).getByText(SYNTHETIC_USER_NAME).parentElement;

    if (actions === null) throw new Error('이름을 담은 자리를 찾지 못했습니다');

    expect(within(actions).getByRole('combobox', { name: '언어' })).toBeInTheDocument();
  });

  /**
   * ⚠ **로그인 화면에 칸이 없다는 뜻이 아니다**(#1126 부터는 그 화면이 제 손으로 세운다) —
   * 여기서 재는 것은 **상단 바**의 자리다. 이 셸은 `RequireSession` 안에서만 서므로 세션 없는
   * 갈래에서 이 칸이 서면 로그아웃 옆이 아닌 자리에 선 것이다.
   */
  it('세션이 없으면 언어 선택도 없다', () => {
    renderLayout('본문 내용');

    expect(within(topbar()).queryByRole('combobox', { name: '언어' })).toBeNull();
  });
});

/**
 * 셸 치수 — **브라우저에서만 드러나는 두 어긋남**(#1077 · #1078).
 *
 * ⚠ **여기서 픽셀을 재지 않는다.** jsdom 은 레이아웃을 계산하지 않아 높이·폭을 물으면 0 을
 * 주고, `vitest.config.ts`가 `css: false`라 스타일도 도달하지 않는다. 그래서 이 감지기들은
 * **「배치를 정하는 것이 그 요소에 실렸는지」**만 본다 — 실린 값이 실제로 막는지는
 * `sidebar-sizing.test.ts`(CSS 원문)와 실측이 맡는다. 둘을 함께 두어야 닿는다.
 */
describe('AppLayout — 셸 치수', () => {
  /**
   * 섹션 밖 직계 항목은 목록이 넘칠 때 DS 가 절반 높이로 줄인다(design-system-v2-webui#103).
   *
   * ⭐ **이름으로 집지 않고 「섹션 밖 전부」를 잰다.** 지금 그 항목은 하나뿐이지만(「사이드바
   * 섹션이 아홉이고…」 감지기가 보증한다), 이름으로 집으면 **둘째 항목이 생기는 날 빠져나간다** —
   * 그 감지기는 `UNSECTIONED_LINKS`에 href 한 줄을 더하면 다시 초록이 되고, 새 항목은 표시가
   * 없어 브라우저에서만 찌그러진다. 규칙은 「섹션 밖 항목은 **전부** 이 표시를 단다」다.
   *
   * 섹션은 DS 가 `role="group"`으로 그린다 — 섹션 이름 목록을 여기서 되풀이하지 않는다.
   */
  it('섹션 밖 항목은 전부 줄어들지 않게 표시돼 있다', () => {
    renderLayout('본문 내용');

    const sidebar = screen.getByRole('navigation', { name: '주 메뉴' });
    const ungrouped = within(sidebar)
      .getAllByRole('link')
      .filter((link) => link.closest('[role="group"]') === null);

    /* ⛔ 섹션 밖 항목이 0개면 아래 단언은 아무것도 재지 않는다 — 빈 통과를 막는다. */
    expect(ungrouped.length).toBeGreaterThan(0);
    expect(ungrouped.filter((link) => !link.classList.contains('sidebar-lead'))).toEqual([]);
  });

  /**
   * ⛔ **접힘을 한쪽에만 맡기면 죽은 띠가 남는다.** 접힌 폭은 셸 격자의 사이드바 칸과 사이드바
   * 자신의 `width` 두 곳에서 정해진다. DS 는 둘이 각자 비제어 상태를 들고 있어, 배선하지 않으면
   * 사이드바만 72px 로 줄고 칸은 256px 로 남는다(실측 — 184px 빈 띠).
   *
   * 두 요소가 **같은 값**이 되는지를 본다. 한쪽만 배선하면 여기서 갈린다.
   */
  it('사이드바를 접으면 셸과 사이드바가 함께 접힌다', async () => {
    const { user } = renderLayout('본문 내용');

    /*
     * ⚠ **둘을 정체로 집는다.** `[data-collapsed]`를 한꺼번에 쓸어 모으면 개수에 묶여,
     * DS 가 그 표시를 한 군데 더 붙이는 날 동작이 멀쩡한데도 길이가 어긋나 헛경보가 난다.
     * 셸의 접힘은 접근성 속성으로 드러나지 않아 DS 내부 표시를 읽을 수밖에 없지만,
     * **어느 요소의 것인지**는 역할로 집을 수 있다.
     */
    const sidebar = screen.getByRole('navigation', { name: '주 메뉴' });
    const shell = screen.getByRole('main', { name: '본문' }).closest('[data-collapsed]');

    if (shell === null) throw new Error('셸의 접힘 표시를 찾지 못했습니다');

    const flags = (): Record<string, string | null> => ({
      셸: shell.getAttribute('data-collapsed'),
      사이드바: sidebar.getAttribute('data-collapsed'),
    });

    expect(flags()).toEqual({ 셸: 'false', 사이드바: 'false' });

    await user.click(screen.getByRole('button', { name: '사이드바 접기' }));

    expect(flags()).toEqual({ 셸: 'true', 사이드바: 'true' });

    await user.click(screen.getByRole('button', { name: '사이드바 펼치기' }));

    expect(flags()).toEqual({ 셸: 'false', 사이드바: 'false' });
  });
});

/**
 * 셸 — **묶음 접기**(#1079).
 *
 * ⭐ **이 묶음의 감지기들이 `renderLayout` 의 기본값을 떠받친다.** 하네스가 편의로 전부 펼치므로,
 * 접힘이 실제로 서는지는 **여기서만** 재진다 — `expandGroups: false` 로 부르는 것이 그 표시다.
 */
describe('AppLayout — 묶음 접기', () => {
  /**
   * 처음 열 때 보이는 것이 **묶음 8줄 + 섹션 밖 1개**다. 항목 44줄(탭을 펴면 화면 75개)이 한꺼번에 펼쳐져 있던 것이
   * 이 작업의 출발점이다.
   */
  it('처음에는 어느 묶음도 펼쳐져 있지 않다 — 현재 화면이 어느 묶음에도 없을 때', () => {
    renderLayout('본문 내용', { expandGroups: false });

    expect(within(navSidebar()).getAllByRole('group')).toHaveLength(8);
    /* 섹션 밖 항목 하나만 남는다 — 묶음 안 항목은 DOM 에 없다. */
    expect(within(navSidebar()).getAllByRole('link')).toHaveLength(1);
  });

  /**
   * ⛔ **닫힌 묶음의 항목은 감추는 것이 아니라 없다.** DS 사이드바의 화살표 키 순회가
   * `querySelectorAll('[data-sidebar-item]')` 로 돌기 때문에, 감추기만 하면 **보이지 않는 항목에
   * 초점이 간다.** 「보이지 않는다」가 아니라 「DOM 에 없다」를 잰다.
   */
  it('닫힌 묶음의 항목은 DOM 에 없다', () => {
    renderLayout('본문 내용', { expandGroups: false });

    /*
     * ⚠ **`queryByRole` 로 재지 않는다 — 그것은 접근성 트리를 본다.** `display: none` 으로 감춘
     * 항목은 `queryByRole` 에 잡히지 않아 **감추기만 해도 통과한다**(결함 재주입에서 드러났다).
     * 그런데 DS 사이드바의 화살표 키 순회는 `querySelectorAll('[data-sidebar-item]')` 로 돌아
     * **접근성 숨김을 보지 않는다** — 감춘 항목에 초점이 간다. 그 선택자를 그대로 써서 잰다.
     */
    expect(navSidebar().querySelectorAll('[data-sidebar-item]')).toHaveLength(1);
  });

  it('묶음을 누르면 펼쳐지고 다시 누르면 접힌다', async () => {
    const { user } = renderLayout('본문 내용', { expandGroups: false });

    await user.click(groupToggle('기준정보 관리'));

    expect(within(navSidebar()).getByRole('link', { name: '창고·위치' })).toBeInTheDocument();
    expect(groupToggle('기준정보 관리')).toHaveAttribute('aria-expanded', 'true');

    await user.click(groupToggle('기준정보 관리'));

    expect(within(navSidebar()).queryByRole('link', { name: '창고·위치' })).toBeNull();
    expect(groupToggle('기준정보 관리')).toHaveAttribute('aria-expanded', 'false');
  });

  /**
   * 다른 묶음은 **건드리지 않는다.** 한 묶음을 열 때 다른 것이 닫히면(아코디언) 두 업무를
   * 번갈아 보는 사람이 같은 묶음을 계속 다시 연다.
   */
  it('한 묶음을 열어도 다른 묶음은 그대로 닫혀 있다', async () => {
    const { user } = renderLayout('본문 내용', { expandGroups: false });

    await user.click(groupToggle('기준정보 관리'));

    expect(groupToggle('구매 / 자재 관리')).toHaveAttribute('aria-expanded', 'false');
  });

  /** 접힌 묶음은 이름만 남아, **안에 몇 개가 있는지**를 함께 보여야 누를지 말지 판단할 수 있다. */
  it('손잡이가 묶음의 화면 수를 알린다', () => {
    renderLayout('본문 내용', { expandGroups: false });

    /*
     * 「기준정보 관리」는 사이드바 줄 7개에 **화면 13개**다 — 손잡이는 「화면」을 세므로 탭 묶음은
     * 탭 수만큼 센다(설비 3 · 툴·금형 2 · 계측기 2 · 창고·위치 3 + 단독 3). `nav-tree.ts` 가 정본이다.
     */
    expect(groupToggle('기준정보 관리')).toHaveAccessibleName('기준정보 관리 (화면 13개)');
  });

  /*
   * 묶음 손잡이가 아이콘을 갖는다 — 항목이 아이콘 없이 서므로 **묶음을 눈으로 가르는 단서**가
   * 이것이다. 수는 접근명에만 싣고 눈으로는 그리지 않는다(`nav-group.tsx`).
   */
  it('손잡이가 묶음 아이콘을 그리고, 화면 수는 글자로 그리지 않는다', () => {
    renderLayout('본문 내용', { expandGroups: false });

    const toggle = groupToggle('기준정보 관리');
    expect(toggle.querySelector('.nav-group-icon')).toHaveTextContent('database');
    expect(toggle).not.toHaveTextContent('7');
  });
});

/**
 * 셸 — **화면 검색**(#1079).
 *
 * 검색은 **이름으로만** 찾는다. 주소를 섞으면 「출하」에 `/shipment/**` 가 통째로 걸려 아무것도
 * 좁히지 못하고, 섹션명을 섞으면 맞는 항목이 없는 묶음이 열린 채 선다(`nav-filter.ts`).
 */
describe('AppLayout — 화면 검색', () => {
  const searchBox = (): HTMLElement =>
    within(navSidebar()).getByRole('searchbox', { name: messages.shellNav.search.label });

  const visibleLinkNames = (): string[] =>
    within(navSidebar())
      .getAllByRole('link')
      .map((link) => link.textContent ?? '');

  it('이름의 일부를 치면 맞는 화면만 남는다', async () => {
    const { user } = renderLayout('본문 내용', { expandGroups: false });

    await user.type(searchBox(), '실사');

    /* 아이콘 리가처가 링크의 글자에 함께 들어오므로 이름이 **포함**되는지로 본다. */
    expect(visibleLinkNames().filter((name) => name.includes('재고실사'))).toHaveLength(1);
    expect(visibleLinkNames().filter((name) => name.includes('창고·위치'))).toHaveLength(0);
  });

  /**
   * ⭐ **맞는 묶음은 접혀 있어도 펼쳐진다.** 접힌 채로 두면 찾아 놓고도 보이지 않아 「결과 없음」과
   * 구별되지 않는다.
   */
  it('접힌 묶음 안에서 맞아도 보인다', async () => {
    const { user } = renderLayout('본문 내용', { expandGroups: false });

    expect(within(navSidebar()).queryByRole('link', { name: '재고 관리' })).toBeNull();

    await user.type(searchBox(), '실사');

    /* 탭 이름으로 걸렸으므로 묶음 이름을 앞에 단 탭 한 줄로 선다(`nav-filter.ts`). */
    expect(
      within(navSidebar()).getByRole('link', { name: '재고 관리 › 재고실사' }),
    ).toHaveAttribute('href', '/logistics/stocktaking');
  });

  /** 맞는 항목이 하나도 없는 묶음은 **이름도 서지 않는다** — 눌러도 빌 묶음을 남기지 않는다. */
  it('맞는 항목이 없는 묶음은 사라진다', async () => {
    const { user } = renderLayout('본문 내용', { expandGroups: false });

    await user.type(searchBox(), '실사');

    const groupNames = within(navSidebar())
      .getAllByRole('group')
      .map((group) => group.getAttribute('aria-label'));

    expect(groupNames).toEqual(['구매 / 자재 관리']);
  });

  /** 섹션 밖 항목도 검색 대상이다 — `NAV_GROUPS` 만 훑으면 이것이 조용히 빠진다. */
  it('섹션 밖 항목도 검색에 걸린다', async () => {
    const { user } = renderLayout('본문 내용', { expandGroups: false });

    await user.type(searchBox(), '대시보드');

    expect(within(navSidebar()).getByRole('link', { name: '통합 대시보드' })).toBeInTheDocument();
    expect(within(navSidebar()).queryAllByRole('group')).toHaveLength(0);
  });

  /** 검색어에 맞지 않으면 섹션 밖 항목도 **빠진다** — 늘 남으면 검색이 좁혀지지 않는다. */
  it('검색어에 맞지 않으면 섹션 밖 항목도 빠진다', async () => {
    const { user } = renderLayout('본문 내용', { expandGroups: false });

    await user.type(searchBox(), '실사');

    expect(within(navSidebar()).queryByRole('link', { name: '통합 대시보드' })).toBeNull();
  });

  /** ⛔ **빈 사이드바를 그대로 두지 않는다** — 통째로 비면 사람은 화면이 깨진 것으로 읽는다. */
  it('맞는 것이 하나도 없으면 그 사실을 말한다', async () => {
    const { user } = renderLayout('본문 내용', { expandGroups: false });

    await user.type(searchBox(), '있을 수 없는 화면 이름');

    expect(within(navSidebar()).getByText(messages.shellNav.search.empty)).toBeInTheDocument();
    expect(within(navSidebar()).queryAllByRole('link')).toHaveLength(0);
  });

  /**
   * ⭐ **검색어를 지우면 사람이 정해 둔 접힘 모양으로 돌아온다.** 검색이 접힘 상태를 덮어쓰면,
   * 찾아 들어갔다 나온 사람은 자기가 접어 둔 것이 전부 열린 화면을 보게 된다.
   */
  it('검색어를 지우면 그 전 접힘 상태로 돌아온다', async () => {
    const { user } = renderLayout('본문 내용', { expandGroups: false });

    await user.click(groupToggle('기준정보 관리'));
    expect(within(navSidebar()).getByRole('link', { name: '창고·위치' })).toBeInTheDocument();

    await user.type(searchBox(), '실사');
    await user.clear(searchBox());

    /* 기준정보 관리는 내가 열어 둔 채로, 구매 / 자재 관리는 닫힌 채로 돌아와야 한다. */
    expect(within(navSidebar()).getByRole('link', { name: '창고·위치' })).toBeInTheDocument();
    expect(within(navSidebar()).queryByRole('link', { name: '재고 관리' })).toBeNull();
  });

  /** 대소문자를 고른다 — 라벨에 `IQC`·`P/O` 처럼 영문이 섞여 있어 고르지 않으면 못 찾는다. */
  it('영문 이름은 대소문자를 가리지 않는다', async () => {
    const { user } = renderLayout('본문 내용', { expandGroups: false });

    await user.type(searchBox(), 'iqc');

    expect(
      within(navSidebar()).getByRole('link', { name: 'IQC (수입검사) 조회·판정' }),
    ).toBeInTheDocument();
  });
});

/**
 * 셸 — **들어온 화면의 묶음은 열려 있다**(#1079).
 *
 * ⭐ **주소로 들어오는 길이 있다.** 링크를 받았거나 새로 고쳤거나 가드가 돌려보냈을 때, 지금 보고
 * 있는 화면이 **접힌 묶음 안**이면 사이드바에 자기 위치가 보이지 않는다.
 */
describe('AppLayout — 현재 묶음', () => {
  it('들어온 화면이 속한 묶음은 처음부터 펼쳐져 있다', () => {
    renderLayout('본문 내용', { expandGroups: false, route: '/logistics/stocktaking' });

    expect(groupToggle('구매 / 자재 관리')).toHaveAttribute('aria-expanded', 'true');
    expect(within(navSidebar()).getByRole('link', { name: '재고 관리' })).toBeInTheDocument();
  });

  /** 다른 묶음은 여전히 접혀 있다 — 하나가 열리는 것이 전부 열리는 것이 되면 소용이 없다. */
  it('다른 묶음은 그대로 접혀 있다', () => {
    renderLayout('본문 내용', { expandGroups: false, route: '/logistics/stocktaking' });

    expect(groupToggle('기준정보 관리')).toHaveAttribute('aria-expanded', 'false');
  });

  /**
   * ⛔ **현재 묶음을 「늘 열림」으로 계산하지 않는다.** 그러면 지금 보고 있는 묶음을 **접을 수
   * 없다** — 접어도 다음 렌더에 다시 열린다. 들어올 때 한 번 열어 주고 그 뒤는 사람이 정한다.
   */
  it('현재 묶음도 접을 수 있다', async () => {
    const { user } = renderLayout('본문 내용', {
      expandGroups: false,
      route: '/logistics/stocktaking',
    });

    await user.click(groupToggle('구매 / 자재 관리'));

    expect(groupToggle('구매 / 자재 관리')).toHaveAttribute('aria-expanded', 'false');
    expect(within(navSidebar()).queryByRole('link', { name: '재고 관리' })).toBeNull();
  });
});

/**
 * 셸 — **레일(아이콘 전용)에서는 접기와 검색을 두지 않는다**(#1079).
 *
 * 72px 에 입력칸이 들어가지 않고, 들어간다 해도 결과가 아이콘만 남아 **무엇이 걸렸는지 읽을 수
 * 없다.** 접기 손잡이도 누를 이름이 없다 — DS 가 그 상태의 섹션 라벨을 접근명으로만 남긴다.
 */
describe('AppLayout — 레일', () => {
  const collapseRail = async (user: UserEvent): Promise<void> => {
    await user.click(screen.getByRole('button', { name: '사이드바 접기' }));
  };

  it('레일에서는 검색창이 없다', async () => {
    const { user } = renderLayout('본문 내용', { expandGroups: false });

    await collapseRail(user);

    expect(
      within(navSidebar()).queryByRole('searchbox', { name: messages.shellNav.search.label }),
    ).toBeNull();
  });

  /** ⛔ **레일에서 항목을 감추지 않는다.** 아이콘만이라도 **전부** 서야 누를 수 있다. */
  it('레일에서는 항목이 전부 선다', async () => {
    const { user } = renderLayout('본문 내용', { expandGroups: false });

    await collapseRail(user);

    expect(within(navSidebar()).getAllByRole('link')).toHaveLength(49);
  });

  /*
   * 묶음 아래 항목의 모양(아이콘 없이 들여 쓰고 세로 안내선에 매단다 — `app.css` `.nav-child`)은
   * **펼친 사이드바에서만** 붙는다. 레일에서 붙으면 아이콘이 감춰져 72px 폭에 빈칸만 선다.
   */
  it('펼친 사이드바의 묶음 항목은 `nav-child` 로 서고, 레일에서는 붙지 않는다', async () => {
    const { user } = renderLayout('본문 내용');

    const link = within(navSidebar()).getByRole('link', { name: '재고 관리' });
    expect(link).toHaveClass('nav-child');
    /* 섹션 밖 맨 위 항목은 묶음 아래가 아니다 — 아이콘을 그대로 둔다. */
    expect(within(navSidebar()).getByRole('link', { name: '통합 대시보드' })).not.toHaveClass(
      'nav-child',
    );

    await collapseRail(user);

    expect(within(navSidebar()).getByRole('link', { name: '재고 관리' })).not.toHaveClass(
      'nav-child',
    );
  });
});

/**
 * 셸 — **레일에서는 검색어가 없는 것과 같이 그린다**(#1079 검토).
 *
 * ⛔ **판정이 갈리는 것을 막는다.** 레일에는 검색창이 없으므로(지울 수단이 없다) 검색어가 남아
 * 있으면 **절반만 걸린 사이드바**가 된다 — 항목은 전부 서는데 섹션 밖 항목만 사라지고, 맞는 것이
 * 없으면 72px 레일에 안내 문단이 아이콘들과 나란히 선다.
 */
describe('AppLayout — 레일과 검색', () => {
  const collapseRail = async (user: UserEvent): Promise<void> => {
    await user.click(screen.getByRole('button', { name: '사이드바 접기' }));
  };

  const typeQuery = async (user: UserEvent, value: string): Promise<void> => {
    await user.type(
      within(navSidebar()).getByRole('searchbox', { name: messages.shellNav.search.label }),
      value,
    );
  };

  it('검색어가 걸린 채 접어도 항목이 전부 선다', async () => {
    const { user } = renderLayout('본문 내용', { expandGroups: false });

    await typeQuery(user, '실사');
    await collapseRail(user);

    expect(within(navSidebar()).getAllByRole('link')).toHaveLength(49);
  });

  /** 섹션 밖 항목이 빠지면 레일에서 대시보드로 갈 길이 사라진다. */
  it('검색어가 걸린 채 접어도 섹션 밖 항목이 남는다', async () => {
    const { user } = renderLayout('본문 내용', { expandGroups: false });

    await typeQuery(user, '실사');
    await collapseRail(user);

    expect(within(navSidebar()).getByRole('link', { name: '통합 대시보드' })).toBeInTheDocument();
  });

  it('레일에서는 빈 결과 안내가 서지 않는다', async () => {
    const { user } = renderLayout('본문 내용', { expandGroups: false });

    await typeQuery(user, '있을 수 없는 화면 이름');
    await collapseRail(user);

    expect(within(navSidebar()).queryByText(messages.shellNav.search.empty)).toBeNull();
  });
});

/**
 * 셸 — **검색 중 손잡이는 거짓말하지 않는다**(#1079 검토).
 *
 * ⛔ 검색 중에는 맞는 묶음을 강제로 펼치므로 손잡이를 눌러도 화면이 바뀌지 않는다. 그런데 누름이
 * 접힘 상태를 **조용히 뒤집으면** 그 결과가 검색어를 지운 뒤에야 드러난다 — 「접기」를 눌렀는데
 * 열려 있거나, 열어 둔 것이 닫혀 있다. 상태를 거짓으로 알리는 컨트롤을 두지 않는다.
 */
describe('AppLayout — 검색 중 손잡이', () => {
  const typeQuery = async (user: UserEvent, value: string): Promise<void> => {
    await user.type(
      within(navSidebar()).getByRole('searchbox', { name: messages.shellNav.search.label }),
      value,
    );
  };

  it('검색 중에는 손잡이를 누를 수 없다', async () => {
    const { user } = renderLayout('본문 내용', { expandGroups: false });

    await typeQuery(user, '실사');

    expect(groupToggle('구매 / 자재 관리')).toBeDisabled();
  });

  /** 누를 수 없으니 접힘 상태도 뒤집히지 않는다 — 지운 뒤 내가 둔 모양 그대로다. */
  it('검색 중 손잡이를 눌러도 접힘 상태가 뒤집히지 않는다', async () => {
    const { user } = renderLayout('본문 내용', { expandGroups: false });

    await user.click(groupToggle('기준정보 관리'));
    expect(groupToggle('기준정보 관리')).toHaveAttribute('aria-expanded', 'true');

    await typeQuery(user, '규칙');
    await user.click(groupToggle('기준정보 관리')).catch(() => undefined);
    await user.clear(
      within(navSidebar()).getByRole('searchbox', { name: messages.shellNav.search.label }),
    );

    expect(groupToggle('기준정보 관리')).toHaveAttribute('aria-expanded', 'true');
  });
});

/**
 * 셸 — **탑바 시스템 이름 옆의 버전 뱃지**(#1320 · 본디 #1240 이 사이드바에 두었다).
 *
 * 값은 릴리스 파이프라인이 넣는 빌드 인자다(`VITE_APP_VERSION`). 시험 실행에는 그 값이 없으므로
 * 릴리스 모양은 `vi.stubEnv` 로 세운다.
 */
describe('AppLayout — 버전 표기', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  /**
   * ⛔ **보이는 글자에 「버전」을 붙이지 않는다** — 이름 옆이라 자리가 좁고 `v0.3.8` 은 그대로 읽힌다.
   *    다만 **읽어 주는 이름에는 붙는다**: 숫자만 들으면 무엇의 값인지 모른다.
   */
  it('릴리스 빌드면 태그의 버전을 뱃지로 보이고, 읽어 주는 이름에 무엇인지 적는다', () => {
    vi.stubEnv('VITE_APP_VERSION', 'web-v0.3.8');

    renderLayout('본문 내용', { expandGroups: false });

    const badge = screen.getByLabelText(messages.shellNav.version.release('v0.3.8'));
    expect(badge).toHaveTextContent('v0.3.8');
  });

  /** ⛔ 빈칸이나 「알 수 없음」을 세우지 않는다(공유계약 G-9). */
  it('릴리스 태그가 없는 빌드면 개발 빌드로 말한다', () => {
    vi.stubEnv('VITE_APP_VERSION', '');

    renderLayout('본문 내용', { expandGroups: false });

    expect(screen.getByText(messages.shellNav.version.dev)).toBeInTheDocument();
  });

  /**
   * ⭐ **이 시험이 옮긴 이유 그 자체다.** 사이드바 맨 아래에 있던 동안에는 접으면 사라져,
   *    확인하려는 사람이 펼쳐야 했다. 탑바는 접힘과 무관하게 선다.
   */
  /** ⛔ 뱃지는 **시스템 이름과 같은 줄**에 있어야 한다 — 떨어져 있으면 무엇의 버전인지 흐려진다. */
  it('뱃지가 시스템 이름과 한 줄에 선다', () => {
    vi.stubEnv('VITE_APP_VERSION', 'web-v0.3.8');

    renderLayout('본문 내용', { expandGroups: false });

    const badge = screen.getByLabelText(messages.shellNav.version.release('v0.3.8'));
    const brandLine = badge.closest('.topbar-brand');

    expect(brandLine).not.toBeNull();
    expect(brandLine?.textContent).toContain('v0.3.8');
  });

  it('사이드바를 접어도 버전이 그대로 보인다', async () => {
    vi.stubEnv('VITE_APP_VERSION', 'web-v0.3.8');
    const label = messages.shellNav.version.release('v0.3.8');

    const { user } = renderLayout('본문 내용', { expandGroups: false });

    await user.click(screen.getByRole('button', { name: '사이드바 접기' }));
    expect(screen.getByLabelText(label)).toBeInTheDocument();
  });
});

/**
 * 사이드바를 **로그인한 사람의 기능 권한으로 거른다**(#1293).
 *
 * 세션이 권한 코드를 그대로 내려주고(`Session.permissions`), 그 값이 **설계 화면 코드와 1:1**
 * 이다 — 주소와 코드를 잇는 대응표는 `patterns/web-screen-catalog.ts` 가 갖는다.
 *
 * ⚠ 위 감지기들이 쓰는 세션 픽스처에는 `permissions` 가 **없다**(「모른다」). 그래서 차례·경로를
 * 재는 30여 건은 종전대로 전건을 보고, 거르는 동작은 이 구역이 따로 잰다.
 */
describe('셸 — 기능 권한으로 사이드바 거르기', () => {
  const SignInWithPermissions = ({ permissions }: { permissions?: string[] }) => {
    const { signIn } = useSession();

    return (
      <button
        type="button"
        onClick={() => {
          signIn(
            permissions === undefined ? sessionFixture() : { ...sessionFixture(), permissions },
          );
        }}
      >
        권한 담기
      </button>
    );
  };

  /**
   * ⚠ **`route` 를 주면 묶음을 펼치지 않는다.** 그 주소의 묶음은 셸이 처음부터 펼치고, 권한으로
   * 걸러 묶음이 그것 하나만 남으면 펼칠 것이 없어 `expandAllNavGroups` 가 (옳게) 운다. 남는 묶음이
   * 하나도 없을 때도 같다(`expandGroups: false`).
   */
  const renderWithPermissions = async (
    permissions?: string[],
    options: { route?: string; expandGroups?: boolean } = {},
  ) => {
    const { route } = options;
    const user = userEvent.setup();

    renderWithProviders(
      <SessionProvider>
        <SignInWithPermissions {...(permissions === undefined ? {} : { permissions })} />
        <AppLayout>본문 내용</AppLayout>
      </SessionProvider>,
      { session: null, ...(route === undefined ? {} : { route }) },
    );

    await user.click(screen.getByRole('button', { name: '권한 담기' }));
    if (options.expandGroups ?? route === undefined) expandAllNavGroups();

    return { user };
  };

  /**
   * 메뉴 항목의 **보이는 이름**. 항목 글자에는 아이콘 리가처가 앞에 붙으므로(`dashboard통합 …`)
   * 끝으로 견준다 — 리가처까지 적으면 아이콘을 바꿀 때마다 시험이 깨진다.
   */
  const hasMenu = (label: string): boolean =>
    within(navSidebar())
      .getAllByRole('link')
      .some((link) => (link.textContent ?? '').endsWith(label));

  it('가진 권한의 화면만 메뉴에 선다', async () => {
    await renderWithPermissions(['W-CO-02']);

    expect(hasMenu('사용자·역할·권한')).toBe(true);
    expect(hasMenu('창고·위치')).toBe(false);
  });

  /** 항목이 하나도 남지 않은 묶음은 제목만 남는다 — 빼야 한다. */
  it('남은 항목이 없는 묶음은 통째로 빠진다', async () => {
    await renderWithPermissions(['W-CO-02']);

    expect(within(navSidebar()).queryByText('기준정보 관리')).toBeNull();
  });

  /**
   * ⛔ **막으면 되돌릴 수 없는 자리 둘.** 대시보드는 로그인이 착지하는 곳이고, 비밀번호 변경은
   * 자기 계정 화면이라 막으면 본인이 비밀번호를 바꿀 길이 없다. 비밀번호 변경은 이제 사이드바가
   * 아니라 **상단 바**에 서고, 상단 바는 권한 판정 없이 늘 선다.
   */
  it('권한이 하나도 없어도 대시보드가 메뉴에 남고 비밀번호 변경은 상단 바에 남는다', async () => {
    await renderWithPermissions([], { expandGroups: false });

    expect(hasMenu('통합 대시보드')).toBe(true);
    expect(
      within(topbar()).getByRole('link', { name: messages.session.actions.changePassword }),
    ).toHaveAttribute('href', '/system/password-change');
    expect(hasMenu('사용자·역할·권한')).toBe(false);
  });

  /**
   * ⚠ **「모른다」를 「없다」로 다루지 않는다.** 계약이 「필드가 없으면 값 목록이 아직 정해지지
   * 않았다는 뜻」이라고 갈라 두었다 — 같게 다루면 목록을 못 받은 세션이 텅 빈 메뉴를 본다.
   */
  it('세션이 권한 목록을 주지 않으면 거르지 않는다', async () => {
    await renderWithPermissions();

    expect(hasMenu('사용자·역할·권한')).toBe(true);
    expect(hasMenu('창고·위치')).toBe(true);
  });

  /**
   * 검색은 「무엇을 찾는가」이고 권한은 「무엇을 볼 수 있는가」다. 권한으로 먼저 거르지 않으면
   * **볼 수 없는 항목이 검색으로 되살아난다.**
   */
  it('검색해도 볼 수 없는 항목은 나오지 않는다', async () => {
    const { user } = await renderWithPermissions(['W-CO-02']);

    await user.type(screen.getByRole('searchbox', { name: '화면 검색' }), '창고');

    expect(within(navSidebar()).queryByText('창고·위치')).toBeNull();
    expect(within(navSidebar()).queryByText('창고·Location')).toBeNull();
    expect(screen.getByText(messages.shellNav.search.empty)).toBeInTheDocument();
  });

  /**
   * ⭐ **탭 묶음은 볼 수 있는 탭만 남기고 그 첫 탭으로 건다.** 첫 탭(창고·Location · W-06-07)을
   * 못 보는 사람에게 묶음 주소를 그대로 걸면 누르는 순간 막힌 화면이 선다.
   */
  it('탭 묶음의 첫 탭을 볼 수 없으면 묶음 줄이 볼 수 있는 첫 탭을 건다', async () => {
    await renderWithPermissions(['W-06-14', 'W-CO-08']);

    expect(within(navSidebar()).getByRole('link', { name: '창고·위치' })).toHaveAttribute(
      'href',
      '/master-data/putaway-rule',
    );
  });

  /** 탭 막대에도 볼 수 없는 탭은 서지 않는다 — 누르는 순간 막힌 화면이 서는 탭을 두지 않는다. */
  it('탭 막대에는 볼 수 있는 탭만 선다', async () => {
    await renderWithPermissions(['W-06-14', 'W-CO-08'], { route: '/master-data/putaway-rule' });

    expect(hubTabHrefsOf('창고·위치')).toEqual([
      '/master-data/putaway-rule',
      '/master-data/warehouse-layout',
    ]);
  });

  /**
   * 볼 수 있는 탭이 **하나뿐이면 탭 막대를 세우지 않는다** — 오갈 곳이 없는 막대가 화면 제목 위에
   * 한 줄을 먹는다. 묶음 줄은 그 한 탭을 건 채 남는다.
   */
  it('볼 수 있는 탭이 하나뿐이면 탭 막대가 서지 않는다', async () => {
    await renderWithPermissions(['W-06-14'], { route: '/master-data/putaway-rule' });

    /* 짝 양성 — 묶음 줄은 남아 그 한 탭을 건다. */
    expect(within(navSidebar()).getByRole('link', { name: '창고·위치' })).toHaveAttribute(
      'href',
      '/master-data/putaway-rule',
    );
    expect(screen.queryByRole('navigation', { name: '창고·위치' })).toBeNull();
  });

  /** 탭이 하나도 남지 않은 묶음은 줄째 빠진다 — 누를 곳이 없는 줄을 세우지 않는다. */
  it('볼 수 있는 탭이 없는 탭 묶음은 메뉴에서 빠진다', async () => {
    await renderWithPermissions(['W-06-01']);

    /* 짝 양성 — 같은 섹션의 다른 항목은 서 있다(섹션째 빠진 것이 아니다). */
    expect(within(navSidebar()).getByText('기준정보 관리')).toBeInTheDocument();
    expect(hasMenu('창고·위치')).toBe(false);
  });
});

/** 탭 막대의 주소를 보이는 차례대로 읽는다(`hub-tabs.tsx` — 묶음 이름을 접근명으로 가진 `navigation`). */
const hubTabHrefsOf = (hubLabel: string): (string | null)[] =>
  within(screen.getByRole('navigation', { name: hubLabel }))
    .getAllByRole('link')
    .map((link) => link.getAttribute('href'));

/**
 * 셸 — **탭 묶음의 탭 막대**(`hub-tabs.tsx`).
 *
 * 짝을 이루는 화면 여럿이 사이드바 한 줄로 서고, 그 안의 화면은 본문 위 탭 막대로 오간다. 탭은
 * **주소**다 — 링크 목록이고 지금 화면은 `aria-current="page"` 로 알린다(사이드바 항목과 같은 말).
 */
describe('AppLayout — 탭 막대', () => {
  it('탭 묶음 안 화면에서는 본문 위에 그 묶음의 탭 막대가 서고 지금 탭이 표시된다', () => {
    renderLayout('본문 내용', { route: '/equipment/work-calendar' });

    const tabs = screen.getByRole('navigation', { name: '설비' });
    const links = within(tabs).getAllByRole('link');

    expect(links.map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['설비·설비그룹 마스터', '/equipment/master'],
      ['작업 캘린더 설정', '/equipment/work-calendar'],
      ['수집 채널 매핑 관리', '/equipment/collection-channels'],
    ]);
    /* 지금 화면의 탭 **하나만** 표시된다. */
    expect(links.map((link) => link.getAttribute('aria-current'))).toEqual([null, 'page', null]);
    /* 셸이 본문 자리에 그린다 — 사이드바 안이 아니다. */
    expect(within(screen.getByRole('main')).getByRole('navigation', { name: '설비' })).toBe(tabs);
  });

  /** 탭 막대는 묶음 안 화면의 것이다 — 묶음이 아닌 화면 위에 한 줄을 먹지 않는다. */
  it('탭 묶음이 아닌 화면에서는 탭 막대가 서지 않는다', () => {
    renderLayout('본문 내용', { route: '/master-data/routing' });

    /* 짝 양성 — 본문은 섰다. */
    expect(within(screen.getByRole('main')).getByText('본문 내용')).toBeInTheDocument();
    expect(within(screen.getByRole('main')).queryAllByRole('navigation')).toEqual([]);
  });

  /**
   * ⭐ **묶음 줄은 어느 탭을 보고 있든 켜진다.** 둘째 탭으로 옮겨 갔는데 사이드바에서 자기 자리가
   * 꺼지면, 사람은 지금 어느 묶음에 있는지를 잃는다.
   */
  it('묶음의 둘째 탭 화면에서도 사이드바의 묶음 줄이 지금 자리로 표시된다', () => {
    renderLayout('본문 내용', { route: '/equipment/work-calendar' });

    expect(within(navSidebar()).getByRole('link', { name: '설비' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    /* 다른 묶음 줄은 꺼져 있다 — 전부 켜지는 것이 아니다. */
    expect(within(navSidebar()).getByRole('link', { name: '툴·금형' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  /** 들어온 화면이 묶음의 둘째 탭이어도 그 묶음이 든 섹션은 처음부터 펼쳐져 있다. */
  it('묶음의 둘째 탭으로 들어오면 그 섹션이 처음부터 펼쳐져 있다', () => {
    renderLayout('본문 내용', { expandGroups: false, route: '/logistics/stocktaking' });

    expect(groupToggle('구매 / 자재 관리')).toHaveAttribute('aria-expanded', 'true');
    expect(within(navSidebar()).getByRole('link', { name: '재고 관리' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  /** 탭은 주소다 — 누르면 그 화면으로 옮기고, 표시가 따라 옮긴다. 묶음 줄은 그대로 켜져 있다. */
  it('탭을 누르면 그 화면으로 옮기고 지금 탭 표시가 따라온다', async () => {
    const { user } = renderLayout('본문 내용', { route: '/equipment/master' });

    const tabs = screen.getByRole('navigation', { name: '설비' });

    await user.click(within(tabs).getByRole('link', { name: '수집 채널 매핑 관리' }));

    expect(within(tabs).getByRole('link', { name: '수집 채널 매핑 관리' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(tabs).getByRole('link', { name: '설비·설비그룹 마스터' })).not.toHaveAttribute(
      'aria-current',
    );
    expect(within(navSidebar()).getByRole('link', { name: '설비' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  /** 사이드바의 묶음 줄을 누르면 **첫 탭**에 닿는다(`nav-tree.ts` — 묶음의 `to` 는 첫 탭이다). */
  it('사이드바의 묶음 줄을 누르면 첫 탭 화면에 들어가 탭 막대가 선다', async () => {
    const { user } = renderLayout('본문 내용');

    expect(screen.queryByRole('navigation', { name: '툴·금형' })).toBeNull();

    await user.click(within(navSidebar()).getByRole('link', { name: '툴·금형' }));

    const tabs = screen.getByRole('navigation', { name: '툴·금형' });

    expect(within(tabs).getByRole('link', { name: '툴/금형/지그 마스터' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(hubTabHrefsOf('툴·금형')).toEqual([
      '/equipment/tool-master',
      '/equipment/shot-conversion',
    ]);
  });
});

/**
 * 셸 — **탭 묶음과 화면 검색**(`nav-filter.ts`).
 *
 * 「타발수」를 치는 사람은 그 화면이 「툴·금형」 묶음에 들어간 것을 모른다 — 탭 이름으로도 찾고,
 * 걸린 **탭**을 세운다(묶음 이름만 서면 걸린 글자가 화면에 없어 왜 걸렸는지 읽을 수 없다).
 */
describe('AppLayout — 탭 묶음 검색', () => {
  const searchBox = (): HTMLElement =>
    within(navSidebar()).getByRole('searchbox', { name: messages.shellNav.search.label });

  it('탭 이름으로 찾으면 걸린 탭이 제 주소로 선다', async () => {
    const { user } = renderLayout('본문 내용', { expandGroups: false });

    await user.type(searchBox(), '타발수');

    /* 펼친 탭은 「묶음 › 탭」으로 선다 — 탭 이름만으로는 묶음 밖에서 무엇인지 모른다. */
    expect(
      within(navSidebar()).getByRole('link', { name: '툴·금형 › 타발수 환산 파라미터 설정' }),
    ).toHaveAttribute('href', '/equipment/shot-conversion');
    /* 묶음 줄도, 걸리지 않은 형제 탭도 서지 않는다. */
    expect(within(navSidebar()).queryByRole('link', { name: '툴·금형' })).toBeNull();
    expect(within(navSidebar()).queryByRole('link', { name: '툴/금형/지그 마스터' })).toBeNull();
  });

  /*
   * 같은 이름의 탭이 다른 묶음 이름과 겹쳐도 검색 결과에서 갈린다 — 생산 관리의 「ERP W/O」 묶음과
   * ERP 연동 현황·이력의 「ERP W/O」 탭이 같은 글자의 두 줄로 서지 않는다.
   */
  it('같은 이름의 묶음과 탭이 검색 결과에서 묶음 이름으로 갈린다', async () => {
    const { user } = renderLayout('본문 내용', { expandGroups: false });

    await user.type(searchBox(), 'ERP W/O');

    expect(within(navSidebar()).getByRole('link', { name: 'ERP W/O' })).toHaveAttribute(
      'href',
      '/production/production-orders',
    );
    expect(
      within(navSidebar()).getByRole('link', { name: 'ERP 연동 현황·이력 › ERP W/O' }),
    ).toHaveAttribute('href', '/system/erp-data/production-orders');
  });

  it('묶음 이름으로 찾으면 묶음 줄이 그대로 선다', async () => {
    const { user } = renderLayout('본문 내용', { expandGroups: false });

    await user.type(searchBox(), '툴·금형');

    expect(within(navSidebar()).getByRole('link', { name: '툴·금형' })).toHaveAttribute(
      'href',
      '/equipment/tool-master',
    );
    expect(within(navSidebar()).queryByRole('link', { name: '툴/금형/지그 마스터' })).toBeNull();
  });
});

/**
 * 셸 — **상단 바의 비밀번호 변경**(W-CO-10 · 사용자 2026-10-20).
 *
 * 누구나 자기 것을 바꾸는 자리라 「지금 누구로 있는가」 바로 옆이 맞고, 상단 바는 권한 판정 없이
 * 늘 서므로 관리자가 아닌 사용자도 바꿀 길이 남는다.
 */
describe('AppLayout — 상단 바의 비밀번호 변경', () => {
  it('세션이 있으면 이름 옆에 비밀번호 변경 링크가 선다', async () => {
    const { user } = renderLayout('본문 내용');

    await user.click(screen.getByRole('button', { name: '세션 담기' }));

    const actions = within(topbar()).getByText(SYNTHETIC_USER_NAME).parentElement;

    if (actions === null) throw new Error('이름을 담은 자리를 찾지 못했습니다');

    expect(
      within(actions).getByRole('link', { name: messages.session.actions.changePassword }),
    ).toHaveAttribute('href', '/system/password-change');
    /* 사이드바에는 없다 — 같은 길을 두 자리에 두지 않는다. */
    expect(
      within(navSidebar()).queryByRole('link', { name: messages.session.actions.changePassword }),
    ).toBeNull();
  });

  it('비밀번호 변경 링크를 누르면 그 화면 주소로 간다', async () => {
    const { user } = renderLayout('본문 내용', { route: '/dashboard' });

    await user.click(screen.getByRole('button', { name: '세션 담기' }));
    await user.click(
      within(topbar()).getByRole('link', { name: messages.session.actions.changePassword }),
    );

    /* 셸이 주소를 읽어 대시보드 줄을 끈다 — 주소가 실제로 옮겨 갔다는 표시다. */
    expect(within(navSidebar()).getByRole('link', { name: '통합 대시보드' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  /** 세션이 없으면 이름 자리를 비우는 것과 같은 까닭으로 이 링크도 서지 않는다. */
  it('세션이 없으면 비밀번호 변경 링크도 없다', () => {
    renderLayout('본문 내용');

    expect(
      within(topbar()).queryByRole('link', { name: messages.session.actions.changePassword }),
    ).toBeNull();
  });
});
