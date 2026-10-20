import { Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import {
  POP_AREAS,
  POP_TASK_GROUPS,
  type PopArea,
  type PopScreen,
  type PopTaskGroup,
} from '../pop-screen-catalog';

const t = messages.popChrome.console;

/** 생산 흐름의 입구 — 홈의 생산 탭에서 크게 세운다. */
const FLOW_ENTRY_PATH = '/pop/work-start';

/** 마지막으로 본 부서 탭. 단말 하나는 대개 한 부서가 쓰므로 다음에도 그 탭으로 연다. */
const AREA_STORAGE_KEY = 'omf-mes.pop.home-area';

const readStoredArea = (): PopArea | null => {
  try {
    const stored = globalThis.localStorage.getItem(AREA_STORAGE_KEY);

    return POP_AREAS.find((area) => area === stored) ?? null;
  } catch {
    return null;
  }
};

const storeArea = (area: PopArea): void => {
  try {
    globalThis.localStorage.setItem(AREA_STORAGE_KEY, area);
  } catch {
    /* 기억하지 못해도 탭은 바뀐다 — 다음에 첫 탭으로 열릴 뿐이다. */
  }
};

export interface PopAreaBoard {
  area: PopArea;
  groups: { group: PopTaskGroup; screens: PopScreen[] }[];
}

/**
 * 허용된 화면을 **부서 → 업무 묶음**으로 접는다. 빈 부서·빈 묶음은 뺀다 — 이 단말의 일만 보인다.
 *
 * ⚠ `hideFlowOnly` 는 홈에서만 켠다. 생산 흐름 안에서만 들어가는 화면(자재 투입·생산 작업)은
 *   작업 시작이 허용돼 있을 때만 감춘다 — 작업 시작 없이 투입만 허용된 단말이면 감추는 순간 갈
 *   길이 사라진다.
 */
export const boardOf = (screens: readonly PopScreen[], hideFlowOnly: boolean): PopAreaBoard[] => {
  const hasFlowEntry = screens.some((screen) => screen.path === FLOW_ENTRY_PATH);
  const shown = screens.filter(
    (screen) => !(hideFlowOnly && hasFlowEntry && screen.flowOnly === true),
  );

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

export interface PopTaskBoardProps {
  screens: readonly PopScreen[];
  /** 지금 화면 — 강조만 하고 눌러도 아무 일이 없다. */
  pathname: string;
  onPick: (screen: PopScreen) => void;
  /** 홈이면 참 — 생산 흐름 안의 화면을 감추고 작업 시작을 크게 세운다. */
  isHome?: boolean;
}

/**
 * **부서 탭 + 업무 묶음 카드** — 홈과 작업 메뉴가 같은 것을 쓴다.
 *
 * ⭐ **왜 2단인가.** 화면 20개를 한 판에 늘어놓으니 작업자가 자기 일을 찾지 못했다(현장 지적
 *    2026-10-20 — 「메뉴가 너무 많다」). 부서 탭을 고르면 그 부서의 묶음 카드 두세 장만 남는다.
 *    단말 하나는 대개 한 부서가 쓰므로 **부서가 하나면 탭을 세우지 않고**, 여럿이면 마지막에 본
 *    탭으로 연다.
 *
 * ⭐ **같은 순간에 찾는 화면을 한 카드에.** 「포장 + 포장 라벨 재출력」, 「작업 중단 + 부품 교체」,
 *    「PQC + OQC」 — 카드 이름이 할 일을, 카드 안 단추가 화면을 말한다.
 */
export const PopTaskBoard = ({ screens, pathname, onPick, isHome = false }: PopTaskBoardProps) => {
  const boards = boardOf(screens, isHome);
  const [chosen, setChosen] = useState<PopArea | null>(readStoredArea);
  const current = boards.find((board) => board.area === chosen) ?? boards[0];

  if (current === undefined) return null;

  return (
    <div className="pop-console-board">
      {boards.length > 1 && (
        <div className="pop-console-board__areas" role="tablist" aria-label={t.home.areas}>
          {boards.map(({ area }) => {
            const isChosen = area === current.area;

            return (
              <Button
                key={area}
                role="tab"
                aria-selected={isChosen}
                variant={isChosen ? 'filled' : 'outlined'}
                onClick={() => {
                  setChosen(area);
                  storeArea(area);
                }}
              >
                {t.areas[area]}
              </Button>
            );
          })}
        </div>
      )}

      <div
        className="pop-console-board__cards"
        role={boards.length > 1 ? 'tabpanel' : undefined}
        aria-label={t.areas[current.area]}
      >
        {current.groups.map(({ group, screens: inGroup }) => (
          <section key={group} className="pop-console-board__card" aria-label={t.groups[group]}>
            <h3>{t.groups[group]}</h3>
            <div className="pop-console-board__actions">
              {inGroup.map((screen) => {
                const isHere = screen.path === pathname;
                const isLead = isHome && screen.path === FLOW_ENTRY_PATH;

                return (
                  <Button
                    key={screen.path}
                    className={
                      isLead ? 'pop-console-tile pop-console-tile--lead' : 'pop-console-tile'
                    }
                    variant={isHere || isLead ? 'filled' : 'outlined'}
                    aria-current={isHere ? 'page' : undefined}
                    onClick={() => {
                      if (!isHere) onPick(screen);
                    }}
                  >
                    {screen.name}
                  </Button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
};
