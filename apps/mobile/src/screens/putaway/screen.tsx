import { AlertBanner, Button, Card, Chip, Select, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';
import { Link } from 'react-router';

import { useUomCodes } from '../../patterns/masters';
import { useOutbox } from '../../patterns/outbox';
import { useScanField } from '../../patterns/use-scan-field';
import { useScreenTitle } from '../../patterns/screen-title';
import { useWorkerSession } from '../../patterns/worker-session';
import { useWorkerId } from '../../patterns/workers';
import { useLocationByCode, useLocations, usePutawayTasks } from './queries';
import {
  MATCHED,
  NOT_RECOMMENDED,
  NO_RULE,
  canComplete,
  isSingleItemOnly,
  toOutboxDraft,
  verdictOf,
  type Location,
  type PutawayTask,
} from './putaway';
import './screen.css';

const t = messages.putaway;

type Outcome = 'queued' | 'sent' | 'rejected';

export const PutawayScreen = () => {
  useScreenTitle(t.title);

  const { enqueue, flush } = useOutbox();
  const { worker } = useWorkerSession();

  const [task, setTask] = useState<PutawayTask | null>(null);
  const [pickedId, setPickedId] = useState<number | null>(null);
  const [scanned, setScanned] = useState<string | null>(null);
  const [confirmedNoRule, setConfirmedNoRule] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

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
    scanField.focus();
  };

  const complete = async () => {
    if (task === null || location === null || worker === null) {
      return;
    }

    const entry = toOutboxDraft(task, location, confirmedNoRule, new Date(), worker.workerNo);

    await enqueue(entry);

    const result = await flush().catch(() => null);
    const mine = (each: { idempotencyKey: string }) => each.idempotencyKey === entry.idempotencyKey;

    if (result !== null && result.rejected.some((each) => mine(each.entry))) {
      setOutcome('rejected');
      return;
    }

    setOutcome(result === null || result.remaining.some(mine) ? 'queued' : 'sent');
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
                    <span>
                      {each.recommendedLocationId === null ||
                      each.recommendedLocationId === undefined
                        ? t.tasks.noRule
                        : t.tasks.recommended(String(each.recommendedLocationId))}
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
          <Card.Body className="putaway__card">
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
                {t.verdict.notRecommendedNext}
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
