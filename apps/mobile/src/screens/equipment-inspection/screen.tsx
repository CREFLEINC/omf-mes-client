import {
  AlertBanner,
  Button,
  Card,
  Chip,
  NumberPad,
  Progress,
  RadioGroup,
  Radio,
  Select,
  TextArea,
  TextField,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';

import { useAdvanceTo } from '../../patterns/advance-to';
import { useBackStep } from '../../patterns/back-step';
import { useEquipments, type Equipment } from '../../patterns/equipments';
import { playErrorTone } from '../../patterns/error-tone';
import { useUomCodes } from '../../patterns/masters';
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
import { NONE, useInspectionItems, useTodaysInspection, type InspectionItem } from './queries';
import './screen.css';

const t = messages.equipmentInspection;
const required = messages.common.required;

type Outcome = 'queued' | 'sent' | 'rejected';

const receivedLabel = (iso: string): string => {
  const at = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, '0');

  return `${pad(at.getMonth() + 1)}-${pad(at.getDate())} ${pad(at.getHours())}:${pad(at.getMinutes())}`;
};

const ItemCard = ({
  item,
  entry,
  uom,
  keypadOpen,
  onFocus,
  onChange,
}: {
  item: InspectionItem;
  entry: Entry | undefined;
  uom: string;
  keypadOpen: boolean;
  onFocus: () => void;
  onChange: (next: Entry) => void;
}) => {
  const result = resultOf(item, entry);
  const measurable = hasRange(item);

  return (
    <Card bordered>
      <Card.Body className="card-body inspection__item">
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
            {/* 실물 계기에는 단위 이름이 찍혀 있지 대리키가 찍혀 있지 않다. */}
            <p className="inspection__item-note">
              {t.items.range(String(item.lowerLimit), String(item.upperLimit), uom)}
            </p>
            <TextField
              label={required(t.items.measured)}
              /*
               * 장갑을 끼고 한 손으로 조작한다. 기기 키보드는 키가 촘촘하고, 올라오면 항목
               * 목록과 완료 단추를 덮는다(설계 §7 · 공유계약 G-6).
               */
              inputMode="none"
              size="lg"
              fullWidth
              value={entry?.measured ?? ''}
              onFocus={onFocus}
              onChange={(event) => {
                onChange({ ...entry, measured: event.target.value });
              }}
            />
            {/* 키패드는 지금 적는 줄 아래에만 선다(공유계약 D-4). */}
            {keypadOpen ? (
              <NumberPad
                value={entry?.measured ?? ''}
                onChange={(next) => {
                  onChange({ ...entry, measured: next });
                }}
                allowDecimal
              />
            ) : null}
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

  const { enqueue, flush, countPending, isRejected } = useOutbox();
  const { worker } = useWorkerSession();
  const equipments = useEquipments();

  const [selected, setSelected] = useState<Equipment | null>(null);
  const [scanned, setScanned] = useState<string | null>(null);
  const [type, setType] = useState<InspectionType>(DAILY);
  const [entries, setEntries] = useState<Record<number, Entry>>({});
  const [remarks, setRemarks] = useState('');
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  /*
   * 보내는 중인가. 상태로 두면 같은 틱에 두 번 누른 것을 막지 못한다 - 다시 그리기 전에
   * 두 번째가 들어와 멱등키가 다른 두 건이 담기고, 서버가 흡수하지 못해 두 건이 기록된다.
   */
  const inFlight = useRef(false);
  /* 키패드는 지금 적는 줄 아래에만 선다. 줄마다 두면 화면이 키패드로 찬다(공유계약 D-4). */
  const [keypadFor, setKeypadFor] = useState<number | null>(null);
  /* 같은 라벨을 다시 읽으면 상태는 그대로라 소리가 다시 나지 않는다. 회차를 함께 센다. */
  const [scanSeq, setScanSeq] = useState(0);
  const typeSection = useRef<HTMLDivElement | null>(null);
  const itemsSection = useRef<HTMLDivElement | null>(null);

  const scanField = useScanField({
    onScan: (value) => {
      setScanned(value);
      setScanSeq((seq) => seq + 1);
    },
  });
  const items = useInspectionItems(selected?.equipmentId ?? null);
  const uoms = useUomCodes(selected !== null);
  const today = useTodaysInspection(selected?.equipmentId ?? null, type);

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

  /*
   * 스캔한 코드가 이 공장의 설비가 아니라는 것을 소리로도 알린다(공유계약 D-2). 기기를 들고
   * 설비 사이를 도는 중이라 화면에만 적으면 통과한 줄 알고 다음 설비로 간다.
   */
  useEffect(() => {
    if (scanMiss !== null) {
      playErrorTone();
    }
  }, [scanMiss, scanSeq]);

  /* 세로 화면이라 채운 구획이 자리를 차지한 채 남으면 다음에 할 일이 접힌 자리에 있다. */
  useAdvanceTo(selected !== null, typeSection);
  useAdvanceTo(ofType.length > 0, itemsSection);

  /* 뒤로가기는 고른 설비를 먼저 놓는다. 두지 않으면 한 번에 작업 목록까지 나간다. */
  useBackStep(selected !== null, () => {
    setSelected(null);
    setEntries({});
    setKeypadFor(null);
    scanField.focus();
  });

  const complete = async () => {
    if (selected === null || worker === null || inFlight.current) {
      return;
    }

    inFlight.current = true;
    setSaveFailed(false);

    const draft = toOutboxDraft(submission, new Date().toISOString(), worker.workerNo);

    try {
      /* 담기지 못하면 적은 것이 어디에도 없다. 말하지 않으면 사람은 기록된 줄 안다. */
      try {
        await enqueue(draft);
      } catch {
        setSaveFailed(true);
        return;
      }

      const result = await flush().catch(() => null);
      const mine = (entry: { idempotencyKey: string }) =>
        entry.idempotencyKey === draft.idempotencyKey;

      /*
       * 자기가 부른 보내기의 결과만 보면 딸려 되돌아간 건을 놓친다 - 그 판정은 셸이 도는 다른
       * 회차에서 내려질 수 있고, 화면은 빈 결과를 받아 담아 두었다고 잘못 말한다.
       */
      if (
        (result !== null && result.rejected.some((item) => mine(item.entry))) ||
        isRejected(draft.idempotencyKey)
      ) {
        setOutcome('rejected');
        return;
      }

      setOutcome(result === null || result.remaining.some(mine) ? 'queued' : 'sent');
    } finally {
      inFlight.current = false;
    }
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

      <section className="inspection__section" ref={typeSection}>
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
        {/*
         * 막지 않는다. 재점검은 정상 행위이고, 이미 했다는 것만 알려 사람이 정하게 한다.
         * 확인하지 못한 것을 없는 것으로 말하지 않는다.
         */}
        {selected === null ? null : today.isError ? (
          <p className="inspection__note">{t.type.todayUnknown}</p>
        ) : today.data == null ? (
          today.isSuccess ? (
            <p className="inspection__note">{t.type.todayNone}</p>
          ) : null
        ) : (
          <AlertBanner
            variant="info"
            title={t.type.todayDone(
              receivedLabel(today.data.inspectedAt),
              today.data.inspectorWorkerNo,
            )}
          />
        )}
      </section>

      {selected === null ? null : (
        <section className="inspection__section" ref={itemsSection}>
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
                          uom={
                            item.uomId === null || item.uomId === undefined
                              ? ''
                              : (uoms.data?.get(item.uomId) ?? '')
                          }
                          keypadOpen={keypadFor === item.equipmentInspectionItemId}
                          onFocus={() => {
                            setKeypadFor(item.equipmentInspectionItemId);
                          }}
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
            label={needsRemarks(counts) ? required(t.summary.remarks) : t.summary.remarks}
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
          {saveFailed ? (
            <AlertBanner variant="error" title={t.saveFailed.title}>
              {t.saveFailed.description}
            </AlertBanner>
          ) : null}
          {worker === null ? <p className="inspection__note">{t.noWorker}</p> : null}
          {/* 항목 수가 설비마다 다르다. 완료 단추는 언제나 보여야 한다(설계 §3). */}
          <div className="action-bar">
            <Button
              className="inspection__wide"
              variant="filled"
              size="2xl"
              disabled={!ready}
              onClick={() => void complete()}
            >
              {t.submit}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
};
