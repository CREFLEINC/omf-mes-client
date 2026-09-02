import {
  AlertBanner,
  Button,
  Card,
  Chip,
  Progress,
  RadioGroup,
  Radio,
  Select,
  TextArea,
  TextField,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';

import { useEquipments, type Equipment } from '../../patterns/equipments';
import { useOutbox } from '../../patterns/outbox';
import { useScanField } from '../../patterns/use-scan-field';
import { useScreenTitle } from '../../patterns/screen-title';
import { useWorkerSession } from '../../patterns/worker-session';
import {
  DAILY,
  MONTHLY,
  NG,
  OK,
  canSubmit,
  hasRange,
  isMeasurement,
  itemsOfType,
  missingRequired,
  needsRemarks,
  resultOf,
  tally,
  toOutboxDraft,
  type Entry,
  type InspectionType,
} from './inspection';
import { NONE, useInspectionItems, type InspectionItem } from './queries';
import './screen.css';

const t = messages.equipmentInspection;

type Outcome = 'queued' | 'sent' | 'rejected';

const receivedLabel = (iso: string): string => {
  const at = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, '0');

  return `${pad(at.getMonth() + 1)}-${pad(at.getDate())} ${pad(at.getHours())}:${pad(at.getMinutes())}`;
};

const ItemCard = ({
  item,
  entry,
  onChange,
}: {
  item: InspectionItem;
  entry: Entry | undefined;
  onChange: (next: Entry) => void;
}) => {
  const result = resultOf(item, entry);
  const measurable = hasRange(item);

  return (
    <Card bordered>
      <Card.Body className="inspection__item">
        <div className="inspection__item-head">
          <strong>{`${String(item.sequenceNo)}. ${item.itemName}`}</strong>
          {item.requiredFlag ? <Chip size="sm">{t.items.required}</Chip> : null}
          {result === null ? null : (
            <Chip status={result === OK ? 'success' : 'error'}>
              {result === OK ? t.items.ok : t.items.ng}
            </Chip>
          )}
        </div>

        {measurable ? (
          <>
            <p className="inspection__item-note">
              {t.items.range(
                String(item.lowerLimit),
                String(item.upperLimit),
                item.uomId === null || item.uomId === undefined ? '' : String(item.uomId),
              )}
            </p>
            <TextField
              label={t.items.measured}
              inputMode="decimal"
              size="lg"
              fullWidth
              value={entry?.measured ?? ''}
              onChange={(event) => {
                onChange({ ...entry, measured: event.target.value });
              }}
            />
          </>
        ) : (
          <>
            {/* 기준이 비어 자동 판정이 서지 않는 것을 감추지 않고 말한다. */}
            {isMeasurement(item) ? (
              <p className="inspection__item-note">{t.items.noRange}</p>
            ) : null}
            <div className="inspection__judge">
              <Button
                variant={entry?.judged === OK ? 'filled' : 'outlined'}
                size="lg"
                onClick={() => {
                  onChange({ ...entry, judged: OK });
                }}
              >
                {t.items.ok}
              </Button>
              <Button
                variant={entry?.judged === NG ? 'filled' : 'outlined'}
                size="lg"
                onClick={() => {
                  onChange({ ...entry, judged: NG });
                }}
              >
                {t.items.ng}
              </Button>
            </div>
          </>
        )}
      </Card.Body>
    </Card>
  );
};

