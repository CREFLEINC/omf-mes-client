import {
  AlertBanner,
  Button,
  Checkbox,
  Radio,
  RadioGroup,
  Select,
  TextArea,
  TextField,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useState } from 'react';

import { useOnlineStatus } from '../../patterns/online-status';
import { capturePhoto, readCapturedPhoto, type CapturedPhoto } from '../../patterns/photo-capture';
import { useOutbox } from '../../patterns/outbox';
import { useScreenTitle } from '../../patterns/screen-title';
import { useScanField } from '../../patterns/use-scan-field';
import { useEquipments, useOpenBreakdownCount, type Equipment } from './queries';
import {
  MAX_PHOTOS,
  PHOTO_QUEUE_LIMIT_BYTES,
  scanMissOf,
  toOutboxDraft,
  toPhotoDrafts,
  validateReport,
  type OccurrenceState,
} from './report';
import './screen.css';

const t = messages.equipmentFailureReport;

type Outcome = 'queued' | 'sent';

const EquipmentPicker = ({
  equipments,
  selected,
  onSelect,
}: {
  equipments: Equipment[];
  selected: Equipment | null;
  onSelect: (equipment: Equipment | null) => void;
}) => {
  const id = 'equipment-failure-pick';

  return (
    <div className="equipment-failure__field">
      <label htmlFor={id}>{t.equipment.pickLabel}</label>
      <Select
        id={id}
        placeholder={t.equipment.pickPlaceholder}
        size="lg"
        value={selected === null ? null : String(selected.equipmentId)}
        onChange={(value) => {
          const picked = Number(value);
          onSelect(equipments.find((item) => item.equipmentId === picked) ?? null);
        }}
        options={equipments.map((item) => ({
          value: String(item.equipmentId),
          label: `${item.equipmentCode} ${item.equipmentName}`,
        }))}
      />
    </div>
  );
};

