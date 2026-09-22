import { AlertBanner, Button, Card, Chip, Select, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';

import { useAdvanceTo } from '../../patterns/advance-to';
import { useBackStep } from '../../patterns/back-step';
import { playErrorTone } from '../../patterns/error-tone';
import { displayNameOf, useCodeValues } from '../../patterns/code-values';
import { uomLabelOf, useItemCodes, useItemLabels, useUomCodes } from '../../patterns/masters';
import { referenceLabel } from '../../patterns/reference';
import { useOutbox } from '../../patterns/outbox';
import { useScanField } from '../../patterns/use-scan-field';
import { useScreenTitle } from '../../patterns/screen-title';
import { useWorkerSession } from '../../patterns/worker-session';
import { useWorkerId } from '../../patterns/workers';
import { useLocationByCode, useLocations, type Location } from '../../patterns/locations';
import { FailureBanner } from '../../patterns/failure-banner';
import { useLoadFailure } from '../../patterns/load-failure';
import {
  putawayKeys,
  useLocationContents,
  usePutawayRule,
  usePutawayTasks,
  useTaskLotNo,
} from './queries';
import {
  MATCHED,
  MIXED_ITEM,
  NOT_RECOMMENDED,
  NO_RULE,
  canComplete,
  lotMatches,
  STORAGE_CONDITION,
  mixProblemOf,
  overCapacityOf,
  storageMismatch,
  scansLocation,
  toOutboxDraft,
  verdictOf,
  type PutawayTask,
} from './putaway';
import './screen.css';

const t = messages.putaway;
/* 필수 표시는 화면마다 짓지 않는다. 같은 뜻이 여러 모양으로 갈린다. */
const required = messages.common.required;

const WORK_LIST_PATH = '/screens';

type Outcome = 'queued' | 'sent' | 'rejected';

interface Registered {
  key: string;
  lotNo: string;
  locationCode: string;
  qty: string;
  outcome: Outcome;
}

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
  const [scannedLot, setScannedLot] = useState<string | null>(null);
  /* 같은 코드를 다시 스캔한 것도 한 회차다. 값만 보면 두 번째 스캔이 조용히 지나간다. */
  const [scanSeq, setScanSeq] = useState(0);
  const [confirmedNoRule, setConfirmedNoRule] = useState(false);
  const [registered, setRegistered] = useState<Registered[]>([]);
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
  const locations = useLocations(task?.warehouseId ?? null);
  const byCode = useLocationByCode(task?.warehouseId ?? null, scanned);
  const uoms = useUomCodes(true);
  const uomOf = (uomId: number | null | undefined) => uomLabelOf(uoms.data, uomId);
  const itemLabels = useItemLabels((tasks.data ?? []).map((each) => each.itemId));
  const itemCode = useItemCodes(
    (tasks.data ?? []).map((each) => each.itemId),
    (item) => messages.common.reference.named(item.itemName, item.itemCode),
  );
  const lotNo = useTaskLotNo(task?.lotId ?? null);
  const rule = usePutawayRule(task?.appliedPutawayRuleId ?? null);

  const codeOf = (locationId: number | null | undefined): string =>
    locations.data?.find((each) => each.locationId === locationId)?.locationCode ?? '';

  const location: Location | null =
    pickedId === null
      ? (byCode.data ?? null)
      : (locations.data?.find((each) => each.locationId === pickedId) ?? null);

  const contents = useLocationContents(task?.warehouseId ?? null, location?.locationId ?? null);
  const held = contents.data ?? [];
  /*
   * 잔액을 받기 전과 받지 못한 것은 부딪치는 것이 없다는 뜻이 아니다 - 빈 목록으로 판정하면
   * 혼적이 막힌 자리가 조회 실패 한 번에 열린다.
   */
  const contentsKnown = contents.isSuccess;

  const verdict = task === null || location === null ? null : verdictOf(task, location);
  const mixProblem =
    task === null || location === null || !contentsKnown
      ? null
      : mixProblemOf(task, location, held);
  const overCapacity =
    task === null || location === null || !contentsKnown
      ? null
      : overCapacityOf(task, location, held);
  /*
   * 품목과 자리의 보관조건은 같은 코드계다. 어긋나도 막지 않는다 - 설계가 경고로 정했고,
   * 냉장 자리가 없어 상온에 두어야 하는 날이 있다.
   */
  const itemCondition =
    task === null ? null : (itemLabels.get(task.itemId)?.storageConditionCode ?? null);
  const storageOff =
    location === null ? false : storageMismatch(itemCondition, location.storageConditionCode);
  /* 표시명은 서버가 갖는다. 코드 문자열을 그대로 보이면 현장이 영문을 읽는다. */
  const storageNames = useCodeValues(STORAGE_CONDITION);

  /* 위치가 통과해야 LOT 을 묻는다 - 순서를 바꾸면 오적치를 막을 자리가 사라진다. */
  const locationSettled =
    location !== null &&
    contentsKnown &&
    mixProblem === null &&
    (verdict === MATCHED || (verdict === NO_RULE && confirmedNoRule));

  const ready =
    contentsKnown &&
    canComplete({
      task,
      location,
      lotNo: lotNo.data ?? null,
      scannedLot,
      contents: held,
      confirmedNoRule,
      hasWorker: worker !== null,
    });

  /*
   * 위치가 막혔다는 것을 소리로도 알린다(공유계약 D-2 · §6). 스캔은 단말을 허리에 매단 채
   * 하므로 화면에만 적으면 사람은 통과한 줄 알고 다음 동작으로 넘어간다.
   */
  const locationBlocked =
    scanned !== null &&
    ((byCode.isSuccess && byCode.data === null) ||
      verdict === NOT_RECOMMENDED ||
      mixProblem !== null);

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
   * ⭐ **막힌 판정이면 접지 않는다**(사용자 지정 2026-09-22) — 권장 위치가 아니거나 자리에 다른
   *   품목·LOT 이 있으면 곧바로 다른 자리를 읽어야 하므로 칸을 그대로 둔다. 자리 내용을 아직
   *   모르면(조회 중·실패) 판정이 서지 않았으니 역시 접지 않는다 — 접었다 다시 펼치는 깜빡임도 막는다.
   */
  const locationRejected = verdict === NOT_RECOMMENDED || mixProblem !== null;
  const scanResolved =
    task !== null &&
    scansLocation(task) &&
    scanned !== null &&
    location !== null &&
    contentsKnown &&
    !locationRejected;

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
    setConfirmedNoRule(false);
  };

  const clearScans = () => {
    setPickedId(null);
    setScanned(null);
    setScannedLot(null);
    setConfirmedNoRule(false);
  };

  const locationField = useScanField({
    onScan: (value) => {
      setScanned(value.trim());
      setScanSeq((seq) => seq + 1);
      setPickedId(null);
      setConfirmedNoRule(false);
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
  useBackStep(task !== null && !locationSettled, () => {
    setTask(null);
    clearScans();
  });

  const complete = async () => {
    if (task === null || location === null || worker === null || inFlight.current) {
      return;
    }

    inFlight.current = true;
    setSaveFailed(false);

    const entry = toOutboxDraft(task, location, confirmedNoRule, new Date(), worker.workerNo);
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

      setRegistered((prev) => [...prev, { ...row, outcome }]);

      /*
       * 목록을 다시 읽는다 - 그러지 않으면 방금 끝낸 지시가 그대로 서 있어 같은 자리를 두 번
       * 적치할 수 있다.
       */
      await queryClient.invalidateQueries({ queryKey: putawayKeys.tasks(workerId.data ?? null) });
      setTask(null);
      clearScans();
    } finally {
      inFlight.current = false;
    }
  };

  /*
   * 세 값에 이름을 붙여 세로로 세운다. 한 줄에 늘어놓으면 어느 것이 품목이고 어느 것이 지시
   * 번호인지 형식을 아는 사람만 읽고, 360dp 에서 접히면 그 경계마저 흐려진다.
   */
  const taskFields = (each: PutawayTask, extra?: ReactNode) => (
    <dl className="putaway__task-fields">
      <dt>{t.tasks.itemLabel}</dt>
      <dd>
        <strong>{referenceLabel(itemCode(each.itemId))}</strong>
      </dd>
      <dt>{t.tasks.taskNoLabel}</dt>
      <dd>{each.putawayTaskNo}</dd>
      <dt>{t.tasks.qtyLabel}</dt>
      <dd>{`${String(each.taskQty)} ${uomOf(each.uomId)}`}</dd>
      {extra}
    </dl>
  );

  /*
   * 목록에서는 위치 코드를 아직 받지 못했다. 식별자를 그대로 보이면 사람이 읽을 수 없는
   * 번호가 권장 위치인 척한다 - 있고 없고만 말한다.
   */
  const ruleField = (each: PutawayTask) => (
    <>
      <dt>{t.tasks.ruleLabel}</dt>
      <dd>
        {each.recommendedLocationId === null || each.recommendedLocationId === undefined
          ? t.tasks.ruleNo
          : t.tasks.ruleYes}
      </dd>
    </>
  );

  return (
    <div className="putaway">
      {task === null ? (
        <section className="putaway__section">
          <h2>{t.tasks.legend}</h2>
          {worker === null ? <p className="putaway__note">{t.noWorker}</p> : null}
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
          {tasks.isSuccess && tasks.data.length === 0 ? (
            <p className="putaway__note">{t.tasks.none}</p>
          ) : null}
          {tasks.data !== undefined && tasks.data.length > 0 ? (
            <p className="putaway__note">{t.tasks.count(String(tasks.data.length))}</p>
          ) : null}

          <ul className="putaway__tasks">
            {(tasks.data ?? []).map((each) => (
              <li key={each.putawayTaskId}>
                <Card
                  bordered
                  interactive
                  onClick={() => {
                    setTask(each);
                    clearScans();
                  }}
                >
                  <Card.Body className="card-body putaway__task">
                    {taskFields(each, ruleField(each))}
                  </Card.Body>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <>
          <section className="putaway__section">
            <h2>{t.tasks.legend}</h2>
            <Card bordered>
              <Card.Body className="card-body putaway__card">
                {taskFields(task)}
                {lotNo.data === undefined ? null : (
                  <p className="putaway__scanned">{t.lot.expected(lotNo.data)}</p>
                )}
                <p className="putaway__note">{t.tasks.from(codeOf(task.fromLocationId))}</p>
                {task.recommendedLocationId === null || task.recommendedLocationId === undefined ? (
                  <Chip status="warning">{t.tasks.noRule}</Chip>
                ) : (
                  <Chip>{t.tasks.recommended(codeOf(task.recommendedLocationId))}</Chip>
                )}
                {/* 왜 이 자리인지를 함께 보이면 사람에게 판단할 근거가 생긴다. */}
                {rule.data === undefined ? null : (
                  <p className="putaway__note">{t.tasks.rule(String(rule.data.priorityNo))}</p>
                )}
              </Card.Body>
            </Card>
            <Button
              variant="text"
              size="lg"
              onClick={() => {
                setTask(null);
                clearScans();
              }}
            >
              {t.tasks.change}
            </Button>
          </section>

          <section className="putaway__section" ref={locationSection}>
            {/* 단계 번호는 작은 뱃지로, 제목과 한 덩어리로 읽히게(사용자 지정 2026-09-22). */}
            <h2 className="putaway__step-title">
              <span className="putaway__step-badge">1</span>
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
            {scansLocation(task) ? (
              scanResolved ? null : (
                <>
                  <TextField
                    ref={locationField.ref}
                    label={required(t.location.scanLabel)}
                    placeholder={t.location.scanPlaceholder}
                    size="xl"
                    fullWidth
                    error={
                      scanned !== null && byCode.isSuccess && byCode.data === null
                        ? t.location.notFound(scanned)
                        : undefined
                    }
                  />
                  {byCode.isError ? (
                    <FailureBanner
                      variant="error"
                      title={failureText(byCode.error, t.location.loadFailed)}
                    />
                  ) : null}
                  {/* 스캐너가 못 읽는 라벨이 있다. 손으로 넣는 길을 늘 연다(공유계약 D-3). */}
                  <Button
                    className="putaway__wide"
                    variant={locationField.manual ? 'outlined' : 'text'}
                    size="xl"
                    onClick={
                      locationField.manual ? locationField.submitManual : locationField.openManual
                    }
                  >
                    {locationField.manual ? t.location.manualSubmit : t.location.manual}
                  </Button>
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
                    setConfirmedNoRule(false);
                  }}
                  options={locations.data.map((each) => ({
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
                {verdict === MATCHED && mixProblem === null ? (
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
                {verdict === NOT_RECOMMENDED ? (
                  <AlertBanner
                    className="putaway__verdict putaway__verdict--action"
                    variant="error"
                    title={t.location.scanned(location.locationCode, location.locationName)}
                    action={
                      <Button variant="outlined" size="lg" onClick={toTemporaryPutaway}>
                        {t.verdict.temporaryMove}
                      </Button>
                    }
                  >
                    <span className="putaway__verdict-line">
                      {t.verdict.notRecommended(codeOf(task.recommendedLocationId))}
                    </span>
                    <span className="putaway__verdict-line">{t.verdict.temporary}</span>
                  </AlertBanner>
                ) : null}

                {/* 지금 그 자리에 있는 것과 부딪친다. 얹으면 다음 사람이 찾지 못한다. */}
                {mixProblem === null ? null : (
                  <AlertBanner
                    className="putaway__verdict putaway__verdict--action"
                    variant="error"
                    title={t.location.scanned(location.locationCode, location.locationName)}
                    action={
                      <Button variant="outlined" size="lg" onClick={toTemporaryPutaway}>
                        {t.verdict.temporaryMove}
                      </Button>
                    }
                  >
                    <span className="putaway__verdict-line">
                      {mixProblem === MIXED_ITEM ? t.mix.item : t.mix.lot}
                    </span>
                    <span className="putaway__verdict-line">{t.mix.temporary}</span>
                  </AlertBanner>
                )}

                {/* 규칙이 없다고 막으면 미등록 품목이 적치 자체를 못 한다. 확인을 받고 통과시킨다. */}
                {verdict === NO_RULE && mixProblem === null ? (
                  <>
                    <AlertBanner
                      className={verdictClass(scanResolved)}
                      variant="warning"
                      title={t.location.scanned(location.locationCode, location.locationName)}
                      action={scanResolved ? rescanButton : undefined}
                    >
                      {t.verdict.noRule}
                    </AlertBanner>
                    <Button
                      className="putaway__wide"
                      variant={confirmedNoRule ? 'filled' : 'outlined'}
                      size="xl"
                      onClick={() => {
                        setConfirmedNoRule(true);
                      }}
                    >
                      {t.verdict.noRuleConfirm}
                    </Button>
                  </>
                ) : null}

                {/* 막지 않는다. 모르면 말하지 않는다 - 둘 중 하나가 비면 어긋났다 할 근거가 없다. */}
                {!storageOff || location === null ? null : (
                  <AlertBanner
                    variant="warning"
                    title={t.storageMismatch(
                      displayNameOf(storageNames.data ?? [], itemCondition ?? ''),
                      displayNameOf(storageNames.data ?? [], location.storageConditionCode ?? ''),
                    )}
                  />
                )}

                {/* 막지 않는다. 넘겨서 두는 판단은 자리를 보는 사람이 한다. */}
                {overCapacity === null ? null : (
                  <AlertBanner
                    variant="warning"
                    title={t.overCapacity(
                      String(overCapacity.capacity),
                      String(overCapacity.held),
                      String(task.taskQty),
                    )}
                  />
                )}
              </>
            )}
          </section>

          {!locationSettled ? null : (
            <section className="putaway__section" ref={lotSection}>
              <h2 className="putaway__step-title">
                <span className="putaway__step-badge">2</span>
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
                <>
                  <TextField
                    ref={lotField.ref}
                    label={required(t.lot.scanLabel)}
                    placeholder={t.lot.scanPlaceholder}
                    size="xl"
                    fullWidth
                  />
                  <Button
                    className="putaway__wide"
                    variant={lotField.manual ? 'outlined' : 'text'}
                    size="xl"
                    onClick={lotField.manual ? lotField.submitManual : lotField.openManual}
                  >
                    {lotField.manual ? t.lot.manualSubmit : t.lot.manual}
                  </Button>
                </>
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

          <section className="putaway__section">
            {saveFailed ? (
              <AlertBanner variant="error" title={t.saveFailed.title}>
                {t.saveFailed.description}
              </AlertBanner>
            ) : null}
            {worker === null ? <p className="putaway__note">{t.noWorker}</p> : null}
            <Button
              className="putaway__wide"
              variant="filled"
              size="2xl"
              disabled={!ready}
              onClick={() => void complete()}
            >
              {t.record1}
            </Button>
          </section>
        </>
      )}

      {registered.length === 0 ? null : (
        <section className="putaway__section">
          <h2>{t.done.count(String(registered.length))}</h2>
          <ul className="putaway__done">
            {registered.map((each) => (
              <li key={each.key}>
                <span className="putaway__scanned">
                  {t.done.row(each.lotNo, each.locationCode, each.qty)}
                </span>
                {each.outcome === 'rejected' ? (
                  <Chip status="error">{t.rejected.title}</Chip>
                ) : each.outcome === 'queued' ? (
                  <Chip status="warning">{t.queued.title}</Chip>
                ) : (
                  <Chip status="success">{t.sent.title}</Chip>
                )}
              </li>
            ))}
          </ul>
          {registered.some((each) => each.outcome === 'rejected') ? (
            <AlertBanner variant="error" title={t.rejected.title}>
              {t.rejected.description}
              <Link to="/rejections">{t.rejected.action}</Link>
            </AlertBanner>
          ) : null}
        </section>
      )}

      {/* 건별로 이미 저장됐다. 마치는 것은 이 화면을 닫는 일이라 서버를 부르지 않는다. */}
      <div className="action-bar">
        <Button
          className="putaway__wide"
          variant="outlined"
          size="2xl"
          disabled={registered.length === 0}
          onClick={() => {
            void navigate(WORK_LIST_PATH);
          }}
        >
          {t.done.submit}
        </Button>
      </div>
    </div>
  );
};
