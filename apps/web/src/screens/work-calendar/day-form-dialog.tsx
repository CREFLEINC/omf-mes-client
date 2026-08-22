import { Button, Dialog, Radio, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, type ReactNode } from 'react';

import type { DayFormValues } from './types';

const t = messages.workCalendar;

/** 계약이 정한 세 값. **화면이 늘리지 않는다** — 뜻도 계약이 적었다. */
const DAY_TYPES = [
  { value: 'WORKING', label: t.grid.status.working },
  { value: 'HOLIDAY', label: t.grid.status.holiday },
  { value: 'PARTIAL', label: t.grid.status.partial },
] as const;

export interface DayFormDialogProps {
  /** 고치는 날. `YYYY-MM-DD` */
  calendarDate: string;
  values: DayFormValues;
  onChange: (patch: Partial<DayFormValues>) => void;
  fieldErrors: Record<string, string>;
  banner: ReactNode;
  isSaving: boolean;
  onClose: () => void;
  onSave: () => void;
}

/**
 * 하루 설정 창.
 *
 * ⭐ **구분을 라디오로 낸다** — 셋뿐이고 서로 배타적이라, 펼쳐 두면 무엇을 고를 수 있는지가
 * 한눈에 보인다. 선택칸으로 접으면 「부분 가동이라는 갈래가 있다」는 것을 눌러야 알게 된다.
 *
 * ⭐ **부분 가동이 아니면 시각을 잠그고 사유를 붙인다**(G-2) — 감추지 않는다.
 * 값은 지우지 않는다: 다시 부분 가동으로 바꾸면 방금 적은 것이 그대로 있고,
 * **비우는 자리는 보낼 때 하나다**(`toDayUpdate`).
 */
export const DayFormDialog = ({
  calendarDate,
  values,
  onChange,
  fieldErrors,
  banner,
  isSaving,
  onClose,
  onSave,
}: DayFormDialogProps) => {
  const groupId = useId();
  const onPartial = values.dayTypeCode === 'PARTIAL';

  return (
    <Dialog
      open
      onClose={onClose}
      closeOnBackdropClick={false}
      title={t.dayForm.title(calendarDate)}
      footer={
        <>
          <Button variant="outlined" disabled={isSaving} onClick={onClose}>
            {messages.common.cancel}
          </Button>
          <Button disabled={isSaving} onClick={onSave}>
            {messages.common.save}
          </Button>
        </>
      }
    >
      <div className="form-grid dialog-scroll">
        {banner}

        <div className="form-grid-full">
          <fieldset className="field-cell" aria-describedby={groupId}>
            <legend className="field-label">{t.dayForm.dayType}</legend>
            <div className="check-group">
              {DAY_TYPES.map((type) => (
                <Radio
                  key={type.value}
                  name={groupId}
                  value={type.value}
                  checked={values.dayTypeCode === type.value}
                  onChange={() => onChange({ dayTypeCode: type.value })}
                >
                  {type.label}
                </Radio>
              ))}
            </div>
            {fieldErrors.dayTypeCode !== undefined && (
              <span className="field-error">{fieldErrors.dayTypeCode}</span>
            )}
          </fieldset>
        </div>

        <TextField
          label={t.dayForm.startTime}
          required={onPartial}
          placeholder="08:00"
          value={values.startTime}
          onChange={(event) => onChange({ startTime: event.target.value })}
          disabled={!onPartial}
          disabledReason={t.dayForm.timeNeedsPartial}
          error={fieldErrors.startTime}
        />

        <TextField
          label={t.dayForm.endTime}
          required={onPartial}
          placeholder="12:00"
          value={values.endTime}
          onChange={(event) => onChange({ endTime: event.target.value })}
          disabled={!onPartial}
          disabledReason={t.dayForm.timeNeedsPartial}
          error={fieldErrors.endTime}
        />

        {/*
         * ⚠ 사유 코드 값 목록이 아직 없다(`omf-mes#145`). **선택칸으로 내지 않는다** —
         * 고를 것이 자리표시뿐인 칸을 두면 누르는 사람마다 빈 목록을 만난다.
         * 계약이 선택으로 둔 값이라 **비워 두어도 저장된다**는 사실을 함께 밝힌다.
         */}
        <TextField
          label={t.dayForm.reason}
          value={values.reasonCode}
          onChange={(event) => onChange({ reasonCode: event.target.value })}
          helperText={t.dayForm.reasonOptional}
          error={fieldErrors.reasonCode}
        />

        <TextField
          label={t.dayForm.remarks}
          value={values.remarks}
          onChange={(event) => onChange({ remarks: event.target.value })}
          error={fieldErrors.remarks}
        />
      </div>
    </Dialog>
  );
};
