import { Icon } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import {
  POP_AREA_ICONS,
  POP_AREAS,
  POP_TASK_GROUPS,
  type PopArea,
  type PopScreen,
  type PopTaskGroup,
} from '../pop-screen-catalog';

const t = messages.popChrome.console;

/** 생산 흐름의 입구 — 생산 부서에서 가장 크게 세운다. */
export const FLOW_ENTRY_PATH = '/pop/work-start';

export interface PopAreaBoard {
  area: PopArea;
  groups: { group: PopTaskGroup; screens: PopScreen[] }[];
}

/**
 * 허용된 화면을 **부서 → 업무 묶음**으로 접는다. 빈 부서·빈 묶음은 뺀다 — 이 단말의 일만 보인다.
 *
 * ⚠ 생산 흐름 안에서만 들어가는 화면(자재 투입·생산 작업)은 작업 시작이 허용돼 있을 때만 감춘다 —
 *   작업 시작 없이 투입만 허용된 단말이면 감추는 순간 갈 길이 사라진다.
 */
export const boardOf = (screens: readonly PopScreen[]): PopAreaBoard[] => {
  const hasFlowEntry = screens.some((screen) => screen.path === FLOW_ENTRY_PATH);
  const shown = screens.filter((screen) => !(hasFlowEntry && screen.flowOnly === true));

  return POP_AREAS.map((area) => ({
    area,
    groups: POP_TASK_GROUPS[area]
      .map((group) => ({
        group,
        screens: shown.filter((screen) => screen.area === area && screen.group === group),
      }))
      .filter((entry) => entry.screens.length > 0),
  })).filter((entry) => entry.groups.length > 0);
};

/** 부서 판에 선 화면 수. */
export const screenCountOf = (board: PopAreaBoard): number =>
  board.groups.reduce((sum, entry) => sum + entry.screens.length, 0);

export interface PopScreenTileProps {
  screen: PopScreen;
  onPick: (screen: PopScreen) => void;
  /** 생산 흐름의 입구처럼 **가장 먼저 할 일** — 두 칸을 차지하고 짙게 선다. */
  lead?: boolean;
}

/**
 * 화면 하나의 **타일** — 아이콘 · 이름 · 한 줄 설명 · 화면 코드.
 *
 * ⭐ **누를 자리 전체가 단추다.** 이름만 누르는 링크가 아니라 타일 한 장이 손바닥만 한 누름 자리라,
 *    장갑 낀 손으로도 빗나가지 않는다.
 *
 * ⚠ 화면 코드는 작게 둔다 — 작업자가 아니라 관리자·지원 담당이 「어느 화면이냐」를 물을 때 쓴다.
 */
export const PopScreenTile = ({ screen, onPick, lead = false }: PopScreenTileProps) => (
  <button
    type="button"
    className="pop-console-tile"
    data-lead={lead ? 'true' : undefined}
    onClick={() => {
      onPick(screen);
    }}
  >
    <span className="pop-console-tile__icon">
      <Icon name={screen.icon} size={lead ? 44 : 36} />
    </span>
    <span className="pop-console-tile__text">
      <strong>{screen.name}</strong>
      {t.hints[screen.code] !== undefined && <span>{t.hints[screen.code]}</span>}
    </span>
    <span className="pop-console-tile__code">{screen.code}</span>
    <Icon className="pop-console-tile__go" name="arrow_forward" size={28} />
  </button>
);

export interface PopAreaGroupsProps {
  board: PopAreaBoard;
  onPick: (screen: PopScreen) => void;
}

/**
 * 한 부서의 **업무 묶음별 타일 판**. 묶음 이름이 할 일을, 타일이 화면을 말한다.
 *
 * ⭐ **같은 순간에 찾는 화면을 한 묶음에.** 「포장 + 포장 라벨 재출력」, 「작업 중단 + 부품 교체」,
 *    「PQC + OQC」 — 화면 20개를 한 판에 늘어놓으니 작업자가 자기 일을 찾지 못했다(현장 지적
 *    2026-10-20).
 */
export const PopAreaGroups = ({ board, onPick }: PopAreaGroupsProps) => (
  <div className="pop-console-groups">
    {board.groups.map(({ group, screens }) => (
      <section key={group} className="pop-console-group" aria-label={t.groups[group]}>
        <h2 className="pop-console-group__title">
          {t.groups[group]}
          <span>{screens.length}</span>
        </h2>
        <div className="pop-console-group__tiles">
          {screens.map((screen) => (
            <PopScreenTile
              key={screen.path}
              screen={screen}
              lead={screen.path === FLOW_ENTRY_PATH}
              onPick={onPick}
            />
          ))}
        </div>
      </section>
    ))}
  </div>
);

export interface PopAreaCardProps {
  board: PopAreaBoard;
  onOpen: (area: PopArea) => void;
}

/**
 * 홈의 **부서 카드** — 아이콘 · 부서 이름 · 묶음(과 그 화면 수) · 화면 수. 누르면 부서 화면으로 간다.
 *
 * ⭐ 홈에는 화면이 아니라 부서만 선다. 다섯 장을 넘지 않아 처음 보는 사람도 자기 부서를 바로 찾는다.
 */
export const PopAreaCard = ({ board, onOpen }: PopAreaCardProps) => (
  <button
    type="button"
    className="pop-console-area-card"
    onClick={() => {
      onOpen(board.area);
    }}
  >
    <span className="pop-console-area-card__icon">
      <Icon name={POP_AREA_ICONS[board.area]} size={44} />
    </span>
    <strong>{t.areas[board.area]}</strong>
    <span className="pop-console-area-card__groups">
      {board.groups.map(({ group, screens }) => (
        <span key={group}>
          {t.groups[group]}
          <span>{screens.length}</span>
        </span>
      ))}
    </span>
    <span className="pop-console-area-card__count">
      {t.home.screenCount(screenCountOf(board))}
      <Icon name="arrow_forward" size={24} />
    </span>
  </button>
);
