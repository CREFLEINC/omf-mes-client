import { AlertBanner, Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, useState } from 'react';

import { useNow } from './use-now';
import { useWorkHoldEntry } from './entry-context';
import { EventHistoryPanel } from './event-history-panel';
import { EMPTY_HOLD_DRAFT, type HoldDraft } from './hold-draft';
import { HoldForm } from './hold-form';
import { LoadErrorBanner } from './load-error-banner';
import { useOpenSession, useSessionEvents } from './queries';
import { SessionPanel } from './session-panel';

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
 * ⚠ **중단·재개·종료의 «전송»과 그 버튼은 아직 이 화면에 없다.** 입력 검증(`hold-draft.ts`)은
 * 세워 두었고 버튼이 설 때 그대로 쓴다. 어느 경로로 보내는지가 스펙·요구서·
 * 계약에서 갈려 있어 설계 회신을 기다린다(검토 요청 `omf-mes#398` · 착수 이슈 `#77`). 한쪽을
 * 골라 임시로 넣으면 회신에 따라 통째로 걷어내야 한다 — 입력·검증까지만 세우고 멈춘다.
 */
export const WorkHoldRegisterScreen = () => {
  const { workOrderId, workerNo } = useWorkHoldEntry();
  const titleId = useId();
  const now = useNow();

  const [draft, setDraft] = useState<HoldDraft>(EMPTY_HOLD_DRAFT);

  const session = useOpenSession(workOrderId);
  const events = useSessionEvents(session.session?.workSessionId ?? null);

  /** 세션이 없으면 사유를 고를 수 없다 — 고른 값을 실을 곳이 없기 때문이다. */
  const inputDisabled = session.session === null;

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

          {events.isError ? (
            <LoadErrorBanner
              error={events.error}
              title={t.history.loadFailed}
              onRetry={events.refetch}
            />
          ) : (
            <EventHistoryPanel events={events.events} isPending={events.isPending} />
          )}
        </div>

        <HoldForm
          draft={draft}
          disabled={inputDisabled}
          onReasonChange={(code) => {
            setDraft((prev) => ({ ...prev, reasonCode: code }));
          }}
          onRemarksChange={(value) => {
            setDraft((prev) => ({ ...prev, remarks: value }));
          }}
        />
      </div>
    </main>
  );
};
