import { useHref, useLinkClickHandler } from 'react-router';

import { localizedLabel } from '../patterns/localized-label';
import type { NavEntry, NavTab } from './nav-tree';

interface HubTabLinkProps {
  tab: NavTab;
  isActive: boolean;
}

/** 탭 하나 — 라우터 링크다. 클릭을 가로채 전체 새로고침 없이 옮긴다(`layout.tsx` `NavItem` 과 같다). */
const HubTabLink = ({ tab, isActive }: HubTabLinkProps) => {
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
    </a>
  );
};

export interface HubTabsProps {
  /** 지금 보고 있는 화면이 든 탭 묶음 — **권한으로 걸러진 뒤의 것**이다(볼 수 없는 탭은 없다). */
  hub: NavEntry & { tabs: readonly NavTab[] };
  /** 지금 켜진 탭의 주소. */
  activePath: string;
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
 */
export const HubTabs = ({ hub, activePath }: HubTabsProps) => (
  <nav className="hub-tabs" aria-label={localizedLabel(hub)}>
    {hub.tabs.map((tab) => (
      <HubTabLink key={tab.to} tab={tab} isActive={tab.to === activePath} />
    ))}
  </nav>
);