export const EquipmentFailureScreen = () => {
  useScreenTitle(t.title);
  const online = useOnlineStatus();
  const { enqueue, flush, pendingBytes } = useOutbox();
  const equipments = useEquipments();

  const [selected, setSelected] = useState<Equipment | null>(null);
  /* 읽은 코드를 들고 있는다. 목록이 아직이면 없다고 말할 수 없다. */
  const [scanned, setScanned] = useState<string | null>(null);
  const [symptom, setSymptom] = useState('');
  const [state, setState] = useState<OccurrenceState | null>(null);
  const [stoppedAt, setStoppedAt] = useState('');
  const [notify, setNotify] = useState(true);
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const openBreakdowns = useOpenBreakdownCount(selected?.equipmentId ?? null);

  const scanField = useScanField({ onScan: setScanned });

  /*
   * 목록이 도착한 뒤에 맞춘다. 도착 전에 없다고 말하면 있는 설비를 없다고 하는 것이 되고,
   * 작업자는 맞는 코드를 들고 계속 다시 쏜다.
   */
  useEffect(() => {
    if (scanned === null || equipments.data === undefined) {
      return;
    }

    const found = equipments.data.find((item) => item.equipmentCode === scanned);

    if (found !== undefined) {
      setSelected(found);
      setScanned(null);
    }
  }, [equipments.data, scanned]);

  const scanMiss = scanMissOf(scanned, equipments.data !== undefined, selected?.equipmentCode);

  const validity = validateReport({
    equipmentId: selected?.equipmentId,
    symptom,
    occurrenceState: state ?? undefined,
  });

  /* 이 화면의 사진과 이미 큐에 담긴 것을 함께 센다. 큐가 끝없이 커지지 않게 하는 자리다. */
  const queuedBytes = pendingBytes + photos.reduce((total, photo) => total + photo.data.length, 0);
  const photoFull = photos.length >= MAX_PHOTOS;
  const photoTooHeavy = queuedBytes >= PHOTO_QUEUE_LIMIT_BYTES;

  const takePhoto = async () => {
    try {
      const captured = await readCapturedPhoto(await capturePhoto());
      setPhotos((current) => [...current, captured]);
      setPhotoError(null);
    } catch {
      setPhotoError(t.photo.failed);
    }
  };

  const report = async () => {
    if (selected === null || state === null) {
      return;
    }

    const occurredAt = new Date().toISOString();
    const reportId = crypto.randomUUID();
    const draft = toOutboxDraft(
      {
        equipmentId: selected.equipmentId,
        symptom,
        occurrenceState: state,
        stoppedAt: stoppedAt === '' ? null : stoppedAt,
        notifyAssignee: notify,
      },
      occurredAt,
      reportId,
    );

    await enqueue(draft);

    /* 본문을 먼저 담는다. 사진을 기다리느라 설비담당이 늦게 알면 안 된다. */
    for (const photo of toPhotoDrafts(photos, draft, occurredAt, reportId)) {
      await enqueue(photo);
    }

    /*
     * 담은 뒤 곧바로 보내 본다. 사람이 기다리는 보고라 닿을 수 있으면 지금 보내는 편이 낫고,
     * 못 닿으면 담긴 채로 남아 다음 기회에 나간다.
     */
    const result = await flush().catch(() => null);

    /*
     * 큐에는 남의 건도 있다. 그것이 거부됐다고 이 보고까지 못 간 것으로 말하면, 간 것을
     * 안 갔다고 하는 셈이라 보고자가 같은 고장을 또 적는다.
     */
    const mine = (entry: { idempotencyKey: string }) =>
      entry.idempotencyKey === draft.idempotencyKey;
    const stuck =
      result === null ||
      result.rejected.some((item) => mine(item.entry)) ||
      result.remaining.some(mine);

    setOutcome(stuck ? 'queued' : 'sent');
  };

  const restart = () => {
    setSelected(null);
    setScanned(null);
    setSymptom('');
    setState(null);
    setStoppedAt('');
    setNotify(true);
    setPhotos([]);
    setPhotoError(null);
    setOutcome(null);
    scanField.focus();
  };

  if (outcome !== null) {
    return (
      <div className="equipment-failure">
        {outcome === 'sent' ? (
          <AlertBanner variant="success" title={t.sent.title} />
        ) : (
          <AlertBanner variant="warning" title={t.queued.title}>
            {photos.length === 0
              ? t.queued.description
              : `${t.queued.description} ${t.photo.waiting(photos.length)}`}
          </AlertBanner>
        )}
        <Button variant="filled" size="xl" onClick={restart}>
          {t.another}
        </Button>
      </div>
    );
  }

  return (
    <div className="equipment-failure">
      <section className="equipment-failure__section">
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
          <EquipmentPicker
            equipments={equipments.data}
            selected={selected}
            onSelect={setSelected}
          />
        )}

        {openBreakdowns.data !== undefined && openBreakdowns.data > 0 ? (
          <AlertBanner variant="warning" title={t.equipment.openBreakdowns(openBreakdowns.data)} />
        ) : null}
      </section>

      <section className="equipment-failure__section">
        <h2>{t.symptom.legend}</h2>
        <TextArea
          label={t.symptom.label}
          placeholder={t.symptom.placeholder}
          helperText={t.symptom.hint}
          size="lg"
          fullWidth
          rows={3}
          value={symptom}
          error={symptom !== '' && validity.symptomMissing ? t.symptom.required : undefined}
          onChange={(event) => {
            setSymptom(event.target.value);
          }}
        />
      </section>

      <section className="equipment-failure__section">
        <h2>{t.photo.legend}</h2>
        <Button
          variant="outlined"
          size="lg"
          disabled={selected === null || photoFull || photoTooHeavy}
          onClick={() => {
            void takePhoto();
          }}
        >
          {t.photo.take(photos.length, MAX_PHOTOS)}
        </Button>

        {photos.length === 0 ? null : (
          <ul className="equipment-failure__photos">
            {photos.map((photo) => (
              <li key={photo.fileName}>
                <img src={photo.previewUrl} alt={t.photo.thumbnail} />
              </li>
            ))}
          </ul>
        )}

        {photoFull ? <p className="equipment-failure__note">{t.photo.full}</p> : null}
        {photoTooHeavy ? <p className="equipment-failure__note">{t.photo.tooHeavy}</p> : null}
        {photoError === null ? null : <AlertBanner variant="warning" title={photoError} />}
      </section>

      <section className="equipment-failure__section">
        <h2>{t.state.legend}</h2>
        <RadioGroup
          name="occurrence-state"
          aria-label={t.state.label}
          value={state ?? undefined}
          onChange={(value) => {
            setState(value as OccurrenceState);
            /* 감춘 값이 남아 나가면 멈추지 않은 고장에 정지 시각이 붙는다. */
            if (value !== 'STOPPED') {
              setStoppedAt('');
            }
          }}
        >
          <Radio value="STOPPED">{t.state.stopped}</Radio>
          <Radio value="ABNORMAL">{t.state.abnormal}</Radio>
        </RadioGroup>

        {state === 'STOPPED' ? (
          <>
            <TextField
              type="time"
              label={t.state.stoppedAtLabel}
              helperText={t.state.stoppedAtHint}
              size="lg"
              value={stoppedAt}
              onChange={(event) => {
                setStoppedAt(event.target.value);
              }}
            />
            <p className="equipment-failure__note">{t.state.downtimeNotice}</p>
          </>
        ) : null}
      </section>

      <section className="equipment-failure__section">
        <h2>{t.notify.legend}</h2>
        <Checkbox
          checked={notify}
          onChange={(event) => {
            setNotify(event.target.checked);
          }}
        >
          {t.notify.label}
        </Checkbox>
        {online ? null : <p className="equipment-failure__note">{t.notify.offline}</p>}
      </section>

      <Button
        variant="filled"
        size="xl"
        disabled={!validity.canSubmit}
        onClick={() => {
          void report();
        }}
      >
        {t.submit}
      </Button>
    </div>
  );
};
