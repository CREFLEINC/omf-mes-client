import { AlertBanner, Chip, Icon, IconButton, Select } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';

import { useAdvanceTo } from '../../patterns/advance-to';
import { useBackStep } from '../../patterns/back-step';
import { BottomActionBar } from '../../patterns/bottom-action-bar';
import { Button } from '../../patterns/button';
import { playErrorTone } from '../../patterns/error-tone';
import { uomLabelOf, useItemCodes, useItemLabels, useUomCodes } from '../../patterns/masters';
import { referenceLabel } from '../../patterns/reference';
import { useOutbox } from '../../patterns/outbox';
import { useScanField } from '../../patterns/use-scan-field';
import { ScanZone } from '../../patterns/scan-zone';
import { TASK_FACTS, TaskRoute } from '../../patterns/task-facts';
import { TaskHeader } from '../../patterns/task-header';
import { useScreenTitle } from '../../patterns/screen-title';
import { useWorkerSession } from '../../patterns/worker-session';
import { useWorkerId } from '../../patterns/workers';
import { useLocationByCode, useLocations, type Location } from '../../patterns/locations';
import { FailureBanner } from '../../patterns/failure-banner';
import { useLoadFailure } from '../../patterns/load-failure';
import {
  putawayKeys,
  useFindTasksByLot,
  useLookupPendingLot,
  usePendingLots,
  usePutawayTasks,
  useTaskLotNo,
} from './queries';
import {
  errorCodesOf,
  groupPendingLots,
  rejectionTextOf,
  modeTextOf,
  reasonTextOf,
  type PendingLot,
  type PendingLotLookup,
} from './direct';
import { PendingLotPanel, type DirectRecorded } from './pending-lot-panel';
import {
  ANYWHERE,
  MATCHED,
  NOT_ALLOWED,
  allowedSummaryOf,
  canComplete,
  lotMatches,
  scansLocation,
  toOutboxDraft,
  verdictOf,
  type PutawayTask,
  movedNoteOf,
  originOf,
} from './putaway';
import './screen.css';

const t = messages.putaway;
const d = messages.putaway.direct;
/* 필수 표시는 화면마다 짓지 않는다. 같은 뜻이 여러 모양으로 갈린다. */
const required = messages.common.required;

type Outcome = 'queued' | 'sent' | 'rejected';

interface Registered {
  key: string;
  lotNo: string;
  locationCode: string;
  qty: string;
  outcome: Outcome;
  /** 창고 보충 지시가 덜 옮겼거나 옮길 것이 없었다(004, 완료 응답). 지시 없는 적치는 입고 번호 · 창고. */
  note: string | null;
  /** 지시 없는 적치의 적치 방식(피처 009). 지시 완료는 null. */
  mode?: string | null;
  /** 서버가 거절한 까닭의 판정 문구(「이 위치는 지정 품목만 받습니다」 등) — 모르면 없음. */
  reason?: string | null;
}

/**
 * 목록에서 스캔한 LOT 으로 지시를 찾은 결과(omf-all-around#272). 하나면 곧바로 열어 여기 남지 않는다.
 * 여럿이면 그 지시만 남겨 고르게 한다.
 */
type LotLookup =
  | { code: string; kind: 'finding' | 'failed' | 'notLot' | 'none' }
  | { code: string; kind: 'many'; lotNo: string; tasks: PutawayTask[] }
  /** 피처 009 — 적치 대기가 아닌 LOT(이유 코드, FR-011). 이미 적치됐으면 그 자리. */
  | { code: string; kind: 'reason'; reasonCode: string; putAway: PendingLotLookup['putAway'] };

/** `:lookup` 이 적치 대기라고 답한 LOT — 그 LOT 화면을 연다. */
type OpenedLot = PendingLotLookup & { lot: PendingLot };

