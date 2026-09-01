import { AlertBanner, Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';

import { usePopIdentity } from '../../patterns/pop-identity';

import { ActionBar, resolveSaveBlock } from './action-bar';
import { toRangeLabel } from './formatting';
import {
  EMPTY_INTERVAL,
  findOverlaps,
  hasIntervalError,
  readInterval,
  toTimeFieldDraft,
  validateInterval,
  type IntervalDraft,
} from './interval';
import { IntervalFields } from './interval-fields';
import { LoadErrorBanner } from './load-error-banner';
import { OngoingPanel } from './ongoing-panel';
import { useOutbox } from './outbox';
import { toDowntimeCreate, type DowntimeDraft } from './post-request';
import { toLocalDay, useOngoingDowntime, useOpenBreakdowns, useTodayDowntimes } from './queries';
import { ReasonFields } from './reason-fields';
import { readEquipmentCode, readEquipmentId } from './screen-params';
import { TodayPanel } from './today-panel';
import {
  byStartedAtDesc,
  fromAccepted,
  fromDowntimeView,
  fromPending,
  startedOn,
  type TodayRow,
} from './today-rows';
import { useTerminalGate } from './terminal-gating';
import { useNow } from './use-now';

const t = messages.downtimeRegister;

const EMPTY_DRAFT: DowntimeDraft = {
  interval: EMPTY_INTERVAL,
  reasonCode: null,
  breakdownId: null,
  remarks: '',
};

/**
 * P-05-02 컨테이너 — **POP(현장 단말) 화면이라 관리웹 셸을 쓰지 않는다.**
 *
 * ## 이 화면이 하는 것과 하지 않는 것
 *
 * | | |
 * | --- | --- |
 * | 한다 | 진행 중 구간 표시·종료 · 구간 입력 · 사유·고장 연결 · 오늘 이 설비 · 실적 저장 |
 * | **하지 않는다** | 계획 비가동(작업 캘린더 소관) · 자동 종료 · 겹침 차단 · 설비종합효율 |
 *
 * ⛔ **「진행 중」이라는 상태 값을 만들지 않는다.** 끝 시각이 비어 있는 것이 그 뜻이다.
 *
 * ⛔ **자동으로 종료하지 않는다.** 퇴근하며 종료를 안 찍은 구간이 밤새 열려 있어도 화면이
 * 임의의 끝 시각을 넣지 않는다 — 근거 없는 숫자가 집계를 **조용히** 틀리게 만든다. 열린
 * 구간을 보이는 것은 집계 화면 소관이다.
 *
 * ⛔ **겹침을 막지 않는다.** 한 설비에 두 사유가 동시에 걸리는 일이 실제로 있고, 저장 측도
 * 막지 않는다. 화면은 **경고만** 하고 그대로 보낸다.
 *
 * ⭐ **시각은 단말 것을 그대로 쓴다.** 시작과 끝을 같은 단말이 찍으므로 구간의 «차»는 정확하다 —
 * 보정을 넣으면 오히려 값이 튀어 저장이 통째로 실패할 수 있다.
 */
export const DowntimeRegisterScreen = () => {
  const [searchParams] = useSearchParams();
  const equipmentId = readEquipmentId(searchParams);
  const equipmentCode = readEquipmentCode(searchParams);
  /*
   * 단말·공정·사번은 **셸이 아는 것**이라 주소가 아니라 컨텍스트로 온다. 채우는 자리가 아직
   * 없어 지금은 전부 `null`이고, 화면은 그 상태를 사유와 함께 보인다 — 모르는 것을 통과로
   * 처리하지 않는다.
   */
  const { terminalId, processId, workerNo } = usePopIdentity();

  const titleId = useId();

  const [draft, setDraft] = useState<DowntimeDraft>(EMPTY_DRAFT);
  const [categoryCode, setCategoryCode] = useState<string | null>(null);
  const [saveAttempted, setSaveAttempted] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const outbox = useOutbox();
  const gate = useTerminalGate(terminalId, processId);

  /* 진행 중 구간이 있는 동안만 시계를 돌린다 — 볼 것이 없으면 깨울 이유도 없다. */
  const ongoing = useOngoingDowntime(equipmentId);
  const now = useNow(ongoing.downtime !== null);

  const day = toLocalDay(now);
  const today = useTodayDowntimes(equipmentId, day, outbox.isOnline);
  const breakdowns = useOpenBreakdowns(equipmentId, outbox.isOnline);

  /*
   * ④의 줄. 온라인이면 서버 목록이 정본이고, 끊겨 있으면 **이 단말이 아는 것만** 세운다.
   * 그 사실은 목록 위에서 이름으로 말한다.
   */
  const isLocalOnly = !outbox.isOnline || today.totalMinutes === null;

  const rows: TodayRow[] = useMemo(() => {
    const local = [
      ...outbox.accepted.map(fromAccepted),
      ...outbox.pendingCreates.map((entry) => fromPending(entry.idempotencyKey, entry.body)),
    ].filter((row) => startedOn(row, day));

    if (outbox.isOnline) {
      const server = today.downtimes.map(fromDowntimeView);
      const known = new Set(server.map((row) => row.key));

      /* 서버가 이미 아는 건은 두 번 세지 않는다 — 방금 보낸 건이 응답과 목록에 함께 잡힌다. */
      return [...server, ...local.filter((row) => !known.has(row.key))].sort(byStartedAtDesc);
    }

    return local.sort(byStartedAtDesc);
  }, [day, outbox.accepted, outbox.isOnline, outbox.pendingCreates, today.downtimes]);

  const moments = readInterval(draft.interval);
  const intervalErrors = validateInterval(draft.interval, now);
  const reasonMissing = draft.reasonCode === null || draft.reasonCode === '';

  /*
   * 겹침은 **경고**다. 판정 대상은 오늘 이 설비의 줄이고, 진행 중 구간은 새 저장 자체가
   * 막히므로 여기 걸릴 일이 없다.
   */
  const overlaps = findOverlaps(rows, moments);

  const block = resolveSaveBlock({
    workerNo,
    equipmentId,
    gate: gate.verdict,
    hasOngoing: ongoing.downtime !== null,
  });

  /*
   * 오류를 언제 보일지 갈래가 둘이다.
   *
   * - **잘못 친 것**(끝이 시작보다 앞섬 · 미래 시각)은 바로 보인다. 이미 틀린 값이 칸에 있고,
   *   저장을 누를 때까지 숨기면 작업자가 다음 칸으로 넘어간 뒤에 되돌아와야 한다.
   * - **아직 안 친 것**(시작 필수 · 사유 필수)은 저장을 누른 뒤에 보인다. 빈 화면을 붉은
   *   글씨로 맞이하지 않는다.
   */
  const shownIntervalErrors =
    saveAttempted || intervalErrors.startedAt !== 'required'
      ? intervalErrors
      : { startedAt: null, endedAt: null };

  const resetDraft = (): void => {
    setDraft(EMPTY_DRAFT);
    setCategoryCode(null);
    setSaveAttempted(false);
    setSavedNotice(null);
  };

  /**
   * 실적 저장 — **큐에 담는 것이 곧 성공이다.** 통신을 기다리지 않고, 서버에 닿지 않은 사실은
   * 헤더의 미전송 건수가 상시 말한다.
   *
   * ⛔ **보내기 직전에 본문을 다시 만든다.** 액션바가 이미 막아 둔 길이지만, 그것이 뚫려도
   * 갖춰지지 않은 값이 기록에 실리지 않아야 한다 — 비가동은 정정 경로가 없다.
   */
  const save = (): void => {
    setSaveAttempted(true);
    if (block !== null || workerNo === null) return;
    /* 덜 채운 칸이 있으면 여기서 멈춘다 — 그 사실은 칸 옆에 이미 서 있다. */
    if (hasIntervalError(intervalErrors) || reasonMissing) return;

    const body = toDowntimeCreate(equipmentId, draft);
    if (body === null) return;

    outbox.enqueueCreate(workerNo, body);
    setSavedNotice(outbox.isOnline ? t.actions.saved : t.actions.queued);
    setDraft(EMPTY_DRAFT);
    setCategoryCode(null);
    setSaveAttempted(false);
  };

  /** 「지금 종료」 — 끝 시각은 서버가 지금으로 박는다. 화면이 시각을 실어 보내지 않는다. */
  const closeOngoing = (): void => {
    if (workerNo === null || ongoing.downtime === null) return;

    outbox.enqueueClose(workerNo, ongoing.downtime.downtimeId);
    setSavedNotice(t.ongoing.closed);
  };

  const rejection = outbox.rejections.at(-1);

  return (
    /* 표제가 본문의 이름이 된다 — 셸이 없어 줄 사람이 이 화면뿐이다. */
    <main className="pop-shell" aria-labelledby={titleId}>
      <header className="pop-header">
        <h1 id={titleId} className="pop-title">
          {t.title}
        </h1>
        {equipmentId !== null && (
          <p className="pop-context">
            {t.header.equipment(equipmentCode ?? `#${String(equipmentId)}`)}
          </p>
        )}

        <p className="pop-context pop-context-right">
          {/* 귀속 사번은 상시 보인다 — 단말을 넘겨받은 다음 작업자가 남의 이름으로 찍지 않게. */}
          <span>{workerNo === null ? t.header.workerUnknown : t.header.worker(workerNo)}</span>

          {/*
           * ⭐ **미전송 건수는 필수 요건이다.** 「담긴 순간 성공」이라는 표시를 택한 근거가
           * 이것이라, 없으면 서버에 도달하지 않은 사실을 알 방법이 사라진다.
           */}
          <Chip variant="status" size="sm" status={outbox.pendingCount > 0 ? 'warning' : 'success'}>
            {outbox.pendingCount > 0 ? t.header.unsent(outbox.pendingCount) : t.header.sent}
          </Chip>
          {!outbox.isOnline && (
            <Chip variant="status" size="sm" status="error">
              {t.header.offline}
            </Chip>
          )}
        </p>
      </header>

      {/*
       * 설비가 없으면 **조회가 나가지 않는다.** 그 사실을 배너로 먼저 말한다 — 빈 목록만으로는
       * 「오늘 비가동이 없다」와 「무엇을 볼지 정해지지 않았다」가 같은 모양이 된다.
       */}
      {equipmentId === null && (
        <div className="banner-slot">
          <AlertBanner variant="warning" title={t.title}>
            {t.header.equipmentMissing}
          </AlertBanner>
        </div>
      )}

      {ongoing.isError && <LoadErrorBanner error={ongoing.error} onRetry={ongoing.refetch} />}
      {/* 등록이 거부된 것과 종료가 거부된 것은 다음에 할 일이 다르다 — 제목을 가른다. */}
      {rejection !== undefined && (
        <LoadErrorBanner
          error={rejection.error}
          title={rejection.entry.kind === 'close' ? t.errors.closeFailed : t.errors.saveFailed}
        />
      )}

      <OngoingPanel
        downtime={ongoing.downtime}
        isPending={ongoing.isPending}
        now={now}
        canClose={workerNo !== null}
        onClose={closeOngoing}
      />

      <IntervalFields
        draft={draft.interval}
        errors={shownIntervalErrors}
        onChange={(interval: IntervalDraft) => {
          setDraft((prev) => ({ ...prev, interval }));
        }}
      />

      {/*
       * 겹침 경고 — **막지 않는다.** 그대로 저장된다는 사실까지 함께 적어야 작업자가 멈춰
       * 서지 않는다.
       */}
      {overlaps.length > 0 && (
        <div className="banner-slot">
          <AlertBanner variant="warning">
            {t.errors.overlapWarning(
              overlaps.map((row) => toRangeLabel(row.startedAt, row.endedAt)).join(', '),
            )}
          </AlertBanner>
        </div>
      )}

      <ReasonFields
        categoryCode={categoryCode}
        reasonCode={draft.reasonCode}
        remarks={draft.remarks}
        breakdownId={draft.breakdownId}
        breakdowns={breakdowns.breakdowns}
        breakdownsUnavailable={breakdowns.isError}
        isOffline={!outbox.isOnline}
        reasonInvalid={saveAttempted && reasonMissing}
        onCategoryChange={(code) => {
          setCategoryCode(code);
          /* 대분류가 바뀌면 앞서 고른 소분류는 그 대분류의 것이 아니다 — 들고 있지 않는다. */
          setDraft((prev) => ({ ...prev, reasonCode: null }));
        }}
        onReasonChange={(code) => {
          setDraft((prev) => ({ ...prev, reasonCode: code }));
        }}
        onRemarksChange={(value) => {
          setDraft((prev) => ({ ...prev, remarks: value }));
        }}
        onBreakdownChange={(id) => {
          setDraft((prev) => ({ ...prev, breakdownId: id }));
        }}
        onApplyStoppedAt={(stoppedAt) => {
          const at = new Date(stoppedAt);
          if (Number.isNaN(at.getTime())) return;

          setDraft((prev) => ({
            ...prev,
            interval: { ...prev.interval, startedAt: toTimeFieldDraft(at) },
          }));
        }}
      />

      {today.isError ? (
        <LoadErrorBanner error={today.error} onRetry={today.refetch} />
      ) : (
        <TodayPanel
          rows={rows}
          totalMinutes={today.totalMinutes}
          isPending={today.isPending}
          isLocalOnly={isLocalOnly}
          now={now}
        />
      )}

      {savedNotice !== null && (
        <div className="banner-slot">
          <AlertBanner
            variant="success"
            onDismiss={() => {
              setSavedNotice(null);
            }}
          >
            {savedNotice}
          </AlertBanner>
        </div>
      )}

      <ActionBar block={block} onReset={resetDraft} onSave={save} />
    </main>
  );
};
