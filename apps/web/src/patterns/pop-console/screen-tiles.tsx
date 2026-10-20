import { Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { POP_AREAS, type PopArea, type PopScreen } from '../pop-screen-catalog';

const t = messages.popChrome.console;

/** 허용된 화면을 업무 영역별로 묶는다. 빈 영역은 뺀다 — 이 단말의 부서만 보인다. */
export const groupByArea = (
  screens: readonly PopScreen[],
): { area: PopArea; screens: PopScreen[] }[] =>
  POP_AREAS.map((area) => ({
    area,
    screens: screens.filter((screen) => screen.area === area),
  })).filter((entry) => entry.screens.length > 0);

export interface PopScreenTilesProps {
  screens: readonly PopScreen[];
  /** 지금 화면 — 강조만 하고 눌러도 아무 일이 없다. */
  pathname: string;
  onPick: (screen: PopScreen) => void;
}

/**
 * **부서별 화면 타일** — 홈과 작업 메뉴가 같은 것을 쓴다.
 *
 * ⭐ **영역이 하나면 묶음 이름을 세우지 않는다.** 품질 단말에 「품질」 머리말 하나만 서 있으면
 *    자리만 먹는다. 둘 이상일 때만 「생산 / 품질 …」으로 가른다.
 */
export const PopScreenTiles = ({ screens, pathname, onPick }: PopScreenTilesProps) => {
  const groups = groupByArea(screens);
  const showHeadings = groups.length > 1;

  return (
    <div className="pop-console-tiles">
      {groups.map(({ area, screens: inArea }) => (
        <section key={area} className="pop-console-tiles__group" aria-label={t.areas[area]}>
          {showHeadings && <h3>{t.areas[area]}</h3>}
          <div className="pop-console-tiles__grid">
            {inArea.map((screen) => {
              const isHere = screen.path === pathname;

              return (
                <Button
                  key={screen.path}
                  className="pop-console-tile"
                  variant={isHere ? 'filled' : 'outlined'}
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
  );
};
