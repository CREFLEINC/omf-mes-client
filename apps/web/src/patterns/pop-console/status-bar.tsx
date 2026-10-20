import { Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useNavigate } from 'react-router';

import { usePopIdentity } from '../pop-identity';
import { POP_HOME_PATH, popScreenAt } from '../pop-screen-catalog';
import { useWorkerSession } from '../worker-session';
import type { ConsoleWorkOrder, SessionLight } from './current-work';
import { clockText, useIsOnline, useMinuteClock, usePendingOutboxCount } from './device-state';
import { previousOf, usePopTrail } from './nav-trail';

const t = messages.popChrome.console;

export interface PopConsoleStatusBarProps {
  pathname: string;
  search: string;
  /** 생산 흐름 화면이면 세션 상태등을 보인다. 그 밖의 화면에서는 뜻이 없다. */
  light: SessionLight | null;
  /** 지금 주소의 작업지시. 아직 모르거나 없으면 `null`. */
  workOrder: ConsoleWorkOrder | null;
  onOpenMenu: () => void;
  /** 작업자 확인 창을 연다. 셸이 창을 받지 못했으면 `null` — 단추가 눌리지 않는다. */
  onOpenWorkerSignIn: (() => void) | null;
}

/**
 * 작업장 콘솔 맨 위 **상태바** — 모든 화면이 같은 것을 쓴다.
 *
 * 왼쪽부터 **길잡이**([홈] · [이전] · 「부서 › 화면」) → 무엇 앞에서(설비·상태등) → 무슨
 * 작업지시를 → 오른쪽에 [작업자](누구로 기록하는가) · 연결 · 전송 대기 · 시각 · [작업 메뉴].
 *
 * ⭐ **[작업자]가 사번 입력·교대를 맡는다.** 진입 페이지였던 사번 입력(P-CO-01)을 창으로 옮겼다
 *    — 단말을 켜면 홈이 서고, 누구로 기록할지는 여기서 필요할 때 정한다. 사번이 없으면 단추가
 *    「작업자 확인」으로 눈에 띄게 선다.
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
  onOpenWorkerSignIn,
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
        {/*
         * ⭐ 사번이 없으면 «채운» 단추로 눈에 띄게 선다 — 기록하는 화면은 사번이 없으면 쓰기를
         *    잠그므로, 무엇을 눌러야 풀리는지가 한눈에 보여야 한다.
         */}
        <Button
          className="pop-console-status__worker"
          variant={workerNo === null ? 'filled' : 'outlined'}
          size="xl"
          disabled={onOpenWorkerSignIn === null}
          onClick={() => {
            onOpenWorkerSignIn?.();
          }}
        >
          {workerNo === null ? t.statusBar.signIn : t.statusBar.worker(workerNo)}
        </Button>
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
      </div>
    </header>
  );
};
