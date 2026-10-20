import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Outlet, useLocation } from 'react-router';

import { POP_HOME_PATH, popAreaAt } from '../pop-screen-catalog';
import { PopConsoleActionBar } from './action-bar';
import type { PopShellLayout } from './console-routes';
import { readWorkOrderIdParam, sessionLightOf, useCurrentWork } from './current-work';
import { PopCurrentWorkPanel } from './current-work-panel';
import { PopFeedbackProvider } from './feedback';
import { PopNavRail } from './nav-rail';
import { recordVisit } from './nav-trail';
import { PopShellActionsContext } from './shell-actions';
import { PopConsoleStatusBar } from './status-bar';
import { PopStepBar } from './step-bar';
import { PopTerminalDialog } from './terminal-dialog';

export interface PopConsoleShellProps {
  layout: PopShellLayout;
  /**
   * 작업자 확인 창. **셸(`app/pop-main`)이 화면 슬라이스의 창을 넘겨준다** — 골격은 `patterns` 라
   * 화면(`screens/worker-assignment`)을 부를 수 없다(의존 방향 `routes → screens → patterns`).
   * 넘기지 않으면 [작업자]는 눌리지 않는다.
   */
  renderWorkerSignIn?: (onClose: () => void) => ReactNode;
}

/**
 * **작업장 콘솔** — 모든 POP 화면을 감싸는 공통 골격(1920×1080).
 *
 * ```
 * flow(생산 흐름)                                      task(그 밖의 화면 · 홈 · 부서 화면)
 * ┌ 상단 바: OMF POP │ ‹이전 │ 위치 ……… 작업자 · 연결 · 시계 ┐   ┌ 상단 바 ─────────────────────┐
 * ├ 레일 ┬ 현재작업 ┬ 단계 ①──②──③ ───────────────────┤   ├ 레일 ┬──────────────────────┤
 * │ 홈   │ 목표…    │ 화면 본문                         │   │ 홈   │ 화면 본문              │
 * │ 생산 │          │                                   │   │ 생산 │                        │
 * │ 품질 ├──────────┴───────────────────────────────────┤   │ 품질 │                        │
 * │ 단말 │ 이상 보고                       [ 다음: ○○ ▶ ] │   │ 단말 │                        │
 * └──────┴────────────────────────────────────────────────┘   └──────┴──────────────────────┘
 * ```
 *
 * ⭐ **현재 맥락을 고정하고, 다음 할 일을 하나만 크게, 이상은 언제나 한 번에.** 상용 MES 단말
 *    (SAP POD·Plex·HYDRA·Opcenter·Tulip)의 공통분모다 — 근거와 그림은 「POP UX/UI 개편 제안」.
 *
 * ⭐ **돌아갈 곳이 늘 있다.** 왼쪽 레일의 [홈]·부서와 상단 바의 [이전]이 모든 화면의 같은 자리에
 *    서고, [이전]은 앱이 직접 적은 기록(`nav-trail`)을 따른다.
 *
 * ⭐ **업무 화면 본문은 키워 그린다**(`.pop-console-screen`). 본문은 1024×768 기준 밀도(E-3 의 관리웹
 *    토큰)로 서 있는데, 그 크기는 15″ 1366 패널에서 현장 테스트로 확정한 «물리 크기»다. 1920
 *    패널에서 같은 물리 크기에 가깝도록 본문만 배율을 건다. ⚠ 홈·부서 화면은 골격과 같이 1920 기준으로
 *    직접 그렸으므로 배율을 걸지 않는다(`data-native`).
 */
export const PopConsoleShell = ({ layout, renderWorkerSignIn }: PopConsoleShellProps) => {
  const { pathname, search } = useLocation();
  const workOrderId = readWorkOrderIdParam(search);
  const current = useCurrentWork(workOrderId);
  const [isTerminalOpen, setTerminalOpen] = useState(false);
  const [isSignInOpen, setSignInOpen] = useState(false);
  const isFlow = layout === 'flow';
  const isNative = pathname === POP_HOME_PATH || popAreaAt(pathname) !== null;
  const canSignIn = renderWorkerSignIn !== undefined;

  useEffect(() => {
    recordVisit(`${pathname}${search}`);
  }, [pathname, search]);

  const actions = useMemo(
    () => ({ openWorkerSignIn: canSignIn ? () => setSignInOpen(true) : null }),
    [canSignIn],
  );

  const screen = (
    <div className="pop-console-screen" data-native={isNative ? 'true' : undefined}>
      <Outlet />
    </div>
  );

  return (
    <PopFeedbackProvider>
      <PopShellActionsContext.Provider value={actions}>
        <div className="pop-console" data-layout={layout}>
          <PopConsoleStatusBar
            pathname={pathname}
            search={search}
            light={isFlow ? sessionLightOf(workOrderId, current.session) : null}
            workOrder={workOrderId === null ? null : (current.workOrder.data ?? null)}
            onOpenWorkerSignIn={actions.openWorkerSignIn}
          />

          <PopNavRail
            pathname={pathname}
            onOpenTerminal={() => {
              setTerminalOpen(true);
            }}
          />

          {isFlow ? (
            <div className="pop-console-body">
              <PopCurrentWorkPanel workOrderId={workOrderId} current={current} />

              <div className="pop-console-work">
                <PopStepBar pathname={pathname} workOrderId={workOrderId} />
                {screen}
              </div>
            </div>
          ) : (
            screen
          )}

          {isFlow && (
            <PopConsoleActionBar pathname={pathname} search={search} workOrderId={workOrderId} />
          )}

          {/*
           * ⭐ 창은 업무 본문과 같은 배율로 선다 — DS 창과 사번 키패드가 본문 밀도(E-3)로 그려져 있어,
           *    배율 밖에 세우면 1920 패널에서 글자와 키가 작아진다.
           */}
          {isSignInOpen && renderWorkerSignIn !== undefined && (
            <div className="pop-console-zoom">
              {renderWorkerSignIn(() => {
                setSignInOpen(false);
              })}
            </div>
          )}

          {isTerminalOpen && (
            <div className="pop-console-zoom">
              <PopTerminalDialog
                onClose={() => {
                  setTerminalOpen(false);
                }}
              />
            </div>
          )}
        </div>
      </PopShellActionsContext.Provider>
    </PopFeedbackProvider>
  );
};
