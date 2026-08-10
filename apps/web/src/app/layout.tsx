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
           * 입하 예정은 기준정보도 시스템 운영도 아닌 **현장 물류**다 —
           * 도메인 01(자재창고)의 첫 화면이고, 뒤따르는 W-01 화면들이 이 섹션에 들어온다.
           */}
          <SidebarSection label="자재창고">
            <NavItem to="/logistics/inbound-schedule" icon="local_shipping">
              입하 예정 조회
            </NavItem>
            {/*
             * W-01-03 — **차례가 업무 순서다.** 도착 예정을 보고(입하 예정) 도착을 처리한 뒤
             * (초과 입하 분리) 그 결과를 재고에서 확인한다. 이 도메인의 첫 쓰기 화면이다.
             */}
            <NavItem to="/logistics/over-receipt-split" icon="call_split">
              초과 입하 분리
            </NavItem>
            {/*
             * W-01-07 — 같은 도메인이라 **섹션을 새로 만들지 않는다.** 계약 경로가
             * `/inventory/**`·`/trace/**`이지만 주소 앞머리는 이 섹션을 따른다.
             */}
            <NavItem to="/logistics/stock-status" icon="inventory">
              재고 현황·상태 조회
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
