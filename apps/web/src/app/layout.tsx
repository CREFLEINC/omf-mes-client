import { AppShell, Button, Sidebar, SidebarItem, SidebarSection, Topbar } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState, type ReactNode } from 'react';
import { useHref, useLinkClickHandler, useLocation } from 'react-router';

import { useSession, useSignOut } from '../patterns/session';
import { NAV_GROUPS, NAV_LEAD } from './nav-tree';

interface NavItemProps {
  to: string;
  icon: string;
  children: ReactNode;
  /**
   * DS 항목 요소에 그대로 실리는 앱 소유 클래스.
   *
   * ⭐ **갈래를 하나로 못 박는다.** 지금 합법인 값이 하나뿐이어서가 아니라, 이 자리가
   * 서식을 덮는 문으로 자라지 않게 하려는 것이다 — 서식은 DS 가 정하고, 덮기 시작하면
   * 메뉴 항목의 모양이 두 곳에서 정해진다. 배치를 바로잡는 우회만 여기로 들어온다(#1077).
   *
   * ⚠ 상류(design-system-v2-webui#103)가 반영돼 우회를 걷어내는 날, 이 타입이 남은
   * 사용처를 `typecheck` 에서 짚어 준다. 넓은 `string` 이면 조용히 남는다.
   */
  className?: 'sidebar-lead';
}

/**
 * DS `SidebarItem`을 라우터에 잇는 어댑터.
 * `href`는 `useHref`로 만들고, 클릭은 `useLinkClickHandler`로 가로채 전체 새로고침 없이 이동한다.
 */
const NavItem = ({ to, icon, children, className }: NavItemProps) => {
  const href = useHref(to);
  const handleClick = useLinkClickHandler(to);
  const location = useLocation();
  const isActive = location.pathname === to || location.pathname.startsWith(`${to}/`);

  return (
    <SidebarItem
      icon={icon}
      href={href}
      active={isActive}
      onClick={handleClick}
      className={className}
    >
      {children}
    </SidebarItem>
  );
};

interface AppLayoutProps {
  children: ReactNode;
}

/**
 * 상단 바 오른쪽 — **누구로 있는가와 나가는 길**.
 *
 * ⭐ **이름 없이 로그아웃만 두지 않는다.** 사무실에서 여럿이 번갈아 쓰는 화면이라, 나가기 전에
 * **지금 누구로 있는지**를 같은 자리에서 확인할 수 있어야 한다.
 *
 * ⚠ **나가는 중에는 잠근다.** 연타가 그대로 요청 두 벌이 되고, 계약이 쓰기마다 새 멱등 키를
 * 요구하므로 서버에는 서로 다른 요청으로 보인다.
 */
const SessionActions = ({ userName }: { userName: string }) => {
  const { signOut, isSigningOut } = useSignOut();

  return (
    <div className="topbar-session">
      <span>{userName}</span>
      <Button variant="text" size="sm" onClick={signOut} disabled={isSigningOut}>
        {messages.session.actions.signOut}
      </Button>
    </div>
  );
};

/**
 * 관리웹 셸.
 *
 * **상단 바 오른쪽에 로그인 사용자의 이름과 로그아웃을 보인다.** 세션이 없으면 그 자리를
 * **비운다** — 「알 수 없음」류의 글자를 두지 않는다(공유계약 G-9: 모르는 값과 없는 값을 같은
 * 모양으로 그리지 않는다).
 *
 * ⚠ **이 셸은 `RequireSession` 안에서만 선다**(`routes/index.tsx`). 그래도 세션 없는 갈래를
 * 지우지 않는 것은, 이 파일이 그 사실을 강제할 수 없어서다 — 가드 밖에서 쓰이는 날
 * 「알 수 없음」이 그려지는 것보다 **비는 편**이 낫다.
 *
 * ⛔ 귀속(사업부·공장)은 그리지 않는다 — 계약이 정수 ID만 주고 이름을 주지 않아, 사람이 읽을
 * 값을 만들려면 셸이 기준정보 조회를 지게 된다. 값 자체는 세션에 그대로 실려 있다.
 *
 * **메뉴의 차례와 묶음은 `nav-tree.ts` 가 갖는다**(#1079). 이 파일은 그것을 그리는 일만 한다 —
 * 화면 검색과 섹션 접기가 같은 목록을 훑어야 해서, 트리를 JSX 로 두면 훑을 대상이 없다.
 * 항목을 더하거나 옮기는 일은 저기서 하고, **배치 근거도 저기에 적는다.**
 */
export const AppLayout = ({ children }: AppLayoutProps) => {
  const { session } = useSession();

  /**
   * 사이드바 접힘 — **한 곳에서 정해 양쪽에 내린다**(#1078).
   *
   * ⛔ **어느 한쪽에만 맡기지 않는다.** 접힌 폭은 셸 격자의 사이드바 칸과 사이드바 자신의
   * `width` 두 곳에서 정해진다. DS 는 둘이 **각자 비제어 상태**를 들고 있어, 배선하지 않으면
   * 접기 버튼이 사이드바만 72px 로 줄이고 칸은 256px 로 남아 **184px 죽은 띠**가 생긴다(실측).
   *
   * ⚠ **결정 지점이 하나 더 있고 이 배선 밖이다.** DS 에 `@media (width <= 768px)` 규칙이
   * 있어 그 폭에서는 칸이 `data-collapsed` 와 **무관하게** 72px 로 고정된다 — 펼친 상태의
   * 사이드바 256px 가 칸을 184px 넘어 잘린다(768px 실측 · 이 배선과 별개의 결함 #1085).
   * 여기서 고치지 않은 것은 그 구간의 의도(좁은 화면에서는 레일로 쓴다)가 DS 쪽에 있고,
   * 제품이 브레이크포인트를 제 손으로 읽기 시작하면 접힘의 주인이 둘로 갈리기 때문이다.
   */
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  return (
    <AppShell
      mainLabel="본문"
      collapsed={isSidebarCollapsed}
      onCollapsedChange={setIsSidebarCollapsed}
      topbar={
        <Topbar
          brand={<strong>OMF-MES 관리웹</strong>}
          actions={session === null ? undefined : <SessionActions userName={session.userName} />}
        />
      }
      sidebar={
        <Sidebar
          aria-label="주 메뉴"
          collapsed={isSidebarCollapsed}
          onCollapsedChange={setIsSidebarCollapsed}
        >
          {/*
           * ⚠ **`.sidebar-lead` 는 서식이 아니라 배치를 지키는 자리다.** 섹션 밖 직계 항목은
           * 목록이 넘칠 때 DS 가 48px → 24px 로 줄여 버리고(design-system-v2-webui#103),
           * 선택 배경과 표시선이 절반 높이로 그려진다. 상류가 고쳐지면 이 클래스를 지운다.
           *
           * 이 항목이 **왜 섹션 밖 맨 위인지**는 `nav-tree.ts` 의 `NAV_LEAD` 에 적혀 있다.
           */}
          <NavItem to={NAV_LEAD.to} icon={NAV_LEAD.icon} className="sidebar-lead">
            {NAV_LEAD.label}
          </NavItem>
          {NAV_GROUPS.map((group) => (
            <SidebarSection key={group.label} label={group.label}>
              {group.items.map((item) => (
                <NavItem key={item.to} to={item.to} icon={item.icon}>
                  {item.label}
                </NavItem>
              ))}
            </SidebarSection>
          ))}
        </Sidebar>
      }
    >
      {children}
    </AppShell>
  );
};