export const EquipmentInspectionScreen = () => {
  useScreenTitle(t.title);

  const { enqueue, flush, countPending } = useOutbox();
  const { worker } = useWorkerSession();
  const equipments = useEquipments();

  const [selected, setSelected] = useState<Equipment | null>(null);
  const [scanned, setScanned] = useState<string | null>(null);
  const [type, setType] = useState<InspectionType>(DAILY);
  const [entries, setEntries] = useState<Record<number, Entry>>({});
  const [remarks, setRemarks] = useState('');
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const scanField = useScanField({ onScan: setScanned });
  const items = useInspectionItems(selected?.equipmentId ?? null);

  /*
   * 목록이 도착한 뒤에 맞춘다. 도착 전에 없다고 말하면 있는 설비를 없다고 하는 것이 되고,
   * 점검자는 맞는 코드를 들고 계속 다시 쏜다.
   */
  useEffect(() => {
    if (scanned === null || equipments.data === undefined) {
      return;
    }

    const found = equipments.data.find((item) => item.equipmentCode === scanned);

    if (found !== undefined) {
      setSelected(found);
      setScanned(null);
      setEntries({});
    }
  }, [equipments.data, scanned]);

  const scanMiss =
    scanned !== null && equipments.data !== undefined && selected?.equipmentCode !== scanned
      ? scanned
      : null;

  const ofType = itemsOfType(items.data?.effective ?? [], type);
  const counts = tally(ofType, entries);
  const remaining = missingRequired(ofType, entries);
  const submission = {
    equipmentId: selected?.equipmentId ?? 0,
    type,
    items: ofType,
    entries,
    remarks,
  };
  const ready = selected !== null && canSubmit(submission, worker !== null);
  const unsent = countPending(t.record);

  const complete = async () => {
    if (selected === null || worker === null) {
      return;
    }

    const draft = toOutboxDraft(submission, new Date().toISOString(), worker.workerNo);

    await enqueue(draft);

    const result = await flush().catch(() => null);
    const mine = (entry: { idempotencyKey: string }) =>
      entry.idempotencyKey === draft.idempotencyKey;

    if (result !== null && result.rejected.some((item) => mine(item.entry))) {
      setOutcome('rejected');
      return;
    }

    setOutcome(result === null || result.remaining.some(mine) ? 'queued' : 'sent');
  };

  const restart = () => {
    setSelected(null);
    setScanned(null);
    setEntries({});
    setRemarks('');
    setOutcome(null);
    scanField.focus();
  };

  if (outcome !== null) {
    return (
      <div className="inspection">
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
        <Button variant="filled" size="2xl" onClick={restart}>
          {t.another}
        </Button>
      </div>
    );
  }

  return (
    <div className="inspection">
      {/* 못 보낸 점검은 서버에 없어 작업 통제가 점검을 안 한 것으로 읽는다. 상시 보인다. */}
      {unsent === 0 ? null : <AlertBanner variant="warning" title={t.unsent(unsent)} />}

      <section className="inspection__section">
        <h2>{t.equipment.legend}</h2>
        <TextField
          ref={scanField.ref}
          label={t.equipment.scanLabel}
          placeholder={t.equipment.scanPlaceholder}
          size="lg"
          fullWidth
          error={scanMiss === null ? undefined : t.equipment.notFound(scanMiss)}
        />
        {equipments.isPending ? <p role="status">{t.equipment.loading}</p> : null}
        {equipments.isError ? <AlertBanner variant="error" title={t.equipment.loadFailed} /> : null}
        {equipments.data === undefined ? null : (
          <div className="inspection__field">
            <label htmlFor="inspection-pick">{t.equipment.pickLabel}</label>
            <Select
              id="inspection-pick"
              placeholder={t.equipment.pickPlaceholder}
              size="lg"
              value={selected === null ? null : String(selected.equipmentId)}
              onChange={(value) => {
                const picked = Number(value);
                setSelected(equipments.data.find((item) => item.equipmentId === picked) ?? null);
                setEntries({});
              }}
              options={equipments.data.map((item) => ({
                value: String(item.equipmentId),
                label: `${item.equipmentCode} ${item.equipmentName}`,
              }))}
            />
          </div>
        )}
      </section>

      <section className="inspection__section">
        <h2>{t.type.legend}</h2>
        <RadioGroup
          name="inspection-type"
          value={type}
          onChange={(value) => {
            setType(value as InspectionType);
            setEntries({});
          }}
        >
          <Radio value={DAILY}>{t.type.daily}</Radio>
          <Radio value={MONTHLY}>{t.type.monthly}</Radio>
        </RadioGroup>
      </section>

      {selected === null ? null : (
        <section className="inspection__section">
          <h2>{t.items.legend}</h2>
          {items.isPending ? <p role="status">{t.items.loading}</p> : null}
          {/* 확인하지 못한 것을 등록되지 않은 것으로 말하지 않는다. */}
          {items.isError ? <AlertBanner variant="error" title={t.items.loadFailed} /> : null}
          {items.data === undefined ? null : (
            <>
              <p className="inspection__note">
                {t.items.receivedAt(receivedLabel(items.data.receivedAt))}
              </p>
              {items.data.resolvedFromLevelCode === NONE ? (
                <AlertBanner variant="warning" title={t.items.none} />
              ) : ofType.length === 0 ? (
                <AlertBanner variant="warning" title={t.items.noneForType} />
              ) : (
                <>
                  <Progress value={counts.judged} max={ofType.length} />
                  <p className="inspection__note">
                    {t.items.progress(counts.judged, ofType.length)}
                  </p>
                  <ul className="inspection__items">
                    {ofType.map((item) => (
                      <li key={item.equipmentInspectionItemId}>
                        <ItemCard
                          item={item}
                          entry={entries[item.equipmentInspectionItemId]}
                          onChange={(next) => {
                            setEntries((current) => ({
                              ...current,
                              [item.equipmentInspectionItemId]: next,
                            }));
                          }}
                        />
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
        </section>
      )}

      {ofType.length === 0 ? null : (
        <section className="inspection__section">
          <h2>{t.summary.legend}</h2>
          <p>{t.summary.counts(counts.ok, counts.ng)}</p>
          {/* 점검은 진단이다. 보전 지시는 설비담당이 따로 발행한다. */}
          {counts.ng === 0 ? null : <AlertBanner variant="warning" title={t.summary.ngNotice} />}
          <TextArea
            label={t.summary.remarks}
            size="lg"
            fullWidth
            rows={2}
            value={remarks}
            onChange={(event) => {
              setRemarks(event.target.value);
            }}
            error={
              needsRemarks(counts) && remarks.trim() === '' ? t.summary.remarksRequired : undefined
            }
          />
          {remaining === null ? null : (
            <p className="inspection__note">{t.summary.remainingRequired(remaining.itemName)}</p>
          )}
          {worker === null ? <p className="inspection__note">{t.noWorker}</p> : null}
          <Button variant="filled" size="2xl" disabled={!ready} onClick={() => void complete()}>
            {t.submit}
          </Button>
        </section>
      )}
    </div>
  );
};
