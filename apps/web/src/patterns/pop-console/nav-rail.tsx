import { Icon } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useNavigate } from 'react-router';

import { useAccessiblePopScreens } from '../pop-access';
import {
  POP_AREA_ICONS,
  POP_AREAS,
  POP_HOME_PATH,
  popAreaAt,
  popAreaPath,
  popScreenAt,
  type PopArea,
} from '../pop-screen-catalog';

const t = messages.popChrome.console;

/** 이 단말에 열 수 있는 화면이 하나라도 있는 부서 — 레일·홈이 같은 판정을 쓴다. */
export const areasOf = (screens: readonly { area: PopArea }[]): PopArea[] =>
  POP_AREAS.filter((area) => screens.some((screen) => screen.area === area));

export interface PopNavRailProps {
  pathname: string;
  /** 단말 정보 창을 연다. */
  onOpenTerminal: () => void;
}

/**
 * 작업장 콘솔 왼쪽의 **부서 레일** — [홈] · 이 단말의 부서들 · 바닥의 [단말].
 *
 * ⭐ **어느 화면에서든 한 번에 다른 부서로 간다.** 상태바의 [작업 메뉴] 창을 대신한다 — 창은 열어야
 *    보이지만 레일은 늘 보여, 「지금 어느 부서 화면에 있는가」가 화면을 옮겨도 같은 자리에 남는다
 *    (SAP Fiori·Opcenter 의 왼쪽 탐색). 업무 화면에 들어가 있으면 그 화면의 부서가 켜진다.
 *
 * ⛔ **이 단말이 열 수 없는 부서는 세우지 않는다**(`pop-access`). 판정하지 못했으면 부서를 감추고
 *    [홈]만 둔다 — 홈이 사유를 적는다(G-2).
 *
 * ⚠ [단말]은 설치 담당자의 자리라 바닥에 떨어뜨려 둔다 — 작업자 단추들 사이에 두면 작업 중에 눌린다.
 */
export const PopNavRail = ({ pathname, onOpenTerminal }: PopNavRailProps) => {
  const navigate = useNavigate();
  const access = useAccessiblePopScreens();
  const areas = access.state === 'ready' ? areasOf(access.screens) : [];
  const current = popScreenAt(pathname)?.area ?? popAreaAt(pathname);
  const isHome = pathname === POP_HOME_PATH;

  const go = (path: string): void => {
    if (path !== pathname) void navigate(path);
  };

  return (
    <nav className="pop-console-rail" aria-label={t.rail.label}>
      <button
        type="button"
        className="pop-console-rail__item"
        aria-current={isHome ? 'page' : undefined}
        onClick={() => {
          go(POP_HOME_PATH);
        }}
      >
        <Icon name="home" size={36} />
        <span>{t.nav.home}</span>
      </button>

      <span className="pop-console-rail__divider" aria-hidden="true" />

      {areas.map((area) => (
        <button
          key={area}
          type="button"
          className="pop-console-rail__item"
          aria-current={area === current ? 'page' : undefined}
          onClick={() => {
            go(popAreaPath(area));
          }}
        >
          <Icon name={POP_AREA_ICONS[area]} size={36} />
          <span>{t.areas[area]}</span>
        </button>
      ))}

      <button
        type="button"
        className="pop-console-rail__item pop-console-rail__terminal"
        onClick={onOpenTerminal}
      >
        <Icon name="tune" size={32} />
        <span>{t.rail.terminal}</span>
      </button>
    </nav>
  );
};
