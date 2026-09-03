import { AlertBanner, Button, Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useState } from 'react';

import { useNow } from './use-now';
import { useWorkHoldEntry } from './entry-context';
import { EventHistoryPanel } from './event-history-panel';
import { EMPTY_HOLD_DRAFT, validateHoldDraft, type HoldDraft } from './hold-draft';
import { HoldForm } from './hold-form';
import { LoadErrorBanner } from './load-error-banner';
import { toResumeRequest, toStopRequest } from './event-request';
import { useWorkHoldOutbox } from './outbox';
import { useOpenSession, useSessionEvents, workHoldKeys } from './queries';
import { SessionPanel } from './session-panel';
import { isRunningSession, isStoppedSession, type WorkSessionEventCreate } from './types';

const t = messages.workHoldRegister;

/**
 * P-02-10 컨테이너 — **POP(현장 단말) 화면이라 관리웹 셸을 쓰지 않는다.**
 *
 * ## 이 화면이 하는 것과 하지 않는 것
 *
 * | | |
 * | --- | --- |
 * | 한다 | 현재 세션 표시 · 이벤트 이력 · 중단 사유 선택·비고 입력 |
 * | **하지 않는다** | 세션 열기(`P-02-01`) · 비가동 집계(02-S-H 미정 · 이 화면은 기록까지) · 이벤트 정정 |
 *
 * ⛔ **세션이 없으면 성립하지 않는다**(스펙 §5-2). `work_session_event.work_session_id` 가
 * NOT NULL 이라 세션 없이는 중단을 «기록할 자리»가 없다 — 그래서 빈 목록이 아니라 차단 안내다.
 *
 * ⛔ **단말 게이팅을 두지 않는다.** 8플래그 중 작업 중단에 맞는 것이 없고(스펙 §5-1), 착수
 * 이슈 §4 가 「만들지 않는다 — 임의 매핑을 만들지 않고 게이팅 없이 시작한다」로 정했다.
 * 집행은 어차피 서버의 403 이다(공유계약 F-1·F-5).
 *
 * ⭐ **중단·재개는 세션 사건 적재 한 경로로 나간다** — 계약이 「단말이 적재하는 것은 구간
 * 안의 사건인 `STOP`·`RESUME` 뿐」이라고 못박았다. 구간의 경계(`START`·`END`)는 세션을 열고
 * 닫는 오퍼레이션이 같은 트랜잭션으로 만들며 이 화면이 보내지 않는다.
 *
 * ⚠ **세션 종료 버튼은 아직 없다.** 스펙 §5-4(「이 화면은 중단·재개만」)와 §8 미결 5(「이
 * 화면이 받는다」)가 갈려 있어 설계 회신을 기다린다 — 한쪽을 골라 넣으면 통째로 걷어내야 한다.
 *
 * ⚠ **비고는 보내지 않는다.** 세션 «사건» 에 담을 칸이 계약에 없다(`event-request.ts`).
 */
