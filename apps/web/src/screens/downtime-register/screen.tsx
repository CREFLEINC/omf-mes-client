import { Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';

import { OutboxStallBanner } from '../../patterns/outbox-stall-banner';
import { soleProcessIdOf, usePopIdentity } from '../../patterns/pop-identity';
import { PuCols, PuNote, PuScreen, puToast } from '../../patterns/pop-uniform';
import { PopWorkerMissingBanner } from '../../patterns/pop-worker-missing-banner';

import { ActionBar, describeSaveBlock, resolveSaveBlock } from './action-bar';
import { toRangeLabel } from './formatting';
import {
  EMPTY_INTERVAL,
  findOverlaps,
  hasIntervalError,
  readInterval,
  toTimeFieldDraft,
  validateInterval,
  type IntervalDraft,
  type IntervalErrors,
} from './interval';
import { IntervalFields } from './interval-fields';
import { LoadErrorBanner, describeError } from './load-error-banner';
import { OngoingPanel } from './ongoing-panel';
import { useOutbox } from './outbox';
import { isDraftEmpty, toDowntimeCreate, type DowntimeDraft } from './post-request';
import {
  downtimeRegisterKeys,
  toLocalDay,
  useOngoingDowntime,
  useOpenBreakdowns,
  useReasonOptions,
  useTodayDowntimes,
} from './queries';
import { ReasonFields } from './reason-fields';
import { readEquipmentId } from './screen-params';
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
import { PopTopStatus } from '../../patterns/pop-top-status';
import { toApiError } from '../../patterns/request';
import './uniform.css';

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
  /*
   * 단말·공정·설비·사번은 **셸이 아는 것**이라 주소가 아니라 컨텍스트로 온다. 등록을 마치기
   * 전에는 전부 `null`이고, 화면은 그 상태를 사유와 함께 보인다 — 모르는 것을 통과로
   * 처리하지 않는다.
   */
  const { terminalId, processes, equipment, workerNo } = usePopIdentity();
  const processId = soleProcessIdOf(processes);

  /*
   * ⭐ **설비는 단말이 정한다**(스펙 §4-A 「POP 은 설비에 붙어 있다」 · #1149). 종전에는 주소
   *    하나뿐이라, 단말에 설비가 뻔히 붙어 있는데도 화면이 「설비를 고른 뒤 다시 들어오세요」로
   *    막고 **고를 자리를 주지 않았다** — 현장에서 스스로 빠져나올 길이 없었다.
   *
   * ⚠ **주소가 이기는 것은 그대로 둔다.** 개발 이동표·점검처럼 «이 단말의 설비가 아닌 것»을
   *    일부러 볼 때 쓰는 길이고, 주소에 적힌 것은 언제나 의도된 값이다.
   * ⛔ **화면이 설비를 기억해 두지 않는다.** 둘 다 없으면 없는 채로 막힌다 — 앞서 본 설비를
   *    들고 있으면 남의 설비에 비가동이 붙고, 비가동은 정정 경로가 없다.
   */
  const paramEquipmentId = readEquipmentId(searchParams);
  const equipmentId = paramEquipmentId ?? equipment?.equipmentId ?? null;
  const [draft, setDraft] = useState<DowntimeDraft>(EMPTY_DRAFT);
  /* 새로 저장하면 「오늘 이 설비」 첫 쪽(가장 최근)을 보인다. */
  const [savedCount, setSavedCount] = useState(0);

  const outbox = useOutbox();
  const gate = useTerminalGate(terminalId, processId);
  const queryClient = useQueryClient();

  /*
   * ⛔ **시계에 조건을 걸지 않는다.** 「진행 중이 있을 때만」으로 좁혔더니, 저장이 열리는
   * 상태가 곧 진행 중이 없는 상태라 **정작 입력하는 동안 시계가 서 있었다** — 몇 분 뒤
   * `[지금]`으로 찍은 시각이 멈춘 시계보다 미래가 되어 저장이 거부됐다.
   */
  const now = useNow();
  const ongoing = useOngoingDowntime(equipmentId);

  const day = toLocalDay(now);
  const today = useTodayDowntimes(equipmentId, day, outbox.isOnline);
  const breakdowns = useOpenBreakdowns(equipmentId, outbox.isOnline);
  const reasonOptions = useReasonOptions();

  /*
   * ④의 줄. 온라인이면 서버 목록이 정본이고, 끊겨 있으면 **이 단말이 아는 것만** 세운다.
   * 그 사실은 목록 위에서 이름으로 말한다.
   *
   * ⚠ **집계만 실패한 것을 「내 단말 입력분만」이라 부르지 않는다** — 그때 보이는 줄은 서버가
   * 준 전체 목록이라 범위를 좁게 말하는 것이 사실과 다르다. 합계 자리에만 못 받았다고 적는다.
   */
  const isLocalOnly = !outbox.isOnline;

  /* 코드 → 이름. 받아 온 목록이 정본이고, 아직 서버에 닿지 않은 줄이 이것으로 이름을 얻는다. */
  const reasonNames = useMemo(
    () => new Map(reasonOptions.options.map((option) => [option.code, option.name])),
    [reasonOptions.options],
  );

  /*
   * ⭐ **줄과 함께 「그중 몇 줄이 서버 집계에 아직 없는가」를 센다**(#1149). 건수는 이 목록의
   *    길이이고 합계는 서버가 낸 값이라, 아직 서버가 모르는 줄이 섞이면 **두 숫자가 다른
   *    모집단을 센다** — 저장한 직후 건수만 늘고 합계는 그대로다. 그 차이를 화면이 말하려면
   *    몇 줄이 그런지 알아야 한다.
   */
  const { rows, unsettledCount } = useMemo((): {
    rows: TodayRow[];
    unsettledCount: number;
  } => {
    const local = [
      ...outbox.accepted.map((entry) => fromAccepted(entry, reasonNames)),
      ...outbox.pendingCreates.map((entry) =>
        fromPending(entry.idempotencyKey, entry.body, reasonNames),
      ),
    ].filter((row) => startedOn(row, day));

    if (outbox.isOnline) {
      const server = today.downtimes.map((one) => fromDowntimeView(one, reasonNames));
      const known = new Set(server.map((row) => row.key));

      /* 서버가 이미 아는 건은 두 번 세지 않는다 — 방금 보낸 건이 응답과 목록에 함께 잡힌다. */
      const extra = local.filter((row) => !known.has(row.key));

      return {
        rows: [...server, ...extra].sort(byStartedAtDesc),
        unsettledCount: extra.length,
      };
    }

    /*
     * 끊겨 있으면 목록 전체가 이 단말 것이다. 그 사실은 「내 단말 입력분만」이 따로 말하므로
     * 여기서 다시 세지 않는다 — 한 화면이 같은 말을 두 번 하지 않는다.
     */
    return { rows: local.sort(byStartedAtDesc), unsettledCount: 0 };
  }, [day, outbox.accepted, outbox.isOnline, outbox.pendingCreates, reasonNames, today.downtimes]);

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
    terminalId,
    gate: gate.verdict,
    hasOngoing: ongoing.downtime !== null,
  });
  const saveBlockReason = describeSaveBlock(block);

  /**
   * 저장이 잠긴 이유(#1094) — 꺼진 [실적 저장]에 손을 올리면 보인다(#295 규칙 3: 작업 줄에 글을
   * 띄우지 않는다). 화면이 고칠 수 없는 막힘이 먼저, 덜 채운 칸이 다음이다.
   */
  const blockedReason = ((): string | null => {
    if (saveBlockReason !== null) return saveBlockReason;
    if (moments.started === null) return t.actions.needStarted;
    if (reasonMissing) return t.actions.needReason;

    return null;
  })();

  /*
   * 오류를 언제 보일지 갈래가 둘이다.
   *
   * - **잘못 친 것**(끝이 시작보다 앞섬 · 미래 시각 · 덜 친 것)은 바로 보인다. 이미 틀린 값이
   *   칸에 있고, 저장을 누를 때까지 숨기면 작업자가 다음 칸으로 넘어간 뒤에 되돌아와야 한다.
   * - **아직 «안» 친 것**은 아예 글로 말하지 않는다. 스펙 §5-1 이 그 자리에 정한 것은 「활성
   *   조건」뿐이고(시작 시각 + 사유), 저장 버튼이 잠긴 것이 곧 그 말이다 — 빈 화면을 붉은
   *   글씨로 맞이하지 않는다.
   */
  const shownIntervalErrors: IntervalErrors = {
    startedAt: intervalErrors.startedAt === 'required' ? null : intervalErrors.startedAt,
    /*
     * ⛔ **끝 칸의 오류를 시작 칸 사정으로 숨기지 않는다.** 한 덩이로 숨겼더니 시작을 아직
     * 치지 않은 동안 끝 칸의 문제가 통째로 가려졌다 — 실사용에서 나온 자리다.
     */
    endedAt: intervalErrors.endedAt,
  };

  const resetDraft = (): void => {
    setDraft(EMPTY_DRAFT);
  };

  /**
   * 실적 저장 — **큐에 담는 것이 곧 성공이다.** 통신을 기다리지 않고, 서버에 닿지 않은 사실은
   * 헤더의 미전송 건수가 상시 말한다.
   *
   * ⛔ **보내기 직전에 본문을 다시 만든다.** 액션바가 이미 막아 둔 길이지만, 그것이 뚫려도
   * 갖춰지지 않은 값이 기록에 실리지 않아야 한다 — 비가동은 정정 경로가 없다.
   */
  const save = (): void => {
    /* 앞 회차의 거부는 이 회차의 사실이 아니다 — 남겨 두면 방금 저장한 것이 거부된 것처럼 읽힌다. */
    outbox.clearRejections();
    if (block !== null || workerNo === null) return;
    /* 덜 채운 칸이 있으면 버튼이 이미 잠겨 있다 — 여기까지 오지 않는다. */
    if (hasIntervalError(intervalErrors) || reasonMissing || moments.started === null) return;

    const body = toDowntimeCreate(equipmentId, draft);
    if (body === null) return;

    outbox.enqueueCreate(workerNo, body);
    /* 저장 결과는 작업 줄 위 알림으로(#295 규칙 13). */
    puToast(outbox.isOnline ? t.actions.saved : t.actions.queued, outbox.isOnline ? 'ok' : 'info');
    setDraft(EMPTY_DRAFT);
    setSavedCount((count) => count + 1);
  };

  /** 「지금 종료」 — 끝 시각은 서버가 지금으로 박는다. 화면이 시각을 실어 보내지 않는다. */
  const closeOngoing = (): void => {
    if (workerNo === null || ongoing.downtime === null) return;

    outbox.enqueueClose(workerNo, ongoing.downtime.downtimeId);
    puToast(
      outbox.isOnline ? t.ongoing.closed : t.ongoing.closedQueued,
      outbox.isOnline ? 'ok' : 'info',
    );
  };

  /*
   * ⭐ **큐가 받아 온 것을 조회 쪽으로 되돌린다.** 쓰기가 큐를 통해 나가므로 그 결과가
   * 저절로 캐시에 반영되지 않는다 — 되돌리지 않으면 「지금 종료」를 눌러도 진행 중 구획이
   * 그대로 남아 새 저장까지 계속 막히고, 저장이 받아들여져도 ④의 합계가 옛 값에 머문다
   * (건수만 늘어 합계와 어긋난다).
   *
   * ⚠ 세는 것은 **받아들여진 건수**다. 배열 자체를 의존성에 두면 같은 내용에도 새 참조가
   * 오갈 때 무효화가 되풀이된다.
   */
  const acceptedCount = outbox.accepted.length;

  useEffect(() => {
    if (acceptedCount === 0 || equipmentId === null) return;

    void queryClient.invalidateQueries({ queryKey: downtimeRegisterKeys.ongoing(equipmentId) });
    void queryClient.invalidateQueries({ queryKey: downtimeRegisterKeys.today(equipmentId, day) });
    void queryClient.invalidateQueries({
      queryKey: downtimeRegisterKeys.todaySummary(equipmentId, day),
    });
  }, [acceptedCount, day, equipmentId, queryClient]);

  const rejection = outbox.rejections.at(-1);

  /*
   * ⛔ **거부가 돌아오면 성공 알림을 거부 알림으로 바꾼다.** 큐에 담긴 순간을 성공으로 보이는 것은
   * 조항이 정한 바이지만, 서버가 그 건을 받지 않기로 판정한 뒤에도 「저장했습니다」가 남아 있으면
   * **한 화면이 성공과 실패를 동시에 말한다.** 거부 사유는 맨 위 안내 줄에도 남는다.
   */
  useEffect(() => {
    if (rejection === undefined) return;

    puToast(describeError(toApiError(rejection.error)), 'bad');
  }, [rejection]);

  /*
   * 맨 위 안내 줄 — 화면 전체에 걸리는 것만(멈춘 큐 · 사번 · 진행 중 조회 실패 · 쓰기 거부).
   * ⭐ 「밀리는 중」과 「멈춤」은 다르다 — 건수만으로는 그 차이가 보이지 않는다.
   */
  const alerts = [
    outbox.isStalled && <OutboxStallBanner key="stall" onRetry={outbox.retryNow} />,
    workerNo === null && <PopWorkerMissingBanner key="worker" workerNo={workerNo} />,
    ongoing.isError && (
      <LoadErrorBanner key="ongoing" error={ongoing.error} onRetry={ongoing.refetch} />
    ),
    /* 등록이 거부된 것과 종료가 거부된 것은 다음에 할 일이 다르다 — 제목을 가른다. */
    rejection !== undefined && (
      <LoadErrorBanner
        key="rejection"
        error={rejection.error}
        title={rejection.entry.kind === 'close' ? t.errors.closeFailed : t.errors.saveFailed}
        onDismiss={outbox.clearRejections}
      />
    ),
  ].filter((node) => node !== false);

  /*
   * **화면에서 고칠 수 없는 막힘**(설비·단말·권한)은 「오늘 이 설비」 구획 안 안내 줄 하나로
   * 말한다(#295 시안 — 주의 노랑). 설비가 없으면 조회 자체가 나가지 않으므로 그 사실을 먼저 말해야
   * 빈 목록이 「오늘 비가동이 없다」로 읽히지 않는다.
   * ⚠ 사번 갈래는 맨 위 공용 띠가, 진행 중 갈래는 바로 아래 진행 중 줄이 말한다.
   */
  const blockNote =
    saveBlockReason !== null && block !== 'worker-missing' && block !== 'ongoing-exists' ? (
      <PuNote tone="warn">{saveBlockReason}</PuNote>
    ) : null;

  return (
    <>
      <PopTopStatus>
        {/* 연결(온라인·오프라인)은 공통 메뉴 맨 위 줄이 모든 화면에 같게 보인다(#291) — 여기서는 미전송이 있을 때만 알린다. */}
        {outbox.pendingCount > 0 && (
          <Chip variant="status" size="md" status="warning">
            {t.header.unsent(outbox.pendingCount)}
          </Chip>
        )}
      </PopTopStatus>

      <PuScreen
        className="dt-u"
        band={alerts.length > 0}
        actionBar={
          <ActionBar
            block={block}
            isEmpty={isDraftEmpty(draft)}
            isIncomplete={moments.started === null || reasonMissing}
            blockedReason={blockedReason}
            onReset={resetDraft}
            onSave={save}
          />
        }
      >
        {alerts.length > 0 && <div className="dt-alerts">{alerts}</div>}

        <PuCols variant="c2" className="dt-cols">
          <div className="dt-left">
            <IntervalFields
              draft={draft.interval}
              errors={shownIntervalErrors}
              onChange={(interval: IntervalDraft) => {
                setDraft((prev) => ({ ...prev, interval }));
              }}
            >
              {/*
               * 겹침 경고 — **막지 않는다.** 그대로 저장된다는 사실까지 함께 적어야 작업자가 멈춰
               * 서지 않는다.
               */}
              {overlaps.length > 0 && (
                <PuNote tone="warn">
                  {t.errors.overlapWarning(
                    overlaps.map((row) => toRangeLabel(row.startedAt, row.endedAt)).join(', '),
                  )}
                </PuNote>
              )}
            </IntervalFields>

            {/*
             * ⛔ **실패했다고 이 구획을 배너로 갈아 끼우지 않는다**(#1094). 자리는 지키고 내용만 바꾼다.
             */}
            <TodayPanel
              rows={rows}
              totalMinutes={today.totalMinutes}
              isPending={today.isPending}
              isAsked={today.isAsked}
              /*
               * ⭐ **조회를 못 건 이유를 가려 말한다**(#1094 · #1149) — 막는 사유와 같은 순서로
               *    가른다(`resolveSaveBlock`). 한 화면이 해법을 둘 말하지 않는다.
               */
              notAskedLabel={
                equipmentId !== null
                  ? t.today.notAskedOffline
                  : terminalId === null
                    ? t.today.notAskedUnidentified
                    : t.today.notAsked
              }
              isLocalOnly={isLocalOnly}
              /*
               * ⭐ **건수와 합계가 다른 것을 세는 동안 그 사실을 말한다**(#1149) — 건수는 이 목록이고
               *    합계는 서버 집계다.
               */
              unsettledCount={unsettledCount}
              isError={today.isError}
              onRetry={today.refetch}
              now={now}
              firstPageKey={savedCount}
              lead={
                <>
                  {blockNote}
                  <OngoingPanel
                    downtime={ongoing.downtime}
                    isPending={ongoing.isPending}
                    now={now}
                    canClose={workerNo !== null}
                    onClose={closeOngoing}
                  />
                </>
              }
            />
          </div>

          <ReasonFields
            reasonCode={draft.reasonCode}
            reasons={reasonOptions.options}
            reasonsUnavailable={reasonOptions.isUnavailable}
            reasonsFailed={reasonOptions.isError}
            remarks={draft.remarks}
            breakdownId={draft.breakdownId}
            breakdowns={breakdowns.breakdowns}
            breakdownsUnavailable={breakdowns.isError}
            isOffline={!outbox.isOnline}
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
        </PuCols>
      </PuScreen>
    </>
  );
};
