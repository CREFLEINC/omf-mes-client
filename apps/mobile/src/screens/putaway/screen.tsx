import { AlertBanner, Button, Card, Chip, Select, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { useAdvanceTo } from '../../patterns/advance-to';
import { useBackStep } from '../../patterns/back-step';
import { playErrorTone } from '../../patterns/error-tone';
import { useItemLabels, useUomCodes } from '../../patterns/masters';
import { formatMaterialLotNo } from '../../patterns/material-lot-no';
import { useOutbox } from '../../patterns/outbox';
import { useScanField } from '../../patterns/use-scan-field';
import { useScreenTitle } from '../../patterns/screen-title';
import { useWorkerSession } from '../../patterns/worker-session';
import { useWorkerId } from '../../patterns/workers';
import { useLocationByCode, useLocations, type Location } from '../../patterns/locations';
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
  mixProblemOf,
  overCapacityOf,
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
  const itemLabels = useItemLabels(true);
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
      qty: `${String(task.taskQty)} ${uoms.data?.get(task.uomId) ?? ''}`,
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

  const taskLabel = (each: PutawayTask) =>
    t.tasks.item(
      itemLabels.data?.get(each.itemId)?.itemCode ?? '',
      each.putawayTaskNo,
      `${String(each.taskQty)} ${uoms.data?.get(each.uomId) ?? ''}`,
    );

  return (
    <div className="putaway">
      {task === null ? (
        <section className="putaway__section">
          <h2>{t.tasks.legend}</h2>
          {worker === null ? <p className="putaway__note">{t.noWorker}</p> : null}
          {workerId.isPending && worker !== null ? <p role="status">{t.worker.loading}</p> : null}
          {workerId.isError ? <AlertBanner variant="error" title={t.worker.loadFailed} /> : null}
          {/* 비우고 물으면 남의 지시까지 온다. 찾지 못하면 목록을 열지 않는다. */}
          {workerId.isSuccess && workerId.data === null ? (
            <AlertBanner variant="warning" title={t.worker.notFound(worker?.workerNo ?? '')} />
          ) : null}

          {tasks.isPending && workerId.data !== null ? (
            <p role="status">{t.tasks.loading}</p>
          ) : null}
          {tasks.isError ? <AlertBanner variant="error" title={t.tasks.loadFailed} /> : null}
          {tasks.data !== undefined && tasks.data.length === 0 ? (
            <p className="putaway__note">{t.tasks.none}</p>
          ) : null}
          {tasks.data !== undefined && tasks.data.length > 0 ? (
            <p className="putaway__note">{t.tasks.count(String(tasks.data.length))}</p>
          ) : null}

          <ul className="putaway__tasks">
            {(tasks.data ?? []).map((each) => (
              <li key={each.putawayTaskId}>
                <Button
                  className="putaway__wide"
                  variant="outlined"
                  size="xl"
                  onClick={() => {
                    setTask(each);
                    clearScans();
                  }}
                >
                  <span className="putaway__task">
                    <strong>{taskLabel(each)}</strong>
                    {/*
                     * 목록에서는 위치 코드를 아직 받지 못했다. 식별자를 그대로 보이면 사람이
                     * 읽을 수 없는 번호가 권장 위치인 척한다 - 있고 없고만 말한다.
                     */}
                    <span>
                      {each.recommendedLocationId === null ||
                      each.recommendedLocationId === undefined
                        ? t.tasks.noRule
                        : t.tasks.hasRule}
                    </span>
                  </span>
                </Button>
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
                <strong>{taskLabel(task)}</strong>
                {lotNo.data === undefined ? null : (
                  /* 34자리를 붙여 쓰면 실물 라벨과 눈으로 대조할 수 없다(공유계약 E-2). */
                  <p className="putaway__scanned">
                    {t.lot.expected(formatMaterialLotNo(lotNo.data))}
                  </p>
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
            <h2>{t.location.legend}</h2>
            {locations.isPending ? <p role="status">{t.location.loading}</p> : null}
            {locations.isError ? (
              <AlertBanner variant="error" title={t.location.loadFailed} />
            ) : null}
            {locations.data !== undefined && locations.data.length === 0 ? (
              <AlertBanner variant="warning" title={t.location.none} />
            ) : null}

            {/*
             * 위치를 관리하는 창고는 라벨을 읽어야 오적치를 막는다. 목록 선택을 함께 열어 두면
             * 라벨을 읽지 않고 화면만 보고 적치가 끝난다.
             */}
            {scansLocation(task) ? (
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
                  <AlertBanner variant="error" title={t.location.loadFailed} />
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
                <p>{t.location.chosen(location.locationCode, location.locationName)}</p>

                {verdict === MATCHED && mixProblem === null ? (
                  <AlertBanner variant="success" title={t.verdict.matched} />
                ) : null}

                {/* 다른 곳에 두면 다음 사람이 찾지 못한다. 임시로 두는 길은 다른 화면이 받는다. */}
                {verdict === NOT_RECOMMENDED ? (
                  <AlertBanner
                    variant="error"
                    title={t.verdict.notRecommended(codeOf(task.recommendedLocationId))}
                  >
                    <Link to="/temporary-putaway" state={{ task }}>
                      {t.verdict.temporary}
                    </Link>
                  </AlertBanner>
                ) : null}

                {/* 지금 그 자리에 있는 것과 부딪친다. 얹으면 다음 사람이 찾지 못한다. */}
                {mixProblem === null ? null : (
                  <AlertBanner
                    variant="error"
                    title={mixProblem === MIXED_ITEM ? t.mix.item : t.mix.lot}
                  >
                    <Link to="/temporary-putaway" state={{ task }}>
                      {t.mix.temporary}
                    </Link>
                  </AlertBanner>
                )}

                {/* 규칙이 없다고 막으면 미등록 품목이 적치 자체를 못 한다. 확인을 받고 통과시킨다. */}
                {verdict === NO_RULE && mixProblem === null ? (
                  <>
                    <AlertBanner variant="warning" title={t.verdict.noRule} />
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
              <h2>{t.lot.legend}</h2>
              {lotNo.isPending ? <p role="status">{t.lot.loading}</p> : null}
              {lotNo.isError ? <AlertBanner variant="error" title={t.lot.loadFailed} /> : null}
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

              {scannedLot === null ? null : lotMatches(lotNo.data ?? null, scannedLot) ? (
                <p className="putaway__scanned">{t.lot.matched(formatMaterialLotNo(scannedLot))}</p>
              ) : (
                <AlertBanner variant="error" title={t.lot.mismatch} />
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
                  {t.done.row(formatMaterialLotNo(each.lotNo), each.locationCode, each.qty)}
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