export const PutawayScreen = () => {
  useScreenTitle(t.title);
  const failureText = useLoadFailure();

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { enqueue, flush, isRejected } = useOutbox();
  const { worker } = useWorkerSession();

  const [task, setTask] = useState<PutawayTask | null>(null);
  const [pickedId, setPickedId] = useState<number | null>(null);
  const [scanned, setScanned] = useState<string | null>(null);
  /* 보관 위치 밖을 알고 [미지정 위치 적치]를 눌렀나(T054). 위치를 다시 읽으면 걷는다. */
  const [confirmedOutside, setConfirmedOutside] = useState(false);
  const [scannedLot, setScannedLot] = useState<string | null>(null);
  /* 같은 코드를 다시 스캔한 것도 한 회차다. 값만 보면 두 번째 스캔이 조용히 지나간다. */
  const [scanSeq, setScanSeq] = useState(0);
  const [registered, setRegistered] = useState<Registered[]>([]);
  /*
   * 목록에서 LOT 을 스캔해 연 지시인가(omf-all-around#272). LOT 은 확인된 채라 맞는 위치를 스캔하는
   * 것이 곧 기록이다 - 단추를 누르지 않는다.
   */
  const [byLot, setByLot] = useState(false);
  const [lookup, setLookup] = useState<LotLookup | null>(null);
  /* 피처 009 — 연 적치 대기 LOT. 지시(`task`)와 함께 열리지 않는다. */
  const [pendingLot, setPendingLot] = useState<OpenedLot | null>(null);
  const lookupPendingLot = useLookupPendingLot();
  /*
   * 방금 기록한 건 - 목록 위 배너로 무엇을 어디에 두었는지 말한다. 다음 스캔까지 둔다. 단추 없이
   * 기록되므로 화면이 바뀐 것만으로는 기록됐는지 알 수 없다.
   */
  const [lastRecorded, setLastRecorded] = useState<Registered | null>(null);
  /* 앞선 LOT 조회가 늦게 돌아와 뒤 스캔의 결과를 덮지 않게 한다. */
  const lookupSeq = useRef(0);
  const findTasksByLot = useFindTasksByLot();
  const [saveFailed, setSaveFailed] = useState(false);
  /*
   * 보내는 중인가. 상태로 두면 같은 틱에 두 번 누른 것을 막지 못한다 - 다시 그리기 전에
   * 두 번째가 들어와 멱등키가 다른 두 건이 담기고, 서버가 흡수하지 못해 두 건이 기록된다.
   */
  const inFlight = useRef(false);
  const locationSection = useRef<HTMLElement | null>(null);
  const lotSection = useRef<HTMLElement | null>(null);

  const workerId = useWorkerId(worker?.workerNo ?? null);
  const tasks = usePutawayTasks(workerId.data ?? null);
  const pendingLots = usePendingLots(workerId.data ?? null);
  const locations = useLocations(task?.warehouseId ?? null);
  const byCode = useLocationByCode(task?.warehouseId ?? null, scanned);
  const uoms = useUomCodes(true);
  const uomOf = (uomId: number | null | undefined) => uomLabelOf(uoms.data, uomId);
  const shownTasks = lookup?.kind === 'many' ? lookup.tasks : (tasks.data ?? []);
  const itemIds = [...(tasks.data ?? []), ...(lookup?.kind === 'many' ? lookup.tasks : [])].map(
    (each) => each.itemId,
  );
  const itemLabels = useItemLabels(itemIds);
  const itemCode = useItemCodes(itemIds, (item) =>
    messages.common.reference.named(item.itemName, item.itemCode),
  );
  const lotNo = useTaskLotNo(task?.lotId ?? null);

  const codeOf = (locationId: number | null | undefined): string =>
    locations.data?.find((each) => each.locationId === locationId)?.locationCode ?? '';

  const location: Location | null =
    pickedId === null
      ? (byCode.data ?? null)
      : (locations.data?.find((each) => each.locationId === pickedId) ?? null);

  const verdict = task === null || location === null ? null : verdictOf(task, location);

  /*
   * 보관 위치 밖(피처 009 T054 · FR-017b) — 막지 않고 「지정된 위치가 아닙니다. 정말 적치합니까?」 확인 한 번 뒤 기록한다.
   * 서버도 지시 적치를 허용 위치 밖이라고 막지 않는다(막는 것은 「지정 품목만 받기」 위치 · LOCATION_ITEM_RESTRICTED).
   */
  const outsideUnconfirmed = verdict === NOT_ALLOWED && !confirmedOutside;

  /* 위치가 통과해야 LOT 을 묻는다 - 순서를 바꾸면 오적치를 막을 자리가 사라진다. */
  const locationSettled =
    location !== null &&
    (verdict === MATCHED || verdict === ANYWHERE || (verdict === NOT_ALLOWED && confirmedOutside));

  const ready = canComplete({
    task,
    location,
    lotNo: lotNo.data ?? null,
    scannedLot,
    hasWorker: worker !== null,
    confirmedOutside,
  });

  /*
   * 위치가 막혔다는 것을 소리로도 알린다(공유계약 D-2 · §6). 스캔은 단말을 허리에 매단 채
   * 하므로 화면에만 적으면 사람은 통과한 줄 알고 다음 동작으로 넘어간다.
   */
  const locationBlocked =
    scanned !== null && ((byCode.isSuccess && byCode.data === null) || verdict === NOT_ALLOWED);

  useEffect(() => {
    if (locationBlocked) {
      playErrorTone();
    }
  }, [locationBlocked, scanSeq]);

  /*
   * ⭐ 스캔으로 위치가 정해졌는가(사용자 지정 2026-09-22). 정해지면 스캔 칸을 접고, 판정 줄 옆의
   *   [위치 재스캔]으로만 다시 연다 — 칸이 남아 있으면 다음에 읽는 라벨(LOT)이 위치 칸으로 들어갈
   *   수 있고, 화면도 한 줄 길어진다.
   * 목록에서 고르는 창고(위치 라벨이 없다)는 고른 칸이 곧 표시라 접지 않는다.
   */
  /*
   * ⭐ **막힌 판정이면 접지 않는다**(사용자 지정 2026-09-22) — 둬도 되는 위치가 아니면 곧바로 다른
   *   자리를 읽어야 하므로 칸을 그대로 둔다.
   */
  const scanResolved =
    task !== null &&
    scansLocation(task, locations.data) &&
    scanned !== null &&
    location !== null &&
    !outsideUnconfirmed;

  /*
   * [위치 재스캔] — 배너 안 오른쪽 버튼. [임시 위치 적재로 이동]과 같은 모양이다(사용자 지정
   * 2026-09-22). 버튼이 있을 때만 배너를 두 칸으로 나눈다 — 없을 때 나누면 본문 마지막 줄이
   * 오른쪽 칸으로 밀린다.
   */
  const rescanButton = (
    <Button variant="outlined" size="lg" onClick={() => rescanLocation()}>
      {t.location.rescan}
    </Button>
  );
  /* 읽은 LOT 이 지시 LOT 과 맞는가 — 맞으면 LOT 스캔 칸을 접는다(위치와 같은 규칙). */
  const lotMatched = scannedLot !== null && lotMatches(lotNo.data ?? null, scannedLot);

  const verdictClass = (withAction: boolean): string =>
    withAction ? 'putaway__verdict putaway__verdict--action' : 'putaway__verdict';

  /* 임시로 두는 길은 다른 화면이 받는다 — 지시를 들고 간다. */
  const toTemporaryPutaway = () => {
    void navigate('/temporary-putaway', { state: { task } });
  };

  /* 위치만 되돌린다 — LOT 판정은 위치와 상관없어 그대로 둔다. 칸이 다시 서면 포커스를 받는다. */
  const rescanLocation = () => {
    setScanned(null);
    setPickedId(null);
    setConfirmedOutside(false);
  };

  const clearScans = () => {
    setPickedId(null);
    setScanned(null);
    setConfirmedOutside(false);
    setScannedLot(null);
  };

  /*
   * 지시를 연다. 목록에서 LOT 을 스캔해 열면 그 LOT 을 읽은 것으로 두고 LOT 스캔 단계를 건너뛴다
   * (omf-all-around#272) - 같은 라벨을 두 번 읽게 하지 않는다.
   */
  const openTask = (each: PutawayTask, lotNoFromList: string | null) => {
    setTask(each);
    clearScans();
    setSaveFailed(false);
    setLastRecorded(null);
    setByLot(lotNoFromList !== null);
    if (lotNoFromList !== null) {
      queryClient.setQueryData(putawayKeys.lotNo(each.lotId), lotNoFromList);
      setScannedLot(lotNoFromList);
    }
  };

  const closeTask = () => {
    setTask(null);
    setByLot(false);
    clearScans();
  };

  /*
   * 목록에서 LOT 라벨을 읽었다(피처 009). 먼저 적치 대기 LOT 인지 묻는다 — 그렇다면 그 LOT 화면을 열고, 지시가
   * 있으면(`HAS_TASK`) 지금 지시 경로(omf-all-around#272)로 연다. 구매 입하 LOT 이 아니면(`NOT_INBOUND`) 생산 LOT 의
   * 창고 보충 지시일 수 있어 지시도 찾아본다(004 — 지금처럼).
   */
  const lookUpLot = async (code: string) => {
    if (code === '') {
      return;
    }

    lookupSeq.current += 1;
    const seq = lookupSeq.current;
    setLastRecorded(null);
    setLookup({ code, kind: 'finding' });

    const settle = (next: LotLookup) => {
      setLookup(next);
      playErrorTone();
    };

    let checked: PendingLotLookup;
    try {
      checked = await lookupPendingLot(code);
    } catch {
      if (seq === lookupSeq.current) {
        settle({ code, kind: 'failed' });
      }
      return;
    }

    if (seq !== lookupSeq.current) {
      return;
    }

    if (!checked.found) {
      settle({ code, kind: 'notLot' });
      return;
    }

    if (checked.eligible && checked.lot !== undefined) {
      setLookup(null);
      setPendingLot({ ...checked, lot: checked.lot });
      return;
    }

    const reasonCode = checked.reasonCode ?? 'NOT_INBOUND';
    if (reasonCode !== 'HAS_TASK' && reasonCode !== 'NOT_INBOUND') {
      settle({ code, kind: 'reason', reasonCode, putAway: checked.putAway });
      return;
    }

    let found: Awaited<ReturnType<typeof findTasksByLot>>;
    try {
      found = await findTasksByLot(code);
    } catch {
      if (seq === lookupSeq.current) {
        settle({ code, kind: 'failed' });
      }
      return;
    }

    if (seq !== lookupSeq.current) {
      return;
    }

    const [only, ...rest] = found.tasks;
    if (found.lotNo === null) {
      settle({ code, kind: 'notLot' });
    } else if (only === undefined) {
      settle(
        reasonCode === 'NOT_INBOUND'
          ? { code, kind: 'reason', reasonCode, putAway: undefined }
          : { code, kind: 'none' },
      );
    } else if (rest.length === 0) {
      setLookup(null);
      openTask(only, found.lotNo);
    } else {
      setLookup({ code, kind: 'many', lotNo: found.lotNo, tasks: found.tasks });
    }
  };

  /* 적치 대기 LOT 화면이 한 건을 적었다 — 목록으로 돌아와 무엇을 어디에 두었는지 말한다. */
  const directRecorded = async (recorded: DirectRecorded) => {
    setRegistered((prev) => [...prev, recorded]);
    setLastRecorded(recorded);
    setPendingLot(null);
    /* 방금 적치한 LOT 이 목록에 그대로 서 있으면 같은 LOT 을 두 번 적치할 수 있다. 배지 수도 함께 바뀐다. */
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: putawayKeys.pendingLots(workerId.data ?? null) }),
      queryClient.invalidateQueries({ queryKey: putawayKeys.tasks(workerId.data ?? null) }),
    ]);
  };

  /* 목록의 LOT 스캔 칸(omf-all-around#272). 지시를 열면 칸이 사라지고 위치 칸이 받는다. */
  const listLotField = useScanField({
    onScan: (value) => {
      void lookUpLot(value.trim());
    },
  });

  const locationField = useScanField({
    onScan: (value) => {
      setScanned(value.trim());
      setScanSeq((seq) => seq + 1);
      setPickedId(null);
      setConfirmedOutside(false);
    },
  });

  const lotField = useScanField({
    onScan: (value) => {
      const taken = value.trim();
      setScannedLot(taken);

      /* 화면을 보고 있지 않을 수 있다. 소리로도 알린다(공유계약 D-2). */
      if (!lotMatches(lotNo.data ?? null, taken)) {
        playErrorTone();
      }
    },
  });

  /* 세로 화면이라 채운 구획이 자리를 차지한 채 남으면 다음에 할 일이 접힌 자리에 있다. */
  useAdvanceTo(task !== null, locationSection);
  useAdvanceTo(locationSettled, lotSection);

  /*
   * 뒤로가기는 화면 안 단계를 먼저 되돌린다. 라우터 이력에는 이 화면 하나뿐이라, 두지 않으면
   * 지시를 고르고 스캔하던 사람이 한 번에 작업 목록까지 나간다.
   */
  useBackStep(task !== null && locationSettled, clearScans);
  useBackStep(task !== null && !locationSettled, closeTask);
  /* 여럿을 추린 목록에서 뒤로가면 전체 목록으로 돌아온다. */
  useBackStep(task === null && pendingLot === null && lookup?.kind === 'many', () => {
    setLookup(null);
  });

  const complete = async () => {
    if (task === null || location === null || worker === null || inFlight.current) {
      return;
    }

    inFlight.current = true;
    setSaveFailed(false);

    const entry = toOutboxDraft(task, location, new Date(), worker.workerNo);
    const row = {
      key: entry.idempotencyKey,
      lotNo: lotNo.data ?? '',
      locationCode: location.locationCode,
      qty: `${String(task.taskQty)} ${uomOf(task.uomId)}`,
    };

    try {
      /* 담기지 못하면 적은 것이 어디에도 없다. 말하지 않으면 사람은 기록된 줄 안다. */
      try {
        await enqueue(entry);
      } catch {
        setSaveFailed(true);
        return;
      }

      const result = await flush().catch(() => null);
      const mine = (each: { idempotencyKey: string }) =>
        each.idempotencyKey === entry.idempotencyKey;

      /*
       * 자기가 부른 보내기의 결과만 보면 딸려 되돌아간 건을 놓친다 - 그 판정은 셸이 도는 다른
       * 회차에서 내려질 수 있고, 화면은 빈 결과를 받아 담아 두었다고 잘못 말한다.
       */
      const outcome: Outcome =
        (result !== null && result.rejected.some((each) => mine(each.entry))) ||
        isRejected(entry.idempotencyKey)
          ? 'rejected'
          : result === null || result.remaining.some(mine)
            ? 'queued'
            : 'sent';

      const note =
        outcome === 'sent'
          ? movedNoteOf(task, result?.responses.get(entry.idempotencyKey), uomOf(task.uomId))
          : null;
      /* 「지정 품목만 받기」 위치면 서버가 LOCATION_ITEM_RESTRICTED 로 거절한다 — 스캔 때와 같은 판정 문구로 말한다(T054). */
      const rejection = result?.rejected.find((each) => mine(each.entry));
      const reason =
        outcome === 'rejected' && rejection !== undefined
          ? rejectionTextOf(errorCodesOf(rejection.error))
          : null;
      setRegistered((prev) => [...prev, { ...row, outcome, note, reason }]);
      setLastRecorded({ ...row, outcome, note, reason });
      setLookup(null);

      /*
       * 목록을 다시 읽는다 - 그러지 않으면 방금 끝낸 지시가 그대로 서 있어 같은 자리를 두 번
       * 적치할 수 있다.
       */
      await queryClient.invalidateQueries({ queryKey: putawayKeys.tasks(workerId.data ?? null) });
      closeTask();
    } finally {
      inFlight.current = false;
    }
  };

  /*
   * LOT 으로 연 지시는 위치가 통과하면 곧바로 기록한다(omf-all-around#272). 둘 곳 밖이면 `ready` 가
   * 서지 않아 기록하지 않는다. 같은 위치를 다시 스캔해도(저장 실패 뒤) 다시 시도한다.
   */
  useEffect(() => {
    if (byLot && ready) {
      void complete();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 판정이 서거나 다시 스캔했을 때만 돈다
  }, [byLot, ready, scanSeq, pickedId]);

  /*
   * 네 값에 이름을 붙인다. 값만 늘어놓으면 어느 것이 품목이고 어느 것이 지시 번호인지 형식을 아는
   * 사람만 읽는다. 한 줄에 하나씩 쌓던 것을 두 칸씩 접어 카드가 절반 높이가 된다(개편 제안 v2).
   */
  const taskFields = (each: PutawayTask, extra?: ReactNode) => (
    <>
      {/*
       * 004 — 창고 보충 수령에서 생긴 지시는 원천 한 줄을 붙인다(screens/M-putaway.md). 구매 입고 지시는 지금과
       * 똑같이 보인다(T053).
       */}
      {each.originCode === 'REPLENISHMENT_RECEIPT' ? (
        <p className="putaway__origin">{`${t.tasks.originLabel} ${originOf(each)}`}</p>
      ) : null}
      <dl className={`putaway__task-fields ${TASK_FACTS}`}>
        <div>
          <dt>{t.tasks.itemLabel}</dt>
          <dd>
            <strong>{referenceLabel(itemCode(each.itemId))}</strong>
          </dd>
        </div>
        <div>
          <dt>{t.tasks.taskNoLabel}</dt>
          <dd>{each.putawayTaskNo}</dd>
        </div>
        <div>
          <dt>{t.tasks.qtyLabel}</dt>
          <dd>{`${String(each.taskQty)} ${uomOf(each.uomId)}`}</dd>
        </div>
        {extra}
      </dl>
    </>
  );

  /* 어디에 두는가 — 지시가 둬도 되는 위치를 코드로 싣는다. 비면 이 창고 어디든이다. */
  const allowedField = (each: PutawayTask) => (
    <div>
      <dt>{t.tasks.allowedLabel}</dt>
      <dd>{allowedSummaryOf(each) ?? t.tasks.anywhere}</dd>
    </div>
  );

  /*
   * 「이 지시 적치」가 잠긴 이유(공유계약 G-1). 위치가 통과해야 LOT 을 묻는 순서대로, 처음 비어
   * 있는 것 하나만.
   */
  const recordLock =
    task === null || ready
      ? undefined
      : !locationSettled
        ? t.locked.location
        : !lotMatched
          ? t.locked.lot
          : undefined;

  /* 스캐너가 못 읽는 라벨이 있다. 손으로 넣는 길을 늘 연다(공유계약 D-3). */
  const manualButton = (field: typeof locationField, open: string, submitLabel: string) => (
    <IconButton
      className="putaway__zone-button"
      icon={field.manual ? 'keyboard_return' : 'keyboard'}
      size="lg"
      aria-label={field.manual ? submitLabel : open}
      onClick={field.manual ? field.submitManual : field.openManual}
    />
  );

  /*
   * 서버가 거절한 것만 화면에 모은다 — 서버에 없으므로 「적치 기록」(M-01-14)이 대신 보이지 못한다. 받거나 담긴 것은
   * 이 화면에 쌓지 않는다(피처 011): 직전 1건은 위 결과 띠가, 지난 기록은 「적치 기록」이 서버 이력으로 보인다.
   */
  const failed = registered.filter((each) => each.outcome === 'rejected');
  const doneRow = (each: Registered) => (
    <li key={each.key}>
      <Icon
        name={each.outcome === 'rejected' ? 'error' : 'check_circle'}
        size={20}
        className="putaway__done-icon"
      />
      <span className="putaway__scanned">
        {t.done.row(each.lotNo, each.locationCode, each.qty)}
        {each.note === null || each.mode !== undefined ? null : (
          <span className="putaway__moved-note">{each.note}</span>
        )}
      </span>
      <span className="putaway__done-chips">
        {each.mode === undefined || each.mode === null ? null : <Chip>{each.mode}</Chip>}
        {each.outcome === 'rejected' ? (
          <Chip status="error">{t.rejected.title}</Chip>
        ) : each.outcome === 'queued' ? (
          <Chip status="warning">{t.queued.title}</Chip>
        ) : (
          <Chip status="success">{t.sent.title}</Chip>
        )}
      </span>
    </li>
  );

  return (
    <div className="putaway with-bottom-action-bar">
      {pendingLot !== null && worker !== null ? (
        <PendingLotPanel
          key={pendingLot.lot.lotId}
          found={pendingLot}
          workerNo={worker.workerNo}
          onClose={() => setPendingLot(null)}
          onRecorded={(recorded) => void directRecorded(recorded)}
        />
      ) : task === null ? (
        <section className="putaway__section">
          {workerId.isPending && worker !== null ? <p role="status">{t.worker.loading}</p> : null}
          {workerId.isError ? (
            <FailureBanner
              variant="error"
              title={failureText(workerId.error, t.worker.loadFailed)}
            />
          ) : null}
          {/* 비우고 물으면 남의 지시까지 온다. 찾지 못하면 목록을 열지 않는다. */}
          {workerId.isSuccess && workerId.data === null ? (
            <AlertBanner variant="warning" title={t.worker.notFound(worker?.workerNo ?? '')} />
          ) : null}

          {/* 지시 조회는 사번이 풀려야 나간다. 사번 조회가 실패했으면 불러오고 있지 않다(#1198). */}
          {tasks.isPending && workerId.isSuccess && workerId.data !== null ? (
            <p role="status">{t.tasks.loading}</p>
          ) : null}
          {tasks.isError ? (
            <FailureBanner variant="error" title={failureText(tasks.error, t.tasks.loadFailed)} />
          ) : null}
          {/*
            앞서 받은 0건이 남아 있어도 지금 조회가 실패했으면 없다고 말하지 않는다(#1198 실기 -
            등록 만료 옆에 「받은 적치 지시가 없습니다」가 떴다). 빈 목록 안내는 성공일 때만.
          */}
          {/*
           * 방금 기록한 것(omf-all-around#272). LOT 으로 연 지시는 단추 없이 기록되고 목록으로 돌아오므로,
           * 무엇을 어디에 두었는지 여기서 말한다. 다음 스캔까지 둔다.
           */}
          {lastRecorded === null ? null : (
            <AlertBanner
              variant={
                lastRecorded.outcome === 'rejected'
                  ? 'error'
                  : lastRecorded.outcome === 'queued'
                    ? 'info'
                    : 'success'
              }
              title={
                lastRecorded.outcome === 'rejected'
                  ? t.rejected.title
                  : lastRecorded.outcome === 'queued'
                    ? t.queued.title
                    : t.sent.title
              }
            >
              <span className="putaway__verdict-line">
                {t.done.row(lastRecorded.lotNo, lastRecorded.locationCode, lastRecorded.qty)}
              </span>
              {lastRecorded.reason === undefined || lastRecorded.reason === null ? null : (
                <span className="putaway__verdict-line">{lastRecorded.reason}</span>
              )}
              {/*
               * 지시 없는 적치는 입고 번호 · 창고, 창고 보충 지시는 덜 옮겼거나 닫은 까닭(004). 보충 지시의 까닭은
               * 「적치됨」 줄이 말했는데 그 목록을 지워(피처 011) 이 띠가 함께 말한다.
               */}
              {lastRecorded.note === null ? null : (
                <span className="putaway__verdict-line">{lastRecorded.note}</span>
              )}
            </AlertBanner>
          )}

          {/* 지시를 고르는 첫 길 - 손에 든 자재의 LOT 라벨을 읽으면 그 지시가 열린다. */}
          {workerId.data === null || workerId.data === undefined ? null : (
            <ScanZone
              field={listLotField}
              label={t.lotScan.label}
              prompt={d.lotScanPrompt}
              tools={manualButton(listLotField, t.lotScan.manual, t.lotScan.manualSubmit)}
            />
          )}
          {lookup?.kind === 'finding' ? <p role="status">{d.finding}</p> : null}
          {lookup?.kind === 'failed' ? (
            <AlertBanner variant="error" title={lookup.code}>
              {d.findFailed}
            </AlertBanner>
          ) : null}
          {/* 적치 대기가 아닌 LOT(FR-011) — 지금은 모두 「적치 지시가 없습니다」 한 가지였다(시안 ⑦). */}
          {lookup?.kind === 'reason' ? (
            <AlertBanner
              className="putaway__verdict"
              variant="error"
              title={reasonTextOf(lookup.reasonCode) ?? lookup.reasonCode}
            >
              <span className="putaway__verdict-line putaway__scanned">{lookup.code}</span>
              {lookup.putAway === undefined ? null : (
                <span className="putaway__verdict-line">
                  {[
                    d.putAwayAt(lookup.putAway.locationCode, lookup.putAway.warehouseName),
                    modeTextOf(lookup.putAway.putawayModeCode),
                  ]
                    .filter((each) => each !== null)
                    .join(', ')}
                </span>
              )}
            </AlertBanner>
          ) : null}
          {lookup?.kind === 'notLot' ? (
            <AlertBanner variant="error" title={lookup.code}>
              {t.lotScan.notLot}
            </AlertBanner>
          ) : null}
          {lookup?.kind === 'none' ? (
            <AlertBanner className="putaway__verdict" variant="error" title={lookup.code}>
              <span className="putaway__verdict-line">{t.lotScan.none}</span>
              <span className="putaway__verdict-line">{t.lotScan.noneHint}</span>
            </AlertBanner>
          ) : null}
          {lookup?.kind === 'many' ? (
            <AlertBanner
              className="putaway__verdict putaway__verdict--action"
              variant="info"
              title={t.lotScan.many(String(lookup.tasks.length))}
              action={
                <Button variant="outlined" size="lg" onClick={() => setLookup(null)}>
                  {t.lotScan.showAll}
                </Button>
              }
            >
              <span className="putaway__scanned">{lookup.lotNo}</span>
            </AlertBanner>
          ) : null}

          {/*
           * 머리 줄 오른쪽이 「적치 기록」(M-01-14) 입구다 — 지난 적치는 거기서 본다(피처 011). 입구는 사번 미확인 · 조회
           * 실패 · 연결 끊김에도 늘 선다(FR-003, T031). 왼쪽 수만 두 목록을 받았을 때 보인다.
           */}
          <div className="putaway__head">
            {lookup?.kind !== 'many' &&
            tasks.data !== undefined &&
            pendingLots.data !== undefined ? (
              <p className="putaway__note">
                {d.summary(String(pendingLots.data.total), String(tasks.data.length))}
              </p>
            ) : (
              <span />
            )}
            <Link className="putaway__history-link" to="/putaway-history">
              {t.historyLink}
              <Icon name="chevron_right" size={18} />
            </Link>
          </div>

          {/*
           * 적치 대기 LOT(피처 009) — 입하 LOT · 품목으로 묶는다(입하 마감 오래된 순). 줄을 누르면 그 LOT 을
           * 스캔한 것과 같다. 여럿을 추린 지시 목록을 보는 동안은 접는다.
           */}
          {lookup?.kind === 'many' ? null : (
            <>
              {pendingLots.isPending && workerId.isSuccess && workerId.data !== null ? (
                <p role="status">{d.lotsLoading}</p>
              ) : null}
              {pendingLots.isError ? (
                <FailureBanner
                  variant="error"
                  title={failureText(pendingLots.error, d.lotsLoadFailed)}
                />
              ) : null}
              {pendingLots.data === undefined || pendingLots.data.items.length === 0 ? null : (
                <>
                  <h2>{d.lotsLegend}</h2>
                  <ul className="putaway__groups">
                    {groupPendingLots(pendingLots.data.items).map((group) => (
                      <li key={group.key} className="putaway__group">
                        <p className="putaway__group-head">
                          <strong>{group.itemCode}</strong>
                          <span>{group.itemName}</span>
                          <Chip>{String(group.lots.length)}</Chip>
                        </p>
                        <p className="putaway__note">{group.source}</p>
                        <ul className="putaway__lots">
                          {group.lots.map((each) => (
                            <li key={each.lotId}>
                              <button
                                type="button"
                                className="putaway__lot"
                                onClick={() => void lookUpLot(each.lotNo)}
                              >
                                {/*
                                 * LOT 번호는 한 줄을 다 쓰고, 「불량」 칩 · 수량은 그 아래 줄에 선다 — 긴 번호(`…|…|…`)가
                                 * 375px 에서 칩에 가려졌다(실제 앱 확인 2026-11-18).
                                 */}
                                <span className="putaway__lot-main">
                                  <span className="putaway__scanned">{each.lotNo}</span>
                                  <span className="putaway__lot-meta">
                                    {each.lotStatusCode === 'DEFECTIVE' ? (
                                      <Chip status="error">{d.defective}</Chip>
                                    ) : null}
                                    <span className="putaway__lot-qty">{`${String(each.qty)} ${each.uomCode}`}</span>
                                  </span>
                                </span>
                                <Icon name="chevron_right" size={24} className="putaway__chevron" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {tasks.isSuccess &&
              tasks.data.length === 0 &&
              pendingLots.isSuccess &&
              pendingLots.data.items.length === 0 ? (
                <p className="putaway__note">{d.none}</p>
              ) : null}
              {tasks.data === undefined || tasks.data.length === 0 ? null : (
                <h2>{d.tasksLegend}</h2>
              )}
            </>
          )}

          {/* 카드 전체가 누르는 곳이다. 오른쪽 끝 › 가 고르는 카드임을 말한다. */}
          <ul className="putaway__tasks">
            {shownTasks.map((each) => (
              <li key={each.putawayTaskId}>
                <button
                  type="button"
                  className="putaway__task"
                  onClick={() => {
                    /* 추린 목록에서 고르면 LOT 은 이미 읽었다 - LOT 으로 연 지시와 같다. */
                    const lotNoFromList = lookup?.kind === 'many' ? lookup.lotNo : null;
                    setLookup(null);
                    openTask(each, lotNoFromList);
                  }}
                >
                  {taskFields(each, allowedField(each))}
                  <Icon name="chevron_right" size={24} className="putaway__chevron" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <>
          {/*
           * 지금 처리 중인 지시. 계기판 아래 흰 작업 카드로 붙어 있어, 위치 · LOT 을 스캔하러
           * 내려가도 무엇을 어디로 옮기는지가 화면에 남는다.
           */}
          <TaskHeader
            /*
             * 품목은 코드를 제목으로, 이름을 그 옆 작은 글씨로 - 「이름(코드)」 한 덩어리를 24px 로 세우면
             * 두 줄로 접혀 카드가 커진다. 품목을 아직 못 받았으면 목록과 같은 글로 둔다. 지시 번호는
             * 「자세히」에 둔다 - 손에 든 것과 대조하는 값이 아니다.
             */
            fields={[
              {
                label: t.tasks.itemLabel,
                value:
                  itemLabels.get(task.itemId)?.itemCode ?? referenceLabel(itemCode(task.itemId)),
                strong: true,
              },
              ...(itemLabels.get(task.itemId) === undefined
                ? []
                : [
                    {
                      label: t.tasks.itemNameLabel,
                      value: itemLabels.get(task.itemId)?.itemName ?? '',
                      caption: true,
                    },
                  ]),
              { label: t.tasks.qtyLabel, value: `${String(task.taskQty)} ${uomOf(task.uomId)}` },
              ...(lotNo.data === undefined
                ? []
                : [{ label: t.lot.legend, value: t.lot.expected(lotNo.data), code: true }]),
            ]}
            step={{ index: byLot || locationSettled ? 2 : 1, total: 2 }}
            action={{
              icon: 'list',
              label: t.tasks.change,
              onClick: closeTask,
            }}
            details={
              <>
                <p className="putaway__note">{`${t.tasks.taskNoLabel} ${task.putawayTaskNo}`}</p>
                {/* 둘 곳이 여럿이면 카드에는 첫 코드만 보인다 — 전부는 여기서 본다. */}
                {task.allowedLocations.length < 2 ? null : (
                  <p className="putaway__note">
                    {t.tasks.allowedAll(
                      task.allowedLocations.map((each) => each.locationCode).join(', '),
                    )}
                  </p>
                )}
              </>
            }
          >
            {/* 어디서 어디로. 가야 할 곳이 어두운 칸이라 위치 라벨을 찾는 눈이 먼저 간다. */}
            <TaskRoute
              from={
                codeOf(task.fromLocationId) === ''
                  ? undefined
                  : t.tasks.from(codeOf(task.fromLocationId))
              }
              to={
                allowedSummaryOf(task) === null
                  ? undefined
                  : t.tasks.allowed(allowedSummaryOf(task) ?? '')
              }
              missing={t.tasks.anywhere}
            />
          </TaskHeader>

          {/*
           * LOT 으로 연 지시(omf-all-around#272) - 끝난 LOT 단계를 위에, 할 일인 위치를 아래에 둔다.
           * 다시 읽을 것이 아니라 [LOT 재스캔]은 두지 않는다. 다른 LOT 이면 목록으로 돌아가 다시 읽는다.
           */}
          {!byLot || scannedLot === null ? null : (
            <section className="putaway__section">
              <h2 className="putaway__step-title">
                <span className="putaway__step-badge" aria-hidden="true">
                  1
                </span>
                {t.lotScan.legend}
              </h2>
              <AlertBanner className={verdictClass(false)} variant="success" title={scannedLot}>
                {t.lotScan.fromList}
              </AlertBanner>
            </section>
          )}

          <section className="putaway__section" ref={locationSection}>
            {/*
             * 단계 번호는 작은 뱃지로, 제목과 한 덩어리로 읽히게(사용자 지정 2026-09-22). 번호는 눈으로
             * 보는 차례 표시라 화면 낭독에서는 뺀다 — 넣으면 「1적치 위치」로 붙어 읽힌다.
             */}
            <h2 className="putaway__step-title">
              <span className="putaway__step-badge" aria-hidden="true">
                {byLot ? 2 : 1}
              </span>
              {t.location.legend}
            </h2>
            {locations.isPending ? <p role="status">{t.location.loading}</p> : null}
            {locations.isError ? (
              <FailureBanner
                variant="error"
                title={failureText(locations.error, t.location.loadFailed)}
              />
            ) : null}
            {locations.isSuccess && locations.data.length === 0 ? (
              <AlertBanner variant="warning" title={t.location.none} />
            ) : null}

            {/*
             * 위치를 관리하는 창고는 라벨을 읽어야 오적치를 막는다. 목록 선택을 함께 열어 두면
             * 라벨을 읽지 않고 화면만 보고 적치가 끝난다.
             */}
            {scansLocation(task, locations.data) ? (
              scanResolved ? null : (
                <>
                  <ScanZone
                    field={locationField}
                    label={required(t.location.scanLabel)}
                    prompt={t.location.scanPlaceholder}
                    error={
                      scanned !== null && byCode.isSuccess && byCode.data === null
                        ? t.location.notFound(scanned)
                        : undefined
                    }
                    tools={manualButton(locationField, t.location.manual, t.location.manualSubmit)}
                  />
                  {byCode.isError ? (
                    <FailureBanner
                      variant="error"
                      title={failureText(byCode.error, t.location.loadFailed)}
                    />
                  ) : null}
                </>
              )
            ) : locations.data === undefined ? null : (
              <div className="putaway__field">
                <label htmlFor="putaway-location">{required(t.location.pickLabel)}</label>
                <Select
                  id="putaway-location"
                  placeholder={t.location.pickPlaceholder}
                  size="xl"
                  value={pickedId === null ? null : String(pickedId)}
                  onChange={(value) => {
                    setScanned(null);
                    setPickedId(Number(value));
                  }}
                  /* 둘 곳이 정해져 있으면 그 중에서만 고른다 — 밖의 자리는 서버도 막는다. */
                  options={locations.data
                    .filter(
                      (each) =>
                        task.allowedLocations.length === 0 ||
                        task.allowedLocations.some((one) => one.locationId === each.locationId),
                    )
                    .map((each) => ({
                      value: String(each.locationId),
                      label: `${each.locationCode} ${each.locationName}`,
                    }))}
                />
              </div>
            )}

            {location === null ? null : (
              <>
                {/*
                 * ⭐ 판정 배너는 모두 같은 틀이다(사용자 지정 2026-09-22) — **제목은 읽은 위치**(주 정보),
                 *   **본문은 판정**(보조 정보). 긴 한 문장으로 두지 않는다. 색·아이콘·판정 문구만 판정마다
                 *   다르다. 따로 떠 있던 위치 줄은 걷었다. 배너 안 버튼([위치 재스캔]·[임시 위치 적재로
                 *   이동])은 모두 글자와 같은 행 오른쪽에 같은 모양으로 선다.
                 */}
                {verdict === MATCHED ? (
                  <AlertBanner
                    className={verdictClass(scanResolved)}
                    variant="success"
                    title={t.location.scanned(location.locationCode, location.locationName)}
                    action={scanResolved ? rescanButton : undefined}
                  >
                    {t.verdict.matched}
                  </AlertBanner>
                ) : null}

                {/*
                 * 다른 곳에 두면 다음 사람이 찾지 못한다. 임시로 두는 길은 다른 화면이 받는다 — 안내는
                 * 글로, 가는 길은 버튼으로 가른다(사용자 지정). 스캔 칸은 남아 있어 곧바로 다시 읽는다.
                 */}
                {verdict === NOT_ALLOWED ? (
                  <AlertBanner
                    className="putaway__verdict putaway__verdict--action"
                    variant={confirmedOutside ? 'info' : 'warning'}
                    title={t.location.scanned(location.locationCode, location.locationName)}
                    action={
                      confirmedOutside ? (
                        rescanButton
                      ) : (
                        <Button variant="outlined" size="lg" onClick={toTemporaryPutaway}>
                          {t.verdict.temporaryMove}
                        </Button>
                      )
                    }
                  >
                    {confirmedOutside ? (
                      <span className="putaway__verdict-line">{t.verdict.outsideConfirmed}</span>
                    ) : (
                      <>
                        <span className="putaway__verdict-line">
                          {messages.putaway.direct.verdict.UNDESIGNATED}
                        </span>
                        <span className="putaway__verdict-line">
                          {t.verdict.notAllowed(allowedSummaryOf(task) ?? '')}
                        </span>
                        <span className="putaway__verdict-line">
                          {messages.putaway.direct.notYetRecorded}
                        </span>
                      </>
                    )}
                  </AlertBanner>
                ) : null}

                {/* 둘 곳을 정하지 않은 품목 — 이 창고 어디든 둔다. 어디에 두었는지는 기록에 남는다. */}
                {verdict === ANYWHERE ? (
                  <AlertBanner
                    className={verdictClass(scanResolved)}
                    variant="info"
                    title={t.location.scanned(location.locationCode, location.locationName)}
                    action={scanResolved ? rescanButton : undefined}
                  >
                    {t.verdict.anywhere}
                  </AlertBanner>
                ) : null}
              </>
            )}
          </section>

          {byLot || !locationSettled ? null : (
            <section className="putaway__section" ref={lotSection}>
              <h2 className="putaway__step-title">
                <span className="putaway__step-badge" aria-hidden="true">
                  2
                </span>
                {t.lot.legend}
              </h2>
              {lotNo.isPending ? <p role="status">{t.lot.loading}</p> : null}
              {lotNo.isError ? (
                <FailureBanner variant="error" title={failureText(lotNo.error, t.lot.loadFailed)} />
              ) : null}
              {/*
               * ⭐ 위치와 같은 틀(사용자 지정 2026-09-22) — 지시 LOT 과 맞으면 스캔 칸을 접고, 판정 배너
               *   (제목 = 읽은 LOT, 본문 = 판정) 안 오른쪽의 [LOT 재스캔]으로만 다시 연다. 맞지 않으면
               *   곧바로 다시 읽어야 하므로 칸을 남긴다.
               */}
              {lotMatched ? null : (
                <ScanZone
                  field={lotField}
                  label={required(t.lot.scanLabel)}
                  prompt={t.lot.scanPlaceholder}
                  tools={manualButton(lotField, t.lot.manual, t.lot.manualSubmit)}
                />
              )}

              {scannedLot === null ? null : lotMatched ? (
                <AlertBanner
                  className={verdictClass(true)}
                  variant="success"
                  title={scannedLot}
                  action={
                    <Button
                      variant="outlined"
                      size="lg"
                      onClick={() => {
                        setScannedLot(null);
                      }}
                    >
                      {t.lot.rescan}
                    </Button>
                  }
                >
                  {t.lot.matched}
                </AlertBanner>
              ) : (
                <AlertBanner className={verdictClass(false)} variant="error" title={scannedLot}>
                  {t.lot.mismatch}
                </AlertBanner>
              )}
            </section>
          )}

          {saveFailed || worker === null ? (
            <section className="putaway__section">
              {saveFailed ? (
                <AlertBanner variant="error" title={t.saveFailed.title}>
                  {t.saveFailed.description}
                </AlertBanner>
              ) : null}
            </section>
          ) : null}
        </>
      )}

      {/*
       * 서버가 거절한 것 — 적치되지 않았으므로 「전송하지 못한 적치」로 모아 「전송 실패한 기록」으로 안내한다(실제 앱 확인
       * 2026-11-18). 줄은 「LOT → 위치」 글이 한 줄 폭을 다 쓰고, 방식 · 결과 칩은 그 아래에 선다. 받거나 담긴 것을 세던
       * 「적치됨」 목록은 지웠다(피처 011).
       */}
      {failed.length === 0 ? null : (
        <section className="putaway__section">
          <h2>{t.rejected.count(String(failed.length))}</h2>
          <ul className="putaway__done">{failed.map(doneRow)}</ul>
          <AlertBanner variant="error" title={t.rejected.title}>
            {t.rejected.description}
            <Link to="/rejections">{t.rejected.action}</Link>
          </AlertBanner>
        </section>
      )}

      {/*
       * 떠 있는 직접 입력 단추(오른쪽 아래)가 마지막 내용을 가리지 않게 그 높이만큼 비운다 — 목록에는 바닥 바가 없어
       * 단추가 화면 바닥에 뜬다(실제 앱 확인 2026-11-18 · 「전송 실패한 기록 보기」가 가려졌다).
       */}
      {task === null && pendingLot === null ? (
        <div className="putaway__tools-clearance" aria-hidden="true" />
      ) : null}

      {/*
       * 목록에는 단추가 없다 - 건마다 기록되고, 화면을 닫는 것은 위 ← · 홈 아이콘이다. 화면만 닫던
       * [적치 완료]가 기록 단추로 오해됐다(omf-all-around#272). 카드로 고른 지시는 [적치 완료]가 기록한다.
       * LOT 으로 연 지시는 위치 스캔이 곧 기록이라 단추 자리에 그 사실을 적는다.
       */}
      {task !== null && location !== null && outsideUnconfirmed ? (
        /* 보관 위치 밖 — 확인 한 번(T054). 지시 없는 적치의 미지정 위치와 같은 두 단추. */
        <BottomActionBar
          primary={{
            label: messages.putaway.direct.confirmUndesignated,
            onClick: () => setConfirmedOutside(true),
          }}
          secondary={{ label: messages.putaway.direct.rescan, onClick: rescanLocation }}
        />
      ) : task === null ? null : byLot ? (
        <BottomActionBar
          prompt={
            <p
              className={
                task.allowedLocations.length > 0
                  ? 'putaway__auto-note'
                  : 'putaway__auto-note putaway__auto-note--risk'
              }
            >
              <Icon
                name={task.allowedLocations.length > 0 ? 'barcode_scanner' : 'warning'}
                size={20}
              />
              <span>
                {task.allowedLocations.length > 0 ? t.lotScan.auto : t.lotScan.autoAnywhere}
              </span>
            </p>
          }
        />
      ) : (
        <BottomActionBar
          primary={{
            label: t.record1,
            disabled: !ready,
            lockReason: recordLock,
            onClick: () => void complete(),
          }}
        />
      )}
    </div>
  );
};
