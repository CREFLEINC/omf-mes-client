import { AlertBanner, Button, Card, Chip, Select, TextArea, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';
import { Link, useLocation } from 'react-router';

import { useCodeValues } from '../../patterns/code-values';
import { useLocationByCode, useLocations, type Location } from '../../patterns/locations';
import { useUomCodes } from '../../patterns/masters';
import { useOutbox } from '../../patterns/outbox';
import { useScanField } from '../../patterns/use-scan-field';
import { useScreenTitle } from '../../patterns/screen-title';
import { useWorkerSession } from '../../patterns/worker-session';
import type { PutawayTask } from '../putaway/putaway';
import {
  PUTAWAY_TASK_TEMPORARY_REASON,
  canSubmit,
  isAlreadyPutAway,
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

  const { enqueue, flush } = useOutbox();
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

  const patch = (next: Partial<TemporaryDraft>) => {
    setDraft((current) => ({ ...current, ...next }));
  };

  const scanField = useScanField({
    onScan: (value) => {
      setScanned(value.trim());
    },
  });

  const locations = useLocations(task?.warehouseId ?? null);
  const byCode = useLocationByCode(task?.warehouseId ?? null, scanned);
  const reasons = useCodeValues(PUTAWAY_TASK_TEMPORARY_REASON);
  const uoms = useUomCodes(true);

  const scannedLocation = scanned === null ? null : (byCode.data ?? null);
  const location = scannedLocation ?? draft.location;
  const ready = canSubmit(task, { ...draft, location }, worker !== null);

  const codeOf = (locationId: number | null | undefined): string =>
    locations.data?.find((each) => each.locationId === locationId)?.locationCode ?? '';

  const submit = async () => {
    if (task === null || location === null || worker === null) {
      return;
    }

    const entry = toOutboxDraft(task, draft, location, new Date(), worker.workerNo);

    await enqueue(entry);

    const result = await flush().catch(() => null);
    const mine = (each: { idempotencyKey: string }) => each.idempotencyKey === entry.idempotencyKey;

    if (result !== null && result.rejected.some((each) => mine(each.entry))) {
      setOutcome('rejected');
      return;
    }

    setOutcome(result === null || result.remaining.some(mine) ? 'queued' : 'sent');
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
          <Card.Body className="temporary__card">
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
        {isAlreadyPutAway(task) ? (
          <AlertBanner variant="error" title={t.task.already}>
            {t.task.alreadyAt(codeOf(task.actualLocationId))}
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
              value={draft.location === null ? null : String(draft.location.locationId)}
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
