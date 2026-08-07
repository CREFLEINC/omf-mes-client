import { AppShell, Sidebar, SidebarItem, SidebarSection, Topbar } from '@crefle/web-ui';
import type { ReactNode } from 'react';
import { useHref, useLinkClickHandler, useLocation } from 'react-router';

interface NavItemProps {
  to: string;
  icon: string;
  children: ReactNode;
}

/**
 * DS `SidebarItem`을 라우터에 잇는 어댑터.
 * `href`는 `useHref`로 만들고, 클릭은 `useLinkClickHandler`로 가로채 전체 새로고침 없이 이동한다.
 */
const NavItem = ({ to, icon, children }: NavItemProps) => {
  const href = useHref(to);
  const handleClick = useLinkClickHandler(to);
  const location = useLocation();
  const isActive = location.pathname === to || location.pathname.startsWith(`${to}/`);

  return (
    <SidebarItem icon={icon} href={href} active={isActive} onClick={handleClick}>
      {children}
    </SidebarItem>
  );
};

interface AppLayoutProps {
  children: ReactNode;
}

export const AppLayout = ({ children }: AppLayoutProps) => {
  return (
    <AppShell
      mainLabel="본문"
      topbar={<Topbar brand={<strong>OMF-MES 관리웹</strong>} />}
      sidebar={
        <Sidebar aria-label="주 메뉴">
          <SidebarSection label="기준정보">
            <NavItem to="/master-data/warehouse-location" icon="warehouse">
              창고·Location
            </NavItem>
            <NavItem to="/master-data/routing" icon="account_tree">
              Routing(공정)
            </NavItem>
            <NavItem to="/master-data/inspection-standard" icon="fact_check">
              검사기준
            </NavItem>
            <NavItem to="/master-data/defect-cause-code" icon="rule">
              불량·원인코드
            </NavItem>
            <NavItem to="/master-data/common-code" icon="list_alt">
              공통코드·조직·작업자
            </NavItem>
            {/* 같은 코드값 편집기를 여는 화면이라 공통코드 바로 뒤에 둔다 — 인접이 관계를 드러낸다. */}
            <NavItem to="/master-data/judgment-code" icon="verified">
              판정유형 코드
            </NavItem>
            <NavItem to="/master-data/integration-sync" icon="sync_alt">
              연계 동기화 현황
            </NavItem>
            <NavItem to="/master-data/item-extended-attrs" icon="inventory_2">
              품목 확장속성
            </NavItem>
            {/* 특정 마스터에 속하지 않는 횡단 조회라 마스터 항목들 뒤에 둔다. */}
            <NavItem to="/master-data/master-change" icon="history">
              마스터 변경관리
            </NavItem>
          </SidebarSection>
          {/*
           * 사용자·역할·권한은 기준정보가 아니라 **시스템 운영**이다 —
           * 기준정보 섹션에 넣으면 「창고·Location」 옆에 서서 분류가 무너진다.
           */}
          <SidebarSection label="시스템 관리">
            <NavItem to="/system/users-roles" icon="manage_accounts">
              사용자·역할·권한
            </NavItem>
          </SidebarSection>
        </Sidebar>
      }
    >
      {children}
    </AppShell>
  );
};
