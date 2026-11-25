import { Button, Dialog, Field, Skeleton, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useState } from 'react';

import { LoadErrorAlert } from '../../patterns/load-error-banner';
import { SaveErrorBanner } from '../../patterns/master';
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

const START_LABELS: TimeFieldLabels = {
  field: td.start,
  hourList: td.startHour,
  minuteList: td.startMinute,
  hourHead: td.hourHead,
  minuteHead: td.minuteHead,
  placeholder: td.timePlaceholder,
};

const END_LABELS: TimeFieldLabels = {
  field: td.end,
  hourList: td.endHour,
  minuteList: td.endMinute,
  hourHead: td.hourHead,
  minuteHead: td.minuteHead,
  placeholder: td.timePlaceholder,
};

const EMPTY: Draft = { shiftCode: '', shiftName: '', startTime: '', endTime: '' };

const draftOf = (shift: Shift): Draft => ({
  shiftCode: shift.shiftCode,
  shiftName: shift.shiftName,
  startTime: shift.startTime.slice(0, 5),
  endTime: shift.endTime.slice(0, 5),
});

const withSeconds = (value: string): string => `${value}:00`;

/** 끝 ≤ 시작이면 다음 날 끝난다 — 서버가 같은 규칙으로 자정 넘김을 정한다. */
export const endsNextDay = (startTime: string, endTime: string): boolean =>
  startTime !== '' && endTime !== '' && endTime <= startTime;

export interface EditDialogProps {
  plantId: number;
  plantName: string;
  /** 고칠 교대. 없으면 추가 창. */
  shift: Shift | null;
  onClose: () => void;
  onSaved: () => void;
  onDeactivate: (shift: Shift) => void;
}

/** 교대 추가 · 수정 창. 수정 창은 상세를 받아 잠금 토큰과 코드 수정 가부를 쓴다. */
export const EditDialog = ({
  plantId,
  plantName,
  shift,
  onClose,
  onSaved,
  onDeactivate,
}: EditDialogProps) => {
  const shiftId = shift?.shiftId ?? null;
  const detail = useShiftDetail(shiftId);
  const [draft, setDraft] = useState<Draft>(shift === null ? EMPTY : draftOf(shift));
  const [touched, setTouched] = useState(false);
  const save = useSaveShift(shiftId, onSaved);

  /* 상세가 오면 그 값으로 채운다 — 목록을 받은 뒤 누가 고쳤을 수 있다. */
  const loaded = detail.data?.shift;
  useEffect(() => {
    if (loaded !== undefined) setDraft(draftOf(loaded));
  }, [loaded]);

  const editability = detail.data?.editability;
  const codeLocked = shift !== null && editability?.codeEditable === false;
  const waiting = shift !== null && detail.data === undefined;

  const missing = {
    shiftCode: draft.shiftCode.trim() === '',
    shiftName: draft.shiftName.trim() === '',
    startTime: draft.startTime === '',
    endTime: draft.endTime === '',
  };
  const fieldError = (field: keyof Draft): string | undefined =>
    save.fieldErrors[field] ?? (touched && missing[field] ? td.required : undefined);

  const update = (patch: Partial<Draft>) => {
    for (const field of Object.keys(patch)) save.clearFieldError(field);
    setDraft((current) => ({ ...current, ...patch }));
  };

  const submit = () => {
    setTouched(true);
    if (Object.values(missing).some(Boolean)) return;
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
        {save.error !== null && <SaveErrorBanner error={save.error} />}
        <dl className="shift-management-head">
          <dt>{td.plant}</dt>
          <dd>{plantName}</dd>
        </dl>
        <TextField
          label={td.code}
          required
          placeholder={td.codePlaceholder}
          maxLength={50}
          value={draft.shiftCode}
          disabled={codeLocked}
          helperText={
            codeLocked && editability !== undefined
              ? td.codeLocked(editability.referenceCount ?? 0)
              : undefined
          }
          error={fieldError('shiftCode')}
          onChange={(event) => update({ shiftCode: event.target.value })}
        />
        <TextField
          label={td.name}
          required
          placeholder={td.namePlaceholder}
          maxLength={200}
          value={draft.shiftName}
          error={fieldError('shiftName')}
          onChange={(event) => update({ shiftName: event.target.value })}
        />
        <div className="shift-management-times">
          <Field label={td.start} labelAs="span" required error={fieldError('startTime')}>
            {(ids) => (
              <TimeField
                labels={START_LABELS}
                hour={draft.startTime.slice(0, 2)}
                minute={draft.startTime.slice(3, 5)}
                disabled={false}
                invalid={ids.invalid}
                describedBy={ids.describedById}
                onChange={(hour, minute) => update({ startTime: `${hour}:${minute}` })}
              />
            )}
          </Field>
          <Field label={td.end} labelAs="span" required error={fieldError('endTime')}>
            {(ids) => (
              <TimeField
                labels={END_LABELS}
                hour={draft.endTime.slice(0, 2)}
                minute={draft.endTime.slice(3, 5)}
                disabled={false}
                invalid={ids.invalid}
                describedBy={ids.describedById}
                onChange={(hour, minute) => update({ endTime: `${hour}:${minute}` })}
              />
            )}
          </Field>
        </div>
        {endsNextDay(draft.startTime, draft.endTime) && (
          <p className="field-note">{td.nextDayNote}</p>
        )}
      </div>
    );
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={shift === null ? td.addTitle : td.editTitle}
      size="sm"
      footer={
        <>
          {shift !== null && (
            <Button
              variant="outlined"
              className="shift-management-deactivate"
              disabled={waiting || save.isSaving}
              onClick={() => onDeactivate(shift)}
            >
              {td.deactivate}
            </Button>
          )}
          <Button variant="outlined" onClick={onClose}>
            {td.cancel}
          </Button>
          <Button loading={save.isSaving} disabled={waiting} onClick={submit}>
            {td.save}
          </Button>
        </>
      }
    >
      {body()}
    </Dialog>
  );
};
