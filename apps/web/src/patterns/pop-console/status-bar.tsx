import { Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useNavigate } from 'react-router';

import { usePopIdentity } from '../pop-identity';
import { POP_ENTRY_SCREEN_PATH } from '../pop-screen-catalog';
import { setWorkerSession, useWorkerSession } from '../worker-session';
import type { ConsoleWorkOrder, SessionLight } from './current-work';
import { clockText, useIsOnline, useMinuteClock, usePendingOutboxCount } from './device-state';

const t = messages.popChrome.console;

export interface PopConsoleStatusBarProps {
  light: SessionLight;
  /** 지금 주소의 작업지시. 아직 모르거나 없으면 `null`. */
  workOrder: ConsoleWorkOrder | null;
  onOpenMenu: () => void;
}

/**
 * 작업장 콘솔 맨 위 **상태바** — 어느 설비 앞에서 · 무슨 작업지시를 · 누구로 기록하며 · 연결과
 * 전송이 어떤가 · 지금 몇 시인가.
 *
 * ⭐ **모든 화면에서 같은 자리다.** 지금까지는 화면마다 머리줄을 손으로 써서(약 22벌) 같은
 *    정보가 화면마다 다른 곳에 있었다. 상용 단말(Plex·HYDRA)은 이 줄을 고정하고 화면은 그 아래만
 *    바꾼다.
 *
 * ⭐ **[작업 메뉴]·[사용자 전환]이 여기 앉는다.** 떠 있는 버튼(`pop-screen-nav`·`pop-logout`)은
 *    화면 머리줄의 오른쪽을 비워 받아야 했다 — 상태바가 자기 자리를 가지므로 그럴 필요가 없다.
 *
 * ⛔ **모르는 것을 빈칸으로 두지 않는다**(`work-start/pop-header` 와 같은 규율). 설비·사번이
 *    비면 단말이 하나뿐인 것처럼, 누구로 기록되는지 모르는 채로 읽힌다.
 */
export const PopConsoleStatusBar = ({ light, workOrder, onOpenMenu }: PopConsoleStatusBarProps) => {
  const identity = usePopIdentity();
  const workerSession = useWorkerSession();
  const navigate = useNavigate();
  const isOnline = useIsOnline();
  const pending = usePendingOutboxCount();
  const now = useMinuteClock();

  const workerNo = identity.workerNo ?? workerSession?.worker.workerNo ?? null;
  const equipment = identity.equipment;
  const equipmentText =
    equipment === null
      ? t.statusBar.equipmentNone
      : [equipment.equipmentCode, equipment.equipmentName]
          .filter((part): part is string => part !== null && part.trim() !== '')
          .join(' ') || String(equipment.equipmentId);

  return (
    <header className="pop-console-status">
      <div className="pop-console-status__equipment">
        <span className="pop-console-light" data-light={light} aria-hidden="true" />
        <strong>{equipmentText}</strong>
        <span className="pop-console-status__session">{t.session[light]}</span>
      </div>

      <div className="pop-console-status__work">
        {workOrder === null
          ? t.statusBar.workOrderNone
          : t.statusBar.workOrder(workOrder.workOrderNo)}
      </div>

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
         *   비우려던 사람이 작업을 끝내 버리면 안 된다.
         */}
        <Button
          variant="outlined"
          size="xl"
          onClick={() => {
            setWorkerSession(null);
            void navigate(POP_ENTRY_SCREEN_PATH, { replace: true });
          }}
        >
          {messages.popChrome.userSwitch}
        </Button>
      </div>
    </header>
  );
};
