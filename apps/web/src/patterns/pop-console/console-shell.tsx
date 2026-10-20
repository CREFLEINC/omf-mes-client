import { useState } from 'react';
import { Outlet, useLocation } from 'react-router';

import { PopConsoleActionBar } from './action-bar';
import { readWorkOrderIdParam, sessionLightOf, useCurrentWork } from './current-work';
import { PopCurrentWorkPanel } from './current-work-panel';
import { PopFeedbackProvider } from './feedback';
import { PopConsoleStatusBar } from './status-bar';
import { PopStepBar } from './step-bar';
import { PopWorkMenu } from './work-menu';

/**
 * **작업장 콘솔** — 콘솔로 옮긴 POP 화면을 감싸는 공통 골격(1920×1080).
 *
 * ```
 * ┌ 상태바: 설비·상태등 │ 작업지시 │ 사번 │ 연결·전송대기 │ 시계 │ 작업 메뉴 · 사용자 전환 ┐
 * ├ 현재작업 패널 ┬ 단계 표시줄 ─────────────────────────────────────────────────┤
 * │ 목표·양품·불량 │ 화면 본문(<Outlet/>)                                           │
 * ├───────────────┴──────────────────────────────────────────────────────────────┤
 * │ 액션바: 이상 보고(비가동·중단·불량·부품 교체)              [ 다음: ○○ ▶ ]       │
 * └──────────────────────────────────────────────────────────────────────────────┘
 * ```
 *
 * ⭐ **현재 맥락을 고정하고, 다음 할 일을 하나만 크게, 이상은 언제나 한 번에.** 상용 MES 단말
 *    (SAP POD·Plex·HYDRA·Opcenter·Tulip)의 공통분모다 — 근거와 그림은 「POP UX/UI 개편 제안」.
 *
 * ⭐ **화면 본문은 키워 그린다**(`.pop-console-screen`). 본문은 1024×768 기준 밀도(E-3 의 관리웹
 *    토큰)로 서 있는데, 그 크기는 15″ 1366 패널에서 현장 테스트로 확정한 «물리 크기»다. 1920
 *    패널에서 같은 물리 크기가 되도록 본문만 배율을 건다 — 화면 코드를 고치지 않고 E-3 의 뜻을
 *    지킨다.
 *
 * ⚠ **이 골격 밖의 화면은 그대로다**(`console-routes`). 옮긴 화면만 여기 들어온다.
 */
export const PopConsoleShell = () => {
  const { pathname, search } = useLocation();
  const workOrderId = readWorkOrderIdParam(search);
  const current = useCurrentWork(workOrderId);
  const [isMenuOpen, setMenuOpen] = useState(false);

  return (
    <PopFeedbackProvider>
      <div className="pop-console">
        <PopConsoleStatusBar
          light={sessionLightOf(workOrderId, current.session)}
          workOrder={workOrderId === null ? null : (current.workOrder.data ?? null)}
          onOpenMenu={() => {
            setMenuOpen(true);
          }}
        />

        <div className="pop-console-body">
          <PopCurrentWorkPanel workOrderId={workOrderId} current={current} />

          <div className="pop-console-work">
            <PopStepBar pathname={pathname} workOrderId={workOrderId} />
            <div className="pop-console-screen">
              <Outlet />
            </div>
          </div>
        </div>

        <PopConsoleActionBar pathname={pathname} search={search} workOrderId={workOrderId} />
      </div>

      {isMenuOpen && (
        <PopWorkMenu
          pathname={pathname}
          search={search}
          onClose={() => {
            setMenuOpen(false);
          }}
        />
      )}
    </PopFeedbackProvider>
  );
};
