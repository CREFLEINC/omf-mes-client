import { AlertBanner, Button, Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState } from 'react';

import { PopWorkerTag } from '../../patterns/pop-worker-tag';

import { resolveActions } from './actions';
import { useNow } from './use-now';
import { useWorkHoldEntry } from './entry-context';
import { EventHistoryPanel } from './event-history-panel';
import { EMPTY_HOLD_DRAFT, validateHoldDraft, type HoldDraft } from './hold-draft';
import { HoldForm } from './hold-form';
import { LoadErrorBanner } from './load-error-banner';
import { EndConfirmDialog } from './end-confirm-dialog';
import { toEndGroup, toResumeGroup, toStopGroup, type HoldTarget } from './event-request';
import { useWorkHoldOutbox, type OutboxDraft } from './outbox';
import { useOpenSession, useSessionEvents, workHoldKeys } from './queries';
import { useHoldReasons } from './reason-options';
import { SessionPanel } from './session-panel';
import { isRunningSession, isStoppedSession } from './types';

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
 * ⭐ **중단·재개는 호출 둘로 나간다**(2026-09-06 게이트 승인) — W/O 층의 상태 전환(`:hold`·
 * `:resume`)과 세션 구간 안의 사건(`events`)이다. 둘은 한 트랜잭션이 아니라서 큐가 순서와
 * 묶음을 진다(`outbox.ts`).
 *
 * ⭐ **세션 종료도 이 화면이 낸다** — 《현재 세션》 구획의 [세션 종료]가 확인 창을 거쳐
 * `:end` 를 부른다. `END` 사건을 따로 보내지는 않는다 — 그 오퍼레이션이 같은 트랜잭션으로
 * 만든다.
 *
 * ⭐ **비고는 W/O 중단 본문이 받는다** — 세션 «사건» 에는 담을 칸이 없다(스펙 §4-A).
 */