export const WorkHoldRegisterScreen = () => {
  const { workOrderId, workerNo } = useWorkHoldEntry();
  const titleId = useId();
  const now = useNow();

  const [draft, setDraft] = useState<HoldDraft>(EMPTY_HOLD_DRAFT);
  const [draftError, setDraftError] = useState<string | null>(null);

  const session = useOpenSession(workOrderId);
  const events = useSessionEvents(session.session?.workSessionId ?? null);
  const outbox = useWorkHoldOutbox();
  const queryClient = useQueryClient();

  /**
   * ⛔ **서버가 받았으면 세션을 다시 읽는다.** 중단이 닿으면 세션 상태가 서버에서 「중단」으로
   * 옮겨 가는데, 화면이 옛 상태를 들고 있으면 「중단 등록」이 열린 채 남아 **같은 중단이 한 번
   * 더 기록된다** — 사건은 정정 경로가 없다.
   */
  useEffect(() => {
    if (outbox.sentCount === 0) return;

    void queryClient.invalidateQueries({ queryKey: workHoldKeys.all });
  }, [outbox.sentCount, queryClient]);

  /** 세션이 없으면 사유를 고를 수 없다 — 고른 값을 실을 곳이 없기 때문이다. */
  const inputDisabled = session.session === null;

  const stopped = session.session !== null && isStoppedSession(session.session);
  /* ⛔ 「중단이 아니면 진행 중」이 아니다 — 종료된 세션·모르는 상태에 중단을 걸지 않는다. */
  const running = session.session !== null && isRunningSession(session.session);

  /*
   * **지금 이 세션은 어느 쪽인가** — 서버가 아직 받지 못한 것이 큐에 있으면 그것이 답이다.
   *
   * ⛔ **「보낼 것이 있으면 둘 다 잠근다」로 두지 않는다.** 망이 끊기면 큐가 비지 않아, 중단을
   * 담은 뒤 설비가 다시 돌 때 **재개를 아예 등록하지 못한다** — 「담는 것이 곧 성공」이라는
   * 이 큐의 전제를 오프라인에서 되돌리는 일이다(공유계약 C-1 #2).
   *
   * ⛔ **같은 방향을 두 번 담는 것만 막는다.** 순서는 큐가 지킨다(한 번에 한 건씩·거부하면 멈춤).
   */
  const canStop = outbox.lastQueuedType === null ? running : outbox.lastQueuedType === 'RESUME';
  const canResume = outbox.lastQueuedType === null ? stopped : outbox.lastQueuedType === 'STOP';

  /**
   * 큐에 담고 화면을 비운다 — **담은 것이 곧 성공이다**(C-1 #2). 통신을 기다리지 않는다.
   *
   * ⛔ **사번이 없으면 담지 않는다.** 헤더가 비면 서버가 거부하는데(D-5), 큐에 담긴 뒤의
   * 거부는 작업자가 화면을 떠난 뒤에 온다 — 그때는 무엇이 실패했는지 말할 자리가 없다.
   */
  const submit = (body: WorkSessionEventCreate): void => {
    if (session.session === null || workerNo === null) return;

    outbox.enqueue({ workSessionId: session.session.workSessionId, workerNo, body });
    setDraft(EMPTY_HOLD_DRAFT);
    setDraftError(null);
  };

  const handleStop = (): void => {
    const invalid = validateHoldDraft(draft);

    if (invalid !== null) {
      /* 「고르지 않았다」와 「모르는 값이다」는 작업자가 할 일이 다르다 — 같은 말로 덮지 않는다. */
      setDraftError(invalid === 'reasonRequired' ? t.form.reasonRequired : t.form.reasonUnknown);

      return;
    }

    submit(toStopRequest(draft, new Date().toISOString()));
  };

  /* ⛔ 재개는 사유를 비운다(§5-4) — 초안에 남은 사유를 실어 보내지 않는다. */
  const handleResume = (): void => {
    submit(toResumeRequest(new Date().toISOString()));
  };

  return (
    /* 표제가 본문의 이름이 된다 — 셸이 없어 줄 사람이 이 화면뿐이다. */
    <main className="pop-shell" aria-labelledby={titleId}>
      <header className="pop-header">
        <h1 id={titleId} className="pop-title">
          {t.title}
        </h1>
        {workOrderId !== null && (
          <p className="pop-context">{`${t.entry.workOrderLabel} #${String(workOrderId)}`}</p>
        )}

        <p className="pop-context pop-context-right">
          {/* 귀속 사번은 상시 보인다 — 단말을 넘겨받은 다음 작업자가 남의 이름으로 찍지 않게. */}
          <span>
            {workerNo === null ? t.entry.workerUnknown : `${t.entry.workerLabel} ${workerNo}`}
          </span>

          {session.session !== null && (
            <Chip variant="status" size="sm" status="success">
              {t.session.sessionNo(session.session.sessionNo)}
            </Chip>
          )}
        </p>
      </header>

      {/*
       * 작업지시가 없으면 **조회가 나가지 않는다.** 그 사실을 배너로 먼저 말한다 — 빈 화면만
       * 으로는 「세션이 없다」와 「무엇을 볼지 정해지지 않았다」가 같은 모양이 된다.
       */}
      {workOrderId === null && (
        <div className="banner-slot">
          <AlertBanner variant="warning" title={t.title}>
            {t.entry.missingWorkOrder}
          </AlertBanner>
        </div>
      )}

      {session.isError && (
        <LoadErrorBanner
          error={session.error}
          title={t.session.loadFailed}
          onRetry={session.refetch}
        />
      )}

      {/*
        ⛔ **미전송 건수와 연결 상태를 상시 세운다**(C-1 #4). 이것이 없으면 「등록했습니다」가
        서버에 닿았다는 뜻으로 읽히고, 단말이 꺼지면 그 사실이 아무 데도 남지 않는다.
      */}
      {(outbox.pendingCount > 0 || !outbox.isOnline) && (
        <div className="banner-slot">
          <AlertBanner variant="warning" title={t.outbox.pending(outbox.pendingCount)}>
            {outbox.isOnline ? t.outbox.queued : t.outbox.offline}
          </AlertBanner>
        </div>
      )}

      {outbox.isStalled && (
        <div className="banner-slot">
          <AlertBanner
            variant="warning"
            title={t.outbox.stalled}
            action={
              <Button variant="outlined" size="sm" onClick={outbox.retryNow}>
                {t.outbox.retryNow}
              </Button>
            }
          >
            {t.outbox.pending(outbox.pendingCount)}
          </AlertBanner>
        </div>
      )}

      {outbox.rejection !== null && (
        <LoadErrorBanner
          error={outbox.rejection}
          title={t.outbox.rejected}
          onRetry={outbox.clearRejection}
        />
      )}

      <div className="pop-panes">
        <div className="pop-hold-column">
          {/*
           * ⛔ **실패했을 때 「세션이 없습니다」를 함께 말하지 않는다.** 조회가 실패하면 세션은
           * `null` 이지만 그것은 「없다」가 아니라 **「모른다」**다 — 둘을 같이 내면 한 화면이
           * 서로 다른 두 사실을 동시에 말하고, 작업자는 이미 연 세션을 한 번 더 연다.
           */}
          {!session.isError && (
            <SessionPanel session={session.session} isPending={session.isPending} now={now} />
          )}

          {/*
           * ⛔ **세션을 모르면 이력도 모른다.** 세션 조회가 실패하면 이력 조회는 나가지도
           * 않는데, 그때 「기록된 이벤트가 없습니다」를 세우면 조회하지 못한 것을 «비어 있다»고
           * 단정하게 된다 — 세션 구획과 같은 이유로 세우지 않는다.
           */}
          {!session.isError &&
            (events.isError ? (
              <LoadErrorBanner
                error={events.error}
                title={t.history.loadFailed}
                onRetry={events.refetch}
              />
            ) : (
              <EventHistoryPanel events={events.events} isPending={events.isPending} />
            ))}
        </div>

        <HoldForm
          draft={draft}
          disabled={inputDisabled}
          canStop={canStop}
          canResume={canResume}
          error={draftError}
          workerUnknown={workerNo === null}
          onReasonChange={(code) => {
            setDraft((prev) => ({ ...prev, reasonCode: code }));
            setDraftError(null);
          }}
          onRemarksChange={(value) => {
            setDraft((prev) => ({ ...prev, remarks: value }));
          }}
          onStop={handleStop}
          onResume={handleResume}
        />
      </div>
    </main>
  );
};
