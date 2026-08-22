import { AlertBanner, Button, Checkbox, Dialog, Radio, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, type ReactNode } from 'react';

import { WEEKDAY_NUMBERS } from './bulk-days';
import type { BulkFormValues, DayFormValues } from './types';

const t = messages.workCalendar;

/** 계약이 정한 세 값. **화면이 늘리지 않는다.** */
const DAY_TYPES = [
  { value: 'WORKING', label: t.grid.status.working },
  { value: 'HOLIDAY', label: t.grid.status.holiday },
  { value: 'PARTIAL', label: t.grid.status.partial },
] as const;

export interface BulkFormDialogProps {
  values: BulkFormValues;
  onChange: (patch: Partial<BulkFormValues>) => void;
  onChangeDay: (patch: Partial<DayFormValues>) => void;
  fieldErrors: Record<string, string>;
  banner: ReactNode;
  /** 지금 조건으로 바뀔 날 수. **화면이 센 값이고 그대로 보낸다** */
  affectedCount: number;
  isSaving: boolean;
  onClose: () => void;
  onApply: () => void;
}

/**
 * 일괄 적용 창.
 *
 * ⭐ **바뀔 날 수를 «누르기 전에» 보인다**(스펙 §6). 통째로 되돌리는 수단이 없으므로 누른 뒤에
 * 세어 보이면 늦다 — 그리고 화면이 센 그 목록을 **그대로** 보내므로, 보인 수와 실제로 바뀌는
 * 수가 갈리지 않는다.
 *
 * ⭐ **요일을 하나도 고르지 않으면 기간 전체다** — 「요일 일괄」과 「기간 일괄」이 한 창이다.
 * 둘을 가르면 사용자가 어느 창을 열어야 하는지부터 정해야 한다.
 */
export const BulkFormDialog = ({
  values,
  onChange,
  onChangeDay,
  fieldErrors,
  banner,
  affectedCount,
  isSaving,
  onClose,
  onApply,
}: BulkFormDialogProps) => {
  const groupId = useId();
  const nothingId = useId();
  const onPartial = values.day.dayTypeCode === 'PARTIAL';
  const nothingToChange = affectedCount === 0;

  const toggleWeekday = (weekday: number): void => {
    onChange({
      weekdays: values.weekdays.includes(weekday)
        ? values.weekdays.filter((value) => value !== weekday)
        : [...values.weekdays, weekday],
    });
  };

  return (
    <Dialog
      open
      onClose={onClose}
      closeOnBackdropClick={false}
      title={t.bulk.title}
      footer={
        <>
          <Button variant="outlined" disabled={isSaving} onClick={onClose}>
            {messages.common.cancel}
          </Button>
          <Button
            loading={isSaving}
            disabled={isSaving || nothingToChange}
            /* 잠긴 버튼은 포커스를 못 받아 툴팁이 닿지 않는다 — 사유를 보이는 글자로 잇는다. */
            aria-describedby={nothingToChange ? nothingId : undefined}
            onClick={onApply}
          >
            {t.bulk.apply}
          </Button>
        </>
      }
    >
      <div className="form-grid dialog-scroll">
        {banner}

        <TextField
          label={t.bulk.from}
          required
          placeholder="2026-08-01"
          value={values.from}
          onChange={(event) => onChange({ from: event.target.value })}
          error={fieldErrors.from}
        />

        <TextField
          label={t.bulk.to}
          required
          placeholder="2026-08-31"
          value={values.to}
          onChange={(event) => onChange({ to: event.target.value })}
          error={fieldErrors.to}
        />

        <div className="form-grid-full">
          <fieldset className="field-cell">
            <legend className="field-label">{t.bulk.weekdays}</legend>
            <div className="filter-bar">
              {WEEKDAY_NUMBERS.map((weekday) => (
                <Checkbox
                  key={weekday}
                  checked={values.weekdays.includes(weekday)}
                  onChange={() => toggleWeekday(weekday)}
                >
                  {t.grid.weekdays[weekday]}
                </Checkbox>
              ))}
            </div>
            <span className="field-note">{t.bulk.weekdaysNote}</span>
          </fieldset>
        </div>

        <div className="form-grid-full">
          <fieldset className="field-cell">
            <legend className="field-label">{t.dayForm.dayType}</legend>
            <div className="check-group">
              {DAY_TYPES.map((type) => (
                <Radio
                  key={type.value}
                  name={groupId}
                  value={type.value}
                  checked={values.day.dayTypeCode === type.value}
                  onChange={() => onChangeDay({ dayTypeCode: type.value })}
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
          value={values.day.startTime}
          onChange={(event) => onChangeDay({ startTime: event.target.value })}
          disabled={!onPartial}
          disabledReason={t.dayForm.timeNeedsPartial}
          error={fieldErrors.startTime}
        />

        <TextField
          label={t.dayForm.endTime}
          required={onPartial}
          placeholder="12:00"
          value={values.day.endTime}
          onChange={(event) => onChangeDay({ endTime: event.target.value })}
          disabled={!onPartial}
          disabledReason={t.dayForm.timeNeedsPartial}
          error={fieldErrors.endTime}
        />

        <TextField
          label={t.dayForm.reason}
          value={values.day.reasonCode}
          onChange={(event) => onChangeDay({ reasonCode: event.target.value })}
          helperText={t.dayForm.reasonOptional}
          error={fieldErrors.reasonCode}
        />

        <TextField
          label={t.dayForm.remarks}
          value={values.day.remarks}
          onChange={(event) => onChangeDay({ remarks: event.target.value })}
          error={fieldErrors.remarks}
        />

        {/*
         * ⭐ **누르기 전에 몇 날이 바뀌는지 말한다.** 되돌리는 수단이 없으므로 이 자리가
         * 사용자가 멈출 수 있는 마지막 지점이다.
         */}
        <div className="form-grid-full">
          {nothingToChange ? (
            <AlertBanner variant="warning">
              <span id={nothingId}>{t.bulk.nothingToChange}</span>
            </AlertBanner>
          ) : (
            <AlertBanner variant="warning" title={t.bulk.willChange(affectedCount)}>
              {t.bulk.notReversible}
            </AlertBanner>
          )}
        </div>
      </div>
    </Dialog>
  );
};