export const WorkHoldRegisterScreen = () => {
  const { workOrderId, workerNo } = useWorkHoldEntry();
  const titleId = useId();
  const now = useNow();

  const [draft, setDraft] = useState<HoldDraft>(EMPTY_HOLD_DRAFT);
  const [draftError, setDraftError] = useState<string | null>(null);

  const [isEndConfirmOpen, setEndConfirmOpen] = useState(false);

  const session = useOpenSession(workOrderId);
  const events = useSessionEvents(session.session?.workSessionId ?? null);
  const reasons = useHoldReasons();
  const outbox = useWorkHoldOutbox();
  const queryClient = useQueryClient();

  /**
   * 세션 값을 마지막으로 받은 시각.
   *
   * ⭐ **전송 효과보다 «먼저» 세운다.** 전송이 닿은 것과 무관한 다시 읽기가 같은 순간에
   * 끝나면 둘이 한 커밋에 실리는데, 순서가 반대면 전송이 옛 시각을 집어 「이미 새 값을 받았다」로
   * 읽힌다 — 그 자리에서 같은 방향이 두 번 열린다. 겹치면 **전송이 이겨야 한다.**
   */
  const latestSessionStamp = useRef(session.dataUpdatedAt);

  useEffect(() => {
    latestSessionStamp.current = session.dataUpdatedAt;
  }, [session.dataUpdatedAt]);

  /** 전송이 닿은 순간의 세션 값 시각. 아직 그대로면 새 값을 받지 못한 것이다. */
  const [stampAtSend, setStampAtSend] = useState<number | null>(null);

  /**
   * ⛔ **서버가 받았으면 세션을 다시 읽는다.** 중단이 닿으면 세션 상태가 서버에서 「중단」으로
   * 옮겨 가는데, 화면이 옛 상태를 들고 있으면 「중단 등록」이 열린 채 남아 **같은 중단이 한 번
   * 더 기록된다** — 사건은 정정 경로가 없다.
   */
  useEffect(() => {
    if (outbox.sentCount === 0) return;

    setStampAtSend(latestSessionStamp.current);
    void queryClient.invalidateQueries({ queryKey: workHoldKeys.all });
  }, [outbox.sentCount, queryClient]);

  /**
   * ⛔ **보낸 유형은 «그 전송의» 다시 읽기까지만 쓴다.** 새 세션 값이 오면 판정 근거는 서버가
   * 말하는 상태로 넘어가야 한다 — 옛 유형이 그대로 남으면 뒤에 다른 이유로 세션을 다시 읽는
   * 동안 반대 방향 버튼이 열린다(돌고 있는 설비에 「재개」가 열리는 식이다).
   *
   * 값이 새로 왔는지는 **받은 시각**으로만 가른다 — 「다시 읽는 중인가」는 어느 읽기인지를
   * 말해 주지 못한다.
   */
  const sendAwaitingRefresh = stampAtSend !== null && session.dataUpdatedAt === stampAtSend;

  /** 세션이 없으면 사유를 고를 수 없다 — 고른 값을 실을 곳이 없기 때문이다. */
  const inputDisabled = session.session === null;

  const stopped = session.session !== null && isStoppedSession(session.session);
  /* ⛔ 「중단이 아니면 진행 중」이 아니다 — 종료된 세션·모르는 상태에 중단을 걸지 않는다. */
  const running = session.session !== null && isRunningSession(session.session);

  const { canStop, canResume, canEnd } = resolveActions({
    running,
    stopped,
    lastQueuedType: outbox.lastQueuedType,
    lastSentType: sendAwaitingRefresh ? outbox.lastSentType : null,
    isRefetching: session.isFetching,
  });

  /**
   * 한 조작을 큐에 담고 화면을 비운다 — **담은 것이 곧 성공이다**(C-1 #2).
   *
   * ⛔ **사번이 없으면 담지 않는다.** 헤더가 비면 서버가 거부하는데(D-5), 큐에 담긴 뒤의
   * 거부는 작업자가 화면을 떠난 뒤에 온다 — 그때는 무엇이 실패했는지 말할 자리가 없다.
   *
   * ⛔ **두 호출을 «따로» 담지 않는다** — 그 사이에 다른 조작이 끼어들면 순서가 뜻을 잃는다.
   */
  const submit = (toGroup: (target: HoldTarget) => OutboxDraft[]): void => {
    if (session.session === null || workerNo === null) return;

    outbox.enqueueGroup(
      toGroup({
        workOrderId: session.session.workOrderId,
        workSessionId: session.session.workSessionId,
        workerNo,
      }),
    );
    setDraft(EMPTY_HOLD_DRAFT);
    setDraftError(null);
  };

  const handleStop = (): void => {
    const invalid = validateHoldDraft(draft, reasons.reasons);

    if (invalid !== null) {
      /* 「고르지 않았다」와 「모르는 값이다」는 작업자가 할 일이 다르다 — 같은 말로 덮지 않는다. */
      setDraftError(invalid === 'reasonRequired' ? t.form.reasonRequired : t.form.reasonUnknown);

      return;
    }

    const occurredAt = new Date().toISOString();

    submit((target) => toStopGroup(draft, occurredAt, target));
  };

  /* ⛔ 재개는 사유를 비운다(§5-4) — 초안에 남은 사유를 실어 보내지 않는다. */
  const handleResume = (): void => {
    const occurredAt = new Date().toISOString();

    submit((target) => toResumeGroup(occurredAt, target));
  };

  /* ⭐ 확인 창을 거친 뒤에만 닫는다 — 되돌릴 수 없다(§5-4). */
  const handleEnd = (): void => {
    const endedAt = new Date().toISOString();

    setEndConfirmOpen(false);
    submit((target) => toEndGroup(endedAt, target));
  };

  return (
    /* 표제가 본문의 이름이 된다 — 셸이 없어 줄 사람이 이 화면뿐이다. */
    <main className="pop-shell pop-ui" aria-labelledby={titleId}>
      <header className="pop-header">
        <h1 id={titleId} className="pop-title">
          {t.title}
        </h1>
        {workOrderId !== null && (
          <p className="pop-context">{`${t.entry.workOrderLabel} #${String(workOrderId)}`}</p>
        )}

        <p className="pop-context pop-context-right">
          {/* 귀속 사번은 상시 보인다 — 단말을 넘겨받은 다음 작업자가 남의 이름으로 찍지 않게. */}
          <PopWorkerTag workerNo={workerNo} />

          {session.session !== null && (
            <Chip variant="status" size="md" status="success">
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
            <SessionPanel
              session={session.session}
              isPending={session.isPending}
              now={now}
              canEnd={canEnd && workerNo !== null}
              onEnd={() => {
                setEndConfirmOpen(true);
              }}
            />
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
          reasons={reasons}
          error={draftError}
          onReasonChange={(code) => {
            setDraft((prev) => ({ ...prev, reasonCode: code }));
            setDraftError(null);
          }}
          onRemarksChange={(remarks) => {
            setDraft((prev) => ({ ...prev, remarks }));
          }}
        />
      </div>
      {/*
       * ⭐ **조작은 화면 바닥에 선다.** 구획 안에 두었더니 사유 7값이 칸을 넘겨 [ 중단 등록 ]이
       * 화면 밖(761~833)으로 밀렸다 — 중단을 등록할 수 없는 화면이었다(실측). 액션바는 늘
       * 같은 자리에 있고 본문이 아무리 길어져도 밀리지 않는다(다른 POP 화면과 같은 어휘).
       *
       * ⭐ **두 버튼을 함께 세우고 상태로 가른다.** 하나를 숨기면 지금 세션이 어느 쪽인지
       * 화면에서 사라져, 눌러 본 뒤에야 안다(스펙 §6 — 「이미 중단 상태면 재개만 활성」).
       */}
      <div className="pop-actions">
        {/* 사번을 모르면 서버가 거부한다(D-5) — 큐에 담긴 뒤의 거부는 작업자가 떠난 뒤에 온다. */}
        {workerNo === null && <p className="field-note">{t.form.workerRequired}</p>}
        <Button
          variant="outlined"
          size="2xl"
          disabled={inputDisabled || workerNo === null || !canResume}
          onClick={handleResume}
        >
          {t.form.resumeAction}
        </Button>
        <Button
          size="2xl"
          disabled={inputDisabled || workerNo === null || !canStop}
          onClick={handleStop}
        >
          {t.form.stopAction}
        </Button>
      </div>

      {isEndConfirmOpen && session.session !== null && (
        <EndConfirmDialog
          sessionNo={session.session.sessionNo}
          onConfirm={handleEnd}
          onClose={() => {
            setEndConfirmOpen(false);
          }}
        />
      )}
    </main>
  );
};
