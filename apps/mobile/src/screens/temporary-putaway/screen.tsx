import { AlertBanner, Button, Card, Chip, Select, TextArea, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';

import { useCodeValues } from '../../patterns/code-values';
import { useLocationByCode, useLocations, type Location } from '../../patterns/locations';
import { useUomCodes } from '../../patterns/masters';
import { useOutbox } from '../../patterns/outbox';
import { useScanField } from '../../patterns/use-scan-field';
import { useScreenTitle } from '../../patterns/screen-title';
import { useWorkerSession } from '../../patterns/worker-session';
import type { PutawayTask } from '../putaway/putaway';
import { putawayKeys, usePutawayTask } from '../putaway/queries';
import {
  PUTAWAY_TASK_TEMPORARY_REASON,
  canSubmit,
  isAlreadyPutAway,
  queuedCountOf,
  toOutboxDraft,
  type TemporaryDraft,
} from './temporary';
import './screen.css';

const t = messages.temporaryPutaway;

type Outcome = 'queued' | 'sent' | 'rejected';

/** 앞 화면이 넘겨 준 것. 지시가 없으면 이 화면은 아무것도 하지 않는다. */
export interface TemporaryPutawayHandoff {
  task: PutawayTask;
  location?: Location | null;
}

const isHandoff = (value: unknown): value is TemporaryPutawayHandoff =>
  typeof value === 'object' &&
  value !== null &&
  'task' in value &&
  typeof (value as { task: unknown }).task === 'object';

export const TemporaryPutawayScreen = () => {
  useScreenTitle(t.title);

  const { enqueue, flush, isRejected, loaded, pendingOf } = useOutbox();
  const queryClient = useQueryClient();
  const { worker } = useWorkerSession();
  const routed = useLocation();
  const handoff = isHandoff(routed.state) ? routed.state : null;
  const task = handoff?.task ?? null;

  const [draft, setDraft] = useState<TemporaryDraft>({
    location: handoff?.location ?? null,
    reasonCode: '',
    remarks: '',
  });
  const [scanned, setScanned] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  /*
   * 보내는 중인가. 상태로 두면 같은 틱에 두 번 누른 것을 막지 못한다 - 다시 그리기 전에
   * 두 번째가 들어와 멱등키가 다른 두 건이 담기고, 서버가 흡수하지 못해 두 건이 기록된다.
   */
  const inFlight = useRef(false);

  const patch = (next: Partial<TemporaryDraft>) => {
    setDraft((current) => ({ ...current, ...next }));
  };

  const scanField = useScanField({
    onScan: (value) => {
      setScanned(value.trim());
    },
  });

  /*
   * 앞 화면이 넘긴 지시는 굳은 스냅숏이다. 서버에서 다시 읽어, 이미 적치된 것을 또 적지 않는다.
   * 다시 읽지 못하면(끊김) 넘겨받은 것으로 버티되 큐가 남은 절반을 막는다.
   */
  const fresh = usePutawayTask(task?.putawayTaskId ?? null);
  /*
   * 둘 중 하나라도 이미 적치라고 하면 막는다. 실제 적치 위치는 완료될 때 채워지고 다시
   * 비지 않으므로, 한쪽만 그렇다면 다른 쪽이 낡은 것이다 - 되돌릴 수 없는 쓰기라 막는 쪽을 택한다.
   */
  const known = task !== null && isAlreadyPutAway(task) ? task : (fresh.data ?? task);
  const queuedCount = task === null ? 0 : queuedCountOf(pendingOf(t.record), task.putawayTaskId);

  const locations = useLocations(task?.warehouseId ?? null);
  const byCode = useLocationByCode(task?.warehouseId ?? null, scanned);
  const reasons = useCodeValues(PUTAWAY_TASK_TEMPORARY_REASON);
  const uoms = useUomCodes(true);

  const scannedLocation = scanned === null ? null : (byCode.data ?? null);
  /*
   * 스캔을 시작했으면 스캔이 정본이다. 찾지 못한 것을 앞 화면이 넘긴 위치로 되돌리면 작업자는
   * 자기가 비춘 자리에 넣었다고 믿는데 장부는 다른 자리를 가리킨다 - 실물을 사람이 찾아야 한다.
   */
  const location = scanned === null ? draft.location : scannedLocation;
  /*
   * 큐를 읽기 전에는 막아 둔다 - 담긴 것이 없는 것과 구별되지 않아, 앞서 담은 등록이 셈에서
   * 빠진 채로 같은 지시에 한 건이 더 나간다. 서버 상세를 확인하는 동안에도 같다.
   */
  const ready =
    loaded &&
    !fresh.isPending &&
    canSubmit(known, { ...draft, location }, worker !== null, queuedCount);

  const codeOf = (locationId: number | null | undefined): string =>
    locations.data?.find((each) => each.locationId === locationId)?.locationCode ?? '';

  const submit = async () => {
    if (task === null || location === null || worker === null || inFlight.current) {
      return;
    }

    inFlight.current = true;
    setSaveFailed(false);

    const entry = toOutboxDraft(task, draft, location, new Date(), worker.workerNo);

    try {
      /* 담기지 못하면 적은 것이 어디에도 없다. 말하지 않으면 사람은 기록된 줄 안다. */
      try {
        await enqueue(entry);
      } catch {
        setSaveFailed(true);
        return;
      }

      const result = await flush().catch(() => null);

      /*
       * 보낸 뒤에 서버가 아는 이 지시를 낡은 것으로 표시한다. 조회에 머무는 시간이 있어,
       * 표시하지 않으면 그사이 다시 들어온 화면이 등록 전 값을 보고 한 건을 더 내보낸다.
       * 보내기 앞에 표시하면 아직 안 간 값을 다시 받아 와 같은 자리로 돌아온다.
       */
      await queryClient.invalidateQueries({ queryKey: putawayKeys.task(task.putawayTaskId) });

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

  /* 지시는 앞 화면이 들고 온다. 없으면 지어내지 않고 어디서 오는지 알린다. */
  if (task === null) {
    return (
      <div className="temporary">
        <AlertBanner variant="warning" title={t.noTask.title}>
          {t.noTask.description}
        </AlertBanner>
        <Link to="/putaway">{t.noTask.action}</Link>
      </div>
    );
  }

  if (outcome !== null) {
    return (
      <div className="temporary">
        {outcome === 'sent' ? (
          <AlertBanner variant="success" title={t.sent.title}>
            {t.sent.description}
          </AlertBanner>
        ) : null}
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
        <Link to="/putaway">{t.done}</Link>
      </div>
    );
  }

  return (
    <div className="temporary">
      <section className="temporary__section">
        <h2>{t.task.legend}</h2>
        <Card bordered>
          <Card.Body className="card-body temporary__card">
            <strong>{task.putawayTaskNo}</strong>
            <p>{t.task.qty(`${String(task.taskQty)} ${uoms.data?.get(task.uomId) ?? ''}`)}</p>
            {task.recommendedLocationId === null || task.recommendedLocationId === undefined ? (
              <Chip status="warning">{t.task.noRule}</Chip>
            ) : (
              <Chip>{t.task.recommended(codeOf(task.recommendedLocationId))}</Chip>
            )}
          </Card.Body>
        </Card>

        {/* 실제 적치 위치는 완료된 건에만 채워진다. 또 적으면 두 기록이 남는다. */}
        {known !== null && isAlreadyPutAway(known) ? (
          <AlertBanner variant="error" title={t.task.already}>
            {t.task.alreadyAt(codeOf(known.actualLocationId))}
          </AlertBanner>
        ) : null}
        {/* 서버는 아직 모르는 등록이다. 말하지 않으면 안 한 줄 알고 한 번 더 적는다. */}
        {queuedCount > 0 ? (
          <AlertBanner variant="warning" title={t.task.queued}>
            {t.task.queuedWhy}
          </AlertBanner>
        ) : null}
      </section>

      <section className="temporary__section">
        <h2>{t.location.legend}</h2>
        {/* 임시 위치를 가려낼 값이 아직 없다. 걸러 내지 않고 그 사실을 적는다. */}
        <p className="temporary__note">{t.location.unfiltered}</p>
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
        {/* 스캔한 코드를 확인하는 동안 등록이 잠긴다. 왜 잠겼는지 말하지 않으면 멈춘 것처럼 보인다. */}
        {scanned !== null && byCode.isPending ? <p role="status">{t.location.loading}</p> : null}
        {byCode.isError ? <AlertBanner variant="error" title={t.location.loadFailed} /> : null}

        {locations.isPending ? <p role="status">{t.location.loading}</p> : null}
        {locations.isError ? <AlertBanner variant="error" title={t.location.loadFailed} /> : null}
        {locations.data !== undefined && locations.data.length === 0 ? (
          <AlertBanner variant="warning" title={t.location.none} />
        ) : null}
        {locations.data === undefined ? null : (
          <div className="temporary__field">
            <label htmlFor="temporary-location">{t.location.pickLabel}</label>
            <Select
              id="temporary-location"
              placeholder={t.location.pickPlaceholder}
              size="xl"
              /*
               * 등록되는 자리를 그대로 가리킨다. 스캔을 시작하면 스캔이 정본이므로, 고른 값을
               * 계속 보이면 화면이 두 자리를 동시에 말하게 된다 - 작업자가 어느 쪽을 믿을지
               * 정할 근거가 없다.
               */
              value={location === null ? null : String(location.locationId)}
              onChange={(value) => {
                setScanned(null);
                patch({
                  location:
                    locations.data.find((each) => each.locationId === Number(value)) ?? null,
                });
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
            {/* 임시 위치는 수용량으로 막지 않는다. 값이 있으면 알리기만 한다. */}
            {location.capacityQty === null || location.capacityQty === undefined ? null : (
              <AlertBanner
                variant="warning"
                title={t.location.capacity(String(location.capacityQty))}
              />
            )}
          </>
        )}
      </section>

      <section className="temporary__section">
        <h2>{t.reason.legend}</h2>
        {reasons.isPending ? <p role="status">{t.reason.loading}</p> : null}
        {reasons.isError ? <p className="temporary__note">{t.reason.loadFailed}</p> : null}
        {/* 값이 없으면 고를 것이 없다. 비고로 적게 두고 그 사실을 말한다. */}
        {reasons.data !== undefined && reasons.data.length === 0 ? (
          <AlertBanner variant="warning" title={t.reason.empty} />
        ) : null}
        <div className="temporary__field">
          <label htmlFor="temporary-reason">{t.reason.label}</label>
          <Select
            id="temporary-reason"
            placeholder={t.reason.placeholder}
            size="xl"
            disabled={reasons.data === undefined || reasons.data.length === 0}
            value={draft.reasonCode === '' ? null : draft.reasonCode}
            onChange={(value) => {
              patch({ reasonCode: String(value) });
            }}
            options={(reasons.data ?? []).map((each) => ({
              value: each.code,
              label: each.name,
            }))}
          />
        </div>

        <TextArea
          label={t.reason.remarksLabel}
          size="lg"
          fullWidth
          rows={2}
          value={draft.remarks}
          onChange={(event) => {
            patch({ remarks: event.target.value });
          }}
        />

        {/* 서버가 둘 다 비면 막는다. 무엇이 있어야 하는지를 먼저 말한다. */}
        {draft.reasonCode === '' && draft.remarks.trim() === '' ? (
          <p className="temporary__note">{t.reason.needsOne}</p>
        ) : null}
      </section>

      <section className="temporary__section">
        {saveFailed ? (
          <AlertBanner variant="error" title={t.saveFailed.title}>
            {t.saveFailed.description}
          </AlertBanner>
        ) : null}
        {worker === null ? <p className="temporary__note">{t.noWorker}</p> : null}
        <Button
          className="temporary__wide"
          variant="filled"
          size="2xl"
          disabled={!ready}
          onClick={() => void submit()}
        >
          {t.submit}
        </Button>
      </section>
    </div>
  );
};
