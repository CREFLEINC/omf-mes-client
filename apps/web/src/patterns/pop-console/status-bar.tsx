import { Icon } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useNavigate } from 'react-router';

import { usePopIdentity } from '../pop-identity';
import { popAreaAt, popScreenAt } from '../pop-screen-catalog';
import { useWorkerSession } from '../worker-session';
import type { ConsoleWorkOrder, SessionLight } from './current-work';
import {
  clockText,
  dateText,
  useIsOnline,
  useMinuteClock,
  usePendingOutboxCount,
} from './device-state';
import { previousOf, usePopTrail } from './nav-trail';

const t = messages.popChrome.console;

export interface PopConsoleStatusBarProps {
  pathname: string;
  search: string;
  /** 생산 흐름 화면이면 세션 상태등을 보인다. 그 밖의 화면에서는 뜻이 없다. */
  light: SessionLight | null;
  /** 지금 주소의 작업지시. 아직 모르거나 없으면 `null`. */
  workOrder: ConsoleWorkOrder | null;
  /** 작업자 확인 창을 연다. 셸이 창을 받지 못했으면 `null` — 단추가 눌리지 않는다. */
  onOpenWorkerSignIn: (() => void) | null;
}

/**
 * 작업장 콘솔 맨 위 **상단 바** — 모든 화면이 같은 것을 쓴다.
 *
 * ```
 * ┌ OMF POP ┬ ‹ 이전 │ 품질 › PQC 제품 검사 ……… ● 사출기 1 가동 │ W/O │ 👤 사번 │ ● 연결 │ ⇅ │ 10.20 22:14 ┐
 * ```
 *
 * ⭐ **어두운 띠다.** 왼쪽 부서 레일과 이어진 「ㄱ」자 틀이 화면 본문을 감싸, 무엇이 단말의 틀이고
 *    무엇이 지금 화면인지가 갈린다(Opcenter·HYDRA 단말의 틀). 본문은 밝은 바탕 위 흰 패널이다.
 *
 * ⭐ **[작업자]가 사번 입력·교대를 맡는다.** 사번이 없으면 호박색으로 채운 「작업자 확인」이 선다 —
 *    기록하는 화면은 사번이 없으면 쓰기를 잠그므로, 무엇을 눌러야 풀리는지가 한눈에 보여야 한다.
 *
 * ⭐ **[이전]은 앱이 적은 기록을 따른다**(`nav-trail`). [홈]은 부서 레일 맨 위에 있다.
 *
 * ⛔ **모르는 것을 빈칸으로 두지 않는다.** ⚠ 설비는 «붙어 있을 때만» 적는다 — 창고·품질 단말처럼
 *    설비가 없는 것이 정상인 단말이 있다(`pop-identity` `equipment`).
 */
export const PopConsoleStatusBar = ({
  pathname,
  search,
  light,
  workOrder,
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
  const area = screen?.area ?? popAreaAt(pathname);

  const workerNo = identity.workerNo ?? workerSession?.worker.workerNo ?? null;
  const equipment = identity.equipment;
  const equipmentText =
    equipment === null
      ? null
      : (equipment.equipmentName ?? equipment.equipmentCode ?? String(equipment.equipmentId));

  return (
    <header className="pop-console-status">
      <div className="pop-console-brand" aria-hidden="true">
        <span className="pop-console-brand__mark" />
        <span className="pop-console-brand__name">
          OMF<span>POP</span>
        </span>
      </div>

      <nav className="pop-console-status__nav" aria-label={t.nav.label}>
        <button
          type="button"
          className="pop-console-chrome-button"
          disabled={back === here}
          onClick={() => {
            void navigate(back);
          }}
        >
          <Icon name="arrow_back" size={28} />
          {t.nav.back}
        </button>
        <p className="pop-console-status__location" aria-label={t.nav.location}>
          {area !== null && screen !== null && (
            <>
              <span>{t.areas[area]}</span>
              <span aria-hidden="true">›</span>
            </>
          )}
          <strong>{screen?.name ?? (area !== null ? t.areas[area] : t.home.title)}</strong>
        </p>
      </nav>

      <div className="pop-console-status__context">
        {(equipmentText !== null || light !== null) && (
          <span className="pop-console-chip" title={equipment?.equipmentCode ?? undefined}>
            {light !== null && (
              <span className="pop-console-light" data-light={light} aria-hidden="true" />
            )}
            {equipmentText !== null && <span>{equipmentText}</span>}
            {light !== null && <span className="pop-console-chip__muted">{t.session[light]}</span>}
          </span>
        )}

        {workOrder !== null && (
          <span className="pop-console-chip">
            <Icon name="assignment" size={24} />
            {t.statusBar.workOrder(workOrder.workOrderNo)}
          </span>
        )}
      </div>

      <div className="pop-console-status__right">
        <button
          type="button"
          className="pop-console-chrome-button pop-console-status__worker"
          data-missing={workerNo === null ? 'true' : undefined}
          disabled={onOpenWorkerSignIn === null}
          onClick={() => {
            onOpenWorkerSignIn?.();
          }}
        >
          <Icon name={workerNo === null ? 'badge' : 'person'} size={28} />
          {workerNo === null ? t.statusBar.signIn : t.statusBar.worker(workerNo)}
        </button>

        <span className="pop-console-signal" data-state={isOnline ? 'ok' : 'error'}>
          <Icon name={isOnline ? 'wifi' : 'wifi_off'} size={24} />
          {isOnline ? t.statusBar.online : t.statusBar.offline}
        </span>
        {/* ⭐ 미전송 건수는 필수 표시다(공유계약 C-1 #4) — 화면 밖에서도 보이게 모든 대기열을 합친다. */}
        <span className="pop-console-signal" data-state={pending > 0 ? 'warning' : 'ok'}>
          <Icon name={pending > 0 ? 'cloud_upload' : 'cloud_done'} size={24} />
          {pending > 0 ? t.statusBar.unsynced(pending) : t.statusBar.synced}
        </span>

        <time className="pop-console-clock" dateTime={now.toISOString()}>
          <span>{dateText(now, t.statusBar.weekdays)}</span>
          <strong>{clockText(now)}</strong>
        </time>
      </div>
    </header>
  );
};
