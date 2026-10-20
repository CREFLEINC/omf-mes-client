import { Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useNavigate } from 'react-router';

import { usePopIdentity } from '../pop-identity';
import { POP_ENTRY_SCREEN_PATH, POP_HOME_PATH, popScreenAt } from '../pop-screen-catalog';
import { setWorkerSession, useWorkerSession } from '../worker-session';
import type { ConsoleWorkOrder, SessionLight } from './current-work';
import { clockText, useIsOnline, useMinuteClock, usePendingOutboxCount } from './device-state';
import { clearTrail, previousOf, usePopTrail } from './nav-trail';

const t = messages.popChrome.console;

export interface PopConsoleStatusBarProps {
  pathname: string;
  search: string;
  /** 생산 흐름 화면이면 세션 상태등을 보인다. 그 밖의 화면에서는 뜻이 없다. */
  light: SessionLight | null;
  /** 지금 주소의 작업지시. 아직 모르거나 없으면 `null`. */
  workOrder: ConsoleWorkOrder | null;
  onOpenMenu: () => void;
}

/**
 * 작업장 콘솔 맨 위 **상태바** — 모든 업무 화면이 같은 것을 쓴다.
 *
 * 왼쪽부터 **길잡이**([홈] · [이전] · 「부서 › 화면」) → 무엇 앞에서(설비·상태등) → 무슨
 * 작업지시를 → 오른쪽에 누구로(사번) · 연결 · 전송 대기 · 시각 · [작업 메뉴] · [사용자 전환].
 *
 * ⭐ **길잡이가 맨 앞이다.** 부서마다 쓰는 화면이 달라 작업자가 자기 영역 밖 화면에 들어가는 일이
 *    잦다(품질 담당이 생산 화면을, 자재 담당이 품질 화면을). 어디서든 [홈] 한 번이면 자기 부서의
 *    화면 묶음으로, [이전] 한 번이면 방금 있던 화면(그 작업지시 그대로)으로 돌아간다.
 *
 * ⛔ **모르는 것을 빈칸으로 두지 않는다**(`work-start/pop-header` 와 같은 규율). 사번이 비면 누구로
 *    기록되는지 모르는 채로 읽힌다. ⚠ 설비는 «붙어 있을 때만» 적는다 — 창고·품질 단말처럼 설비가
 *    없는 것이 정상인 단말이 있다(`pop-identity` `equipment`).
 */
export const PopConsoleStatusBar = ({
  pathname,
  search,
  light,
  workOrder,
  onOpenMenu,
}: PopConsoleStatusBarProps) => {
  const identity = usePopIdentity();
  const workerSession = useWorkerSession();
  const navigate = useNavigate();
  const isOnline = useIsOnline();
  const pending = usePendingOutboxCount();
  const now = useMinuteClock();
  const trail = usePopTrail();

  const here = `${pathname}${search}`;
  const back = previousOf(trail);
  const screen = popScreenAt(pathname);
  const isHome = pathname === POP_HOME_PATH;

  const workerNo = identity.workerNo ?? workerSession?.worker.workerNo ?? null;
  const equipment = identity.equipment;
  const equipmentText =
    equipment === null
      ? null
      : (equipment.equipmentName ?? equipment.equipmentCode ?? String(equipment.equipmentId));

  return (
    <header className="pop-console-status">
      <nav className="pop-console-status__nav" aria-label={t.nav.label}>
        <Button
          variant={isHome ? 'filled' : 'tonal'}
          size="xl"
          aria-current={isHome ? 'page' : undefined}
          onClick={() => {
            if (!isHome) void navigate(POP_HOME_PATH);
          }}
        >
          {t.nav.home}
        </Button>
        <Button
          variant="outlined"
          size="xl"
          disabled={back === here}
          onClick={() => {
            void navigate(back);
          }}
        >
          {t.nav.back}
        </Button>
        <p className="pop-console-status__location" aria-label={t.nav.location}>
          {screen === null ? (
            <strong>{t.home.title}</strong>
          ) : (
            <>
              <span>{t.areas[screen.area]}</span>
              <span aria-hidden="true">›</span>
              <strong>{screen.name}</strong>
            </>
          )}
        </p>
      </nav>

      {(equipmentText !== null || light !== null) && (
        <div className="pop-console-status__equipment">
          {light !== null && (
            <span className="pop-console-light" data-light={light} aria-hidden="true" />
          )}
          {equipmentText !== null && (
            <span title={equipment?.equipmentCode ?? undefined}>{equipmentText}</span>
          )}
          {light !== null && (
            <span className="pop-console-status__session">{t.session[light]}</span>
          )}
        </div>
      )}

      {workOrder !== null && (
        <div className="pop-console-status__work">
          {t.statusBar.workOrder(workOrder.workOrderNo)}
        </div>
      )}

      <div className="pop-console-status__right">
        <span className="pop-console-status__worker">
          {workerNo === null ? t.statusBar.workerUnknown : t.statusBar.worker(workerNo)}
        </span>
        <span className="pop-console-pill" data-state={isOnline ? 'ok' : 'error'}>
          {isOnline ? t.statusBar.online : t.statusBar.offline}
        </span>
        {/* ⭐ 미전송 건수는 필수 표시다(공유계약 C-1 #4) — 화면 밖에서도 보이게 모든 대기열을 합친다. */}
        <span className="pop-console-pill" data-state={pending > 0 ? 'warning' : 'ok'}>
          {pending > 0 ? t.statusBar.unsynced(pending) : t.statusBar.synced}
        </span>
        <time className="pop-console-status__clock" dateTime={now.toISOString()}>
          {clockText(now)}
        </time>
        <Button variant="tonal" size="xl" onClick={onOpenMenu}>
          {t.statusBar.menu}
        </Button>
        {/*
         * ⚠ **사번만 놓는다** — 세션을 끊지 않는다(`pop-logout` 머리말과 같은 이유). 잠깐 자리를
         *   비우려던 사람이 작업을 끝내 버리면 안 된다. 지나온 화면 기록은 비운다 — 다음 사람에게
         *   앞 사람의 작업지시가 「최근 화면」으로 보이면 안 된다.
         */}
        <Button
          variant="outlined"
          size="xl"
          onClick={() => {
            setWorkerSession(null);
            clearTrail();
            void navigate(POP_ENTRY_SCREEN_PATH, { replace: true });
          }}
        >
          {messages.popChrome.userSwitch}
        </Button>
      </div>
    </header>
  );
};
