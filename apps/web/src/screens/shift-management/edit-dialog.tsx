import { Button, Dialog, Field, Skeleton, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState } from 'react';

import { LoadErrorAlert } from '../../patterns/load-error-banner';
import { CodeLockTextField, LockedFieldIcon, SaveErrorBanner } from '../../patterns/master';
import { Select } from '../../patterns/select';
import { TimeField, type TimeFieldLabels } from '../../patterns/time-field';
import { useSaveShift, useShiftDetail, type Shift } from './queries';

const t = messages.shiftManagement;
const td = t.dialog;

interface Draft {
  shiftCode: string;
  shiftName: string;
  /** 시각 선택칸 값 `HH:MM` — 보낼 때 초를 붙인다(계약 `HH:MM:SS`). */
  startTime: string;
  endTime: string;
}

type DraftField = keyof Draft;

const START_LABELS: TimeFieldLabels = {
  field: td.start,
  hourList: td.startHour,
  minuteList: td.startMinute,
  hourHead: td.hourHead,
  minuteHead: td.minuteHead,
  placeholder: td.startPlaceholder,
};

const END_LABELS: TimeFieldLabels = {
  field: td.end,
  hourList: td.endHour,
  minuteList: td.endMinute,
  hourHead: td.hourHead,
  minuteHead: td.minuteHead,
  placeholder: td.endPlaceholder,
};

const draftOf = (shift: Shift): Draft => ({
  shiftCode: shift.shiftCode,
  shiftName: shift.shiftName,
  startTime: shift.startTime.slice(0, 5),
  endTime: shift.endTime.slice(0, 5),
});

const withSeconds = (value: string): string => `${value}:00`;

/**
 * 추가 창이 미리 채우는 교대 코드 — 이 공장에서 아직 쓰지 않은 `S01`·`S02`… 중 첫 번째.
 * 사용자가 고칠 수 있다(사용 중지한 교대의 코드는 목록에 없어 겹칠 수 있다 — 그때는 서버가 중복으로 거절한다).
 */
export const nextShiftCode = (existingCodes: readonly string[]): string => {
  const taken = new Set(existingCodes.map((code) => code.toUpperCase()));
  for (let index = 1; ; index += 1) {
    const code = `S${String(index).padStart(2, '0')}`;
    if (!taken.has(code)) return code;
  }
};

interface PlantChoice {
  plantId: number;
  plantName: string;
}

export interface EditDialogProps {
  /** 처음 공장(수정 창은 그 교대의 공장). */
  plant: PlantChoice;
  /** 추가 창에서 고를 수 있는 공장 — 비면 `plant` 로 고정(목록이 「전체」일 때만 고른다). */
  plants: readonly PlantChoice[];
  /** 고칠 교대. 없으면 추가 창. */
  shift: Shift | null;
  /** 목록의 교대 — 고른 공장의 코드로 추가 창의 코드를 미리 채운다. */
  existingShifts: readonly Shift[];
  onClose: () => void;
  onSaved: () => void;
}

