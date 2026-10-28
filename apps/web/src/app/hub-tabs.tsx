import type { ReactNode } from 'react';
import { useHref, useLinkClickHandler } from 'react-router';

import { HUB_ACTIONS_ID } from '../patterns/hub-actions';
import { localizedLabel } from '../patterns/localized-label';
import type { NavEntry, NavTab } from './nav-tree';

interface HubTabLinkProps {
  tab: NavTab;
  isActive: boolean;
  badge?: ReactNode;
}

/** 탭 하나 — 라우터 링크다. 클릭을 가로채 전체 새로고침 없이 옮긴다(`layout.tsx` `NavItem` 과 같다). */
const HubTabLink = ({ tab, isActive, badge }: HubTabLinkProps) => {
  const href = useHref(tab.to);
  const handleClick = useLinkClickHandler(tab.to);

  return (
    <a
      className="hub-tab"
      href={href}
      aria-current={isActive ? 'page' : undefined}
      onClick={handleClick}
    >
      {localizedLabel(tab)}
      {badge === undefined || badge === null ? null : (
        <span className="hub-tab-badge">{badge}</span>
      )}
    </a>
  );
};

export interface HubTabsProps {
  /** 지금 보고 있는 화면이 든 탭 묶음 — **권한으로 걸러진 뒤의 것**이다(볼 수 없는 탭은 없다). */
  hub: NavEntry & { tabs: readonly NavTab[] };
  /** 지금 켜진 탭의 주소. */
  activePath: string;
  /** 탭 뒤 배지(피처 002 — IQC 탭의 대기 수). 주소로 찾는다. */
  badgeOf?: (path: string) => ReactNode;
}

/**
 * 탭 묶음의 **탭 막대** — 사이드바 한 줄로 선 묶음 안의 화면들을 본문 위에서 오간다.
 *
 * ⭐ **탭은 주소다.** 탭 하나가 기존 화면 하나라, 누르면 그 화면의 주소로 옮긴다 — 북마크·뒤로
 * 가기·다른 화면의 이동 버튼이 탭을 몰라도 그대로 산다. 그래서 ARIA `tablist` 가 아니라 **링크
 * 목록**이다: `tab` 역할은 같은 문서 안의 패널을 바꾸는 약속인데 이것은 문서를 바꾼다.
 * 지금 화면은 `aria-current="page"` 로 알린다(사이드바 항목과 같은 말).
 *
 * ⛔ **셸이 그린다 — 화면이 그리지 않는다.** 화면마다 그리면 탭 목록이 화면 수만큼 복사되고,
 * 묶음을 바꾸는 날 한 곳이 남는다. 묶음은 `nav-tree.ts` 하나가 정한다.
 *
 * 탭 오른쪽 끝에 **화면의 일 단추 자리**(`patterns/hub-actions.tsx`)를 빈 상자로 둔다 — 링크 목록(`nav`) 밖이다.
 */
export const HubTabs = ({ hub, activePath, badgeOf }: HubTabsProps) => (
  <div className="hub-bar">
    <nav className="hub-tabs" aria-label={localizedLabel(hub)}>
      {hub.tabs.map((tab) => (
        <HubTabLink
          key={tab.to}
          tab={tab}
          isActive={tab.to === activePath}
          badge={badgeOf?.(tab.to)}
        />
      ))}
    </nav>
    <div id={HUB_ACTIONS_ID} className="hub-actions" />
  </div>
);
