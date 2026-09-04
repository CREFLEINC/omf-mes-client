import { AlertBanner, Button, Card, Chip, Select, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useRef, useState } from 'react';
import { Link } from 'react-router';

import { useUomCodes } from '../../patterns/masters';
import { useOutbox } from '../../patterns/outbox';
import { useScanField } from '../../patterns/use-scan-field';
import { useScreenTitle } from '../../patterns/screen-title';
import { useWorkerSession } from '../../patterns/worker-session';
import { useWorkerId } from '../../patterns/workers';
import { useLocationByCode, useLocations, type Location } from '../../patterns/locations';
import { usePutawayTasks } from './queries';
import {
  MATCHED,
  NOT_RECOMMENDED,
  NO_RULE,
  canComplete,
  isSingleItemOnly,
  toOutboxDraft,
  verdictOf,
  type PutawayTask,
} from './putaway';
import './screen.css';

const t = messages.putaway;

type Outcome = 'queued' | 'sent' | 'rejected';

export const PutawayScreen = () => {
  useScreenTitle(t.title);

  const { enqueue, flush, isRejected } = useOutbox();
  const { worker } = useWorkerSession();

  const [task, setTask] = useState<PutawayTask | null>(null);
  const [pickedId, setPickedId] = useState<number | null>(null);
  const [scanned, setScanned] = useState<string | null>(null);
  const [confirmedNoRule, setConfirmedNoRule] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  /*
   * 보내는 중인가. 상태로 두면 같은 틱에 두 번 누른 것을 막지 못한다 - 다시 그리기 전에
   * 두 번째가 들어와 멱등키가 다른 두 건이 담기고, 서버가 흡수하지 못해 두 건이 기록된다.
   */
  const inFlight = useRef(false);

  const scanField = useScanField({
    onScan: (value) => {
      setScanned(value.trim());
      setPickedId(null);
      setConfirmedNoRule(false);
    },
  });

  const workerId = useWorkerId(worker?.workerNo ?? null);
  const tasks = usePutawayTasks(workerId.data ?? null);
  const locations = useLocations(task?.warehouseId ?? null);
  const byCode = useLocationByCode(task?.warehouseId ?? null, scanned);
  const uoms = useUomCodes(true);

  const codeOf = (locationId: number | null | undefined): string =>
    locations.data?.find((each) => each.locationId === locationId)?.locationCode ?? '';

  const location: Location | null =
    pickedId === null
      ? (byCode.data ?? null)
      : (locations.data?.find((each) => each.locationId === pickedId) ?? null);

  const verdict = task === null || location === null ? null : verdictOf(task, location);
  const ready = canComplete(task, location, confirmedNoRule, worker !== null);

  const restart = () => {
    setTask(null);
    setPickedId(null);
    setScanned(null);
    setConfirmedNoRule(false);
    setOutcome(null);
    setSaveFailed(false);
    scanField.focus();
  };

  const complete = async () => {
    if (task === null || location === null || worker === null || inFlight.current) {
      return;
    }

    inFlight.current = true;
    setSaveFailed(false);

    const entry = toOutboxDraft(task, location, confirmedNoRule, new Date(), worker.workerNo);

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
      if (
        (result !== null && result.rejected.some((each) => mine(each.entry))) ||
        isRejected(entry.idempotencyKey)
      ) {
        setOutcome('rejected');
        return;
      }

      setOutcome(result === null || result.remaining.some(mine) ? 'queued' : 'sent');
    } finally {
      inFlight.current = false;
    }
  };

  if (outcome !== null) {
    return (
      <div className="putaway">
        {outcome === 'sent' ? <AlertBanner variant="success" title={t.sent.title} /> : null}
        {outcome === 'queued' ? (
          <AlertBanner variant="warning" title={t.queued.title}>
            {t.queued.description}
          </AlertBanner>
        ) : null}
        {outcome === 'rejected' ? (
          <AlertBanner variant="error" title={t.rejected.title}>
            {t.rejected.description}
            <Link to="/rejections">{t.rejected.action}</Link>
          </AlertBanner>
        ) : null}
        <Button className="putaway__wide" variant="filled" size="2xl" onClick={restart}>
          {t.another}
        </Button>
      </div>
    );
  }

  if (task === null) {
    return (
      <div className="putaway">
        <section className="putaway__section">
          <h2>{t.tasks.legend}</h2>
          {worker === null ? <p className="putaway__note">{t.noWorker}</p> : null}
          {workerId.isPending && worker !== null ? <p role="status">{t.worker.loading}</p> : null}
          {workerId.isError ? <AlertBanner variant="error" title={t.worker.loadFailed} /> : null}
          {/* 비우고 물으면 남의 지시까지 온다. 찾지 못하면 목록을 열지 않는다. */}
          {workerId.isSuccess && workerId.data === null ? (
            <AlertBanner
              variant="warning"
              title={t.worker.notFound(worker?.workerNo ?? '')}
            />
          ) : null}

          {tasks.isPending && workerId.data !== null ? (
            <p role="status">{t.tasks.loading}</p>
          ) : null}
          {tasks.isError ? <AlertBanner variant="error" title={t.tasks.loadFailed} /> : null}
          {tasks.data !== undefined && tasks.data.length === 0 ? (
            <p className="putaway__note">{t.tasks.none}</p>
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
                    setPickedId(null);
                    setScanned(null);
                    setConfirmedNoRule(false);
                  }}
                >
                  <span className="putaway__task">
                    <strong>{each.putawayTaskNo}</strong>
                    <span>
                      {t.tasks.qty(`${String(each.taskQty)} ${uoms.data?.get(each.uomId) ?? ''}`)}
                    </span>
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
      </div>
    );
  }

  return (
    <div className="putaway">
      <section className="putaway__section">
        <h2>{t.tasks.legend}</h2>
        <Card bordered>
          <Card.Body className="card-body putaway__card">
            <strong>{task.putawayTaskNo}</strong>
            <p>{t.tasks.qty(`${String(task.taskQty)} ${uoms.data?.get(task.uomId) ?? ''}`)}</p>
            <p className="putaway__note">{t.tasks.from(codeOf(task.fromLocationId))}</p>
            {task.recommendedLocationId === null || task.recommendedLocationId === undefined ? (
              <Chip status="warning">{t.tasks.noRule}</Chip>
            ) : (
              <Chip>{t.tasks.recommended(codeOf(task.recommendedLocationId))}</Chip>
            )}
            {/* 값 목록이 확정되기 전이라 코드를 그대로 보인다. */}
            {task.warehouseManagementLevelCode === undefined ? null : (
              <p className="putaway__note">{t.tasks.level(task.warehouseManagementLevelCode)}</p>
            )}
          </Card.Body>
        </Card>
        <Button
          variant="text"
          size="lg"
          onClick={() => {
            setTask(null);
            setPickedId(null);
            setScanned(null);
            setConfirmedNoRule(false);
          }}
        >
          {t.tasks.change}
        </Button>
      </section>

      <section className="putaway__section">
        <h2>{t.location.legend}</h2>
        <TextField
          ref={scanField.ref}
          label={t.location.scanLabel}
          placeholder={t.location.scanPlaceholder}
          size="xl"
          fullWidth
          error={
            scanned !== null && byCode.isSuccess && byCode.data === null
              ? t.location.notFound(scanned)
              : undefined
          }
        />
        {byCode.isError ? <AlertBanner variant="error" title={t.location.loadFailed} /> : null}

        {locations.isPending ? <p role="status">{t.location.loading}</p> : null}
        {locations.isError ? <AlertBanner variant="error" title={t.location.loadFailed} /> : null}
        {locations.data !== undefined && locations.data.length === 0 ? (
          <AlertBanner variant="warning" title={t.location.none} />
        ) : null}
        {locations.data === undefined ? null : (
          <div className="putaway__field">
            <label htmlFor="putaway-location">{t.location.pickLabel}</label>
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

            {verdict === MATCHED ? (
              <AlertBanner variant="success" title={t.verdict.matched} />
            ) : null}

            {/* 다른 곳에 두면 다음 사람이 찾지 못한다. 임시로 두는 길은 다른 화면이 받는다. */}
            {verdict === NOT_RECOMMENDED ? (
              <AlertBanner
                variant="error"
                title={t.verdict.notRecommended(codeOf(task.recommendedLocationId))}
              >
                {/* 임시로 두어야 하는 경우가 있다. 그 길을 지시와 함께 넘긴다. */}
                <Link to="/temporary-putaway" state={{ task, location }}>
                  {t.verdict.temporary}
                </Link>
              </AlertBanner>
            ) : null}

            {/* 규칙이 없다고 막으면 미등록 품목이 적치 자체를 못 한다. 확인을 받고 통과시킨다. */}
            {verdict === NO_RULE ? (
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

            {/* 지금 무엇이 들어 있는지는 이 화면이 알지 못한다. 위반이라고 말하지 않는다. */}
            {isSingleItemOnly(location) ? (
              <AlertBanner variant="warning" title={t.singleItemOnly} />
            ) : null}

            {location.capacityQty === null || location.capacityQty === undefined ? null : (
              <p className="putaway__note">{t.capacity(String(location.capacityQty))}</p>
            )}
          </>
        )}
      </section>

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
          {t.submit}
        </Button>
      </section>
    </div>
  );
};