/** 교대 추가 · 수정 창. 수정 창은 상세를 받아 잠금 토큰과 코드 수정 가부를 쓴다. */
export const EditDialog = ({
  plant,
  plants,
  shift,
  existingShifts,
  onClose,
  onSaved,
}: EditDialogProps) => {
  const shiftId = shift?.shiftId ?? null;
  const [plantId, setPlantId] = useState(plant.plantId);
  const plantFieldId = useId();
  const plantLabelId = useId();
  const codesOf = (id: number) =>
    existingShifts.filter((each) => each.plantId === id).map((each) => each.shiftCode);
  const detail = useShiftDetail(shiftId);
  const [draft, setDraft] = useState<Draft>(
    shift === null
      ? {
          shiftCode: nextShiftCode(codesOf(plant.plantId)),
          shiftName: '',
          startTime: '',
          endTime: '',
        }
      : draftOf(shift),
  );
  const save = useSaveShift(shiftId, onSaved);

  /* 상세가 오면 그 값으로 채운다 — 목록을 받은 뒤 누가 고쳤을 수 있다. */
  const loaded = detail.data?.shift;
  useEffect(() => {
    if (loaded !== undefined) setDraft(draftOf(loaded));
  }, [loaded]);

  const editability = detail.data?.editability;
  const codeLocked = shift !== null && editability?.codeEditable === false;
  const waiting = shift !== null && detail.data === undefined;

  /*
   * 같은 공장에 이미 있는 코드(사용 중지한 것 포함)는 저장 전에 칸에서 알린다.
   * 목록을 받은 뒤 남이 먼저 쓴 코드는 서버가 거절(UNIQUE_VIOLATION)하고, 그것도 같은 칸에 낸다.
   */
  const codeTakenLocally =
    !codeLocked &&
    existingShifts.some(
      (each) =>
        each.plantId === plantId &&
        each.shiftId !== shiftId &&
        each.shiftCode === draft.shiftCode.trim(),
    );
  const codeTakenByServer =
    save.error?.kind === 'validation' &&
    save.error.errors.length > 0 &&
    save.error.errors.every((item) => item.code === 'UNIQUE_VIOLATION');
  const codeTaken = codeTakenLocally || codeTakenByServer;

  /* 필수 칸을 다 채워야 [저장]이 켜진다. 빈 필수 칸은 팝업 공통 모양(연한 빨간 바탕 · app.css)으로 보인다. */
  const missing: Record<DraftField, boolean> = {
    shiftCode: draft.shiftCode.trim() === '',
    shiftName: draft.shiftName.trim() === '',
    startTime: draft.startTime === '',
    endTime: draft.endTime === '',
  };
  const complete = !Object.values(missing).some(Boolean);

  const update = (patch: Partial<Draft>) => {
    for (const field of Object.keys(patch)) save.clearFieldError(field);
    if (patch.shiftCode !== undefined && codeTakenByServer) save.reset();
    setDraft((current) => ({ ...current, ...patch }));
  };

  const submit = () => {
    if (!complete || codeTaken) return;
    const times = { startTime: withSeconds(draft.startTime), endTime: withSeconds(draft.endTime) };
    if (shift === null) {
      save.write({
        mode: 'create',
        body: {
          plantId,
          shiftCode: draft.shiftCode.trim(),
          shiftName: draft.shiftName.trim(),
          ...times,
        },
      });
      return;
    }
    save.write({
      mode: 'update',
      shiftId: shift.shiftId,
      body: {
        // 코드가 잠겼으면 보내지 않는다(계약 — 참조가 0일 때만 보낼 수 있다).
        ...(codeLocked ? {} : { shiftCode: draft.shiftCode.trim() }),
        shiftName: draft.shiftName.trim(),
        ...times,
      },
    });
  };

  const body = () => {
    if (shift !== null && detail.isError)
      return <LoadErrorAlert error={detail.error} onRetry={() => void detail.refetch()} />;
    if (waiting) return <Skeleton variant="rect" height="12rem" aria-label={td.loading} />;
    return (
      <div className="shift-management-form">
        {save.error !== null && !codeTakenByServer && (
          /* 저장 충돌이면 [최신 불러오기]로 남이 고친 내용을 다시 받아 채운다. */
          <SaveErrorBanner
            error={save.error}
            onReload={() => {
              save.reset();
              /* 받은 값이 앞과 같아도(남이 같은 값으로 저장) 입력을 그 값으로 되돌린다. */
              void detail.refetch().then((result) => {
                if (result.data !== undefined) setDraft(draftOf(result.data.shift));
              });
            }}
          />
        )}
        {/* 공장 · 교대 코드 · 교대명은 한 줄(사용자 지시 2026-11-25). */}
        <div className="shift-management-pair">
          {plants.length > 1 ? (
            <div className="field-cell shift-management-dialog-plant">
              <span className="field-label">
                <label htmlFor={plantFieldId}>{td.plant}</label>
                <span className="required-mark" aria-hidden="true">
                  {' '}
                  *
                </span>
              </span>
              {/* 공장은 이름으로 찾아 고른다(사용자 지시 2026-11-25). */}
              <Select
                id={plantFieldId}
                placeholder={td.plantPlaceholder}
                searchable
                searchPlaceholder={t.filters.plantSearchPlaceholder}
                value={String(plantId)}
                options={plants.map((each) => ({
                  value: String(each.plantId),
                  label: each.plantName,
                }))}
                onChange={(value) => {
                  const next = Number(value);
                  /* 자동으로 넣은 코드를 그대로 두었으면 새 공장의 다음 코드로 바꾼다. */
                  if (draft.shiftCode === nextShiftCode(codesOf(plantId)))
                    update({ shiftCode: nextShiftCode(codesOf(next)) });
                  if (codeTakenByServer) save.reset();
                  setPlantId(next);
                }}
              />
            </div>
          ) : (
            /*
             * 고를 공장이 하나뿐이면(공장이 정해진 목록 · 수정) 입력칸이 아니라 회색 값 칸으로 보인다 —
             * 이름 옆 「변경 불가」 라벨은 두지 않고, 시안 「잠긴 칸」처럼 오른쪽 끝에 자물쇠를 둔다(omf-all-around#360).
             */
            <div className="field-cell">
              <span className="field-label shift-management-locked-label">
                <span id={plantLabelId}>{td.plant}</span>
              </span>
              <p className="readonly-value locked-value" aria-labelledby={plantLabelId}>
                <span className="locked-value-text">{plant.plantName}</span>
                <LockedFieldIcon />
              </p>
            </div>
          )}
          {/* 잠긴 까닭은 칸 아래에 펼치지 않고 자물쇠에 마우스를 올리면 보인다(사용자 지시 2026-11-27 · #360). */}
          <CodeLockTextField
            label={td.code}
            fullWidth
            required
            placeholder={td.codePlaceholder}
            maxLength={50}
            value={draft.shiftCode}
            lockReason={codeLocked ? td.codeLocked(editability?.referenceCount ?? 0) : null}
            error={save.fieldErrors.shiftCode ?? (codeTaken ? td.codeTaken : undefined)}
            onChange={(event) => update({ shiftCode: event.target.value })}
          />
          <TextField
            label={td.name}
            fullWidth
            required
            placeholder={td.namePlaceholder}
            maxLength={200}
            value={draft.shiftName}
            error={save.fieldErrors.shiftName}
            onChange={(event) => update({ shiftName: event.target.value })}
          />
        </div>
        <div className="shift-management-times">
          <Field label={td.start} labelAs="span" required error={save.fieldErrors.startTime}>
            {(ids) => (
              <TimeField
                labels={START_LABELS}
                /* 시작과 종료는 같은 시각일 수 없다(사용자 결정 2026-11-25) — 다음 날로 넘는 교대는 그대로 고른다. */
                blockedTimes={draft.endTime === '' ? undefined : [draft.endTime]}
                hour={draft.startTime.slice(0, 2)}
                minute={draft.startTime.slice(3, 5)}
                disabled={false}
                invalid={ids.invalid}
                describedBy={ids.describedById}
                onChange={(hour, minute) => update({ startTime: `${hour}:${minute}` })}
                onClear={() => update({ startTime: '' })}
              />
            )}
          </Field>
          <Field label={td.end} labelAs="span" required error={save.fieldErrors.endTime}>
            {(ids) => (
              <TimeField
                labels={END_LABELS}
                blockedTimes={draft.startTime === '' ? undefined : [draft.startTime]}
                hour={draft.endTime.slice(0, 2)}
                minute={draft.endTime.slice(3, 5)}
                disabled={false}
                invalid={ids.invalid}
                describedBy={ids.describedById}
                onChange={(hour, minute) => update({ endTime: `${hour}:${minute}` })}
                onClear={() => update({ endTime: '' })}
              />
            )}
          </Field>
        </div>
      </div>
    );
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={shift === null ? td.addTitle : td.editTitle}
      size="lg"
      showCloseButton={false}
      className="shift-management-dialog"
      footer={
        <>
          <Button variant="outlined" onClick={onClose}>
            {td.cancel}
          </Button>
          <Button
            loading={save.isSaving}
            disabled={waiting || !complete || codeTaken}
            onClick={submit}
          >
            {td.save}
          </Button>
        </>
      }
    >
      {body()}
    </Dialog>
  );
};
