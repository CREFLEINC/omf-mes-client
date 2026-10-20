import { Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useNavigate } from 'react-router';

import { useAccessiblePopScreens } from '../pop-access';
import { destinationOf } from '../pop-screen-nav';
import { nextStepOf, stepDestination } from './work-steps';

const t = messages.popChrome.console.actions;

/**
 * **이상 보고** 화면 — 액션바 왼쪽에 늘 서는 단추들.
 *
 * ⭐ **원터치로 간다.** 비가동·중단·불량은 «언제 생길지 모르는» 일이라, 작업 시작 화면의 배너
 *    안에만 길이 있으면(#1395 이전) 다른 화면에서는 찾아 들어갈 수 없다. Plex·HYDRA 단말이 이
 *    단추들을 화면 바닥에 고정하는 이유다.
 *
 * ⛔ **이 단말이 볼 수 없는 화면은 세우지 않는다.** 권한 판정은 [화면 이동]과 같은 근거
 *    (`pop-access`)를 쓴다 — 단추마다 따로 판정하면 메뉴에는 없는데 단추는 서는 화면이 생긴다.
 */
const EXCEPTION_PATHS = [
  '/pop/downtime',
  '/pop/work-hold',
  '/pop/material-defect',
  '/pop/running-change',
] as const;

export interface PopConsoleActionBarProps {
  pathname: string;
  search: string;
  workOrderId: number | null;
}

/**
 * 작업장 콘솔 바닥의 **액션바** — 왼쪽은 이상 보고, 오른쪽은 「다음: ○○」 하나.
 *
 * ⭐ **주 행동은 하나만 크게.** 다음에 할 일을 하나만 보여야 작업자가 고르지 않는다(Opcenter·
 *    Tulip 의 단계형 안내). 화면 안의 저장·확정 단추는 그 화면의 것이고, 이 단추는 «다음 화면으로
 *    넘어가기»만 맡는다.
 */
export const PopConsoleActionBar = ({
  pathname,
  search,
  workOrderId,
}: PopConsoleActionBarProps) => {
  const navigate = useNavigate();
  const access = useAccessiblePopScreens();

  const exceptions = EXCEPTION_PATHS.flatMap((path) => {
    if (path === pathname) return [];

    const screen = access.screens.find((candidate) => candidate.path === path);

    return screen === undefined ? [] : [screen];
  });

  const next = nextStepOf(pathname);
  const nextDestination = next === null ? null : stepDestination(next, workOrderId);

  return (
    <footer className="pop-console-actions">
      <div className="pop-console-actions__exceptions" role="group" aria-label={t.label}>
        {exceptions.map((screen) => (
          <Button
            key={screen.path}
            variant="outlined"
            size="xl"
            onClick={() => {
              void navigate(destinationOf(screen, search));
            }}
          >
            {screen.name}
          </Button>
        ))}
      </div>

      {next !== null && nextDestination !== null && (
        <Button
          className="pop-console-actions__next"
          size="2xl"
          onClick={() => {
            void navigate(nextDestination);
          }}
        >
          {t.next(next.screen.name)}
        </Button>
      )}
    </footer>
  );
};
