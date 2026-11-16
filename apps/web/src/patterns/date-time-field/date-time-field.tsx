import { TimeField } from '../time-field';
import { DatePicker, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

/**
 * C-12 일시 입력. DS `DatePicker`(yyyy-MM-dd)와 시각 입력(HH:mm)의 조합이다.
 * 값은 `yyyy-MM-ddTHH:mm`(공장 시각) 문자열 하나로 주고받는다. 빈 값은 ''.
 * 시각은 필요에 따라 시·분 선택 팝업을 쓴다. 값은 공장 현지 시각 HH:mm을 유지한다.
 */
export interface DateTimeFieldProps {
  label: string;
  value: string;
  /** 칸 높이(C-19). */
  size?: 'sm' | 'md';
  timePicker?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  'aria-describedby'?: string;
  onChange: (value: string) => void;
}

const split = (value: string): [string, string] => {
  const [date = '', time = ''] = value.split('T');
  return [date, time.slice(0, 5)];
};

export const DateTimeField = ({
  label,
  value,
  size = 'md',
  timePicker = false,
  disabled = false,
  invalid = false,
  'aria-describedby': describedBy,
  onChange,
}: DateTimeFieldProps) => {
  const id = useId();
  const [date, time] = split(value);
  const join = (nextDate: string, nextTime: string) =>
    onChange(nextDate === '' ? '' : `${nextDate}T${nextTime === '' ? '00:00' : nextTime}`);

  return (
    <div className="field-cell date-time-field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <div className="date-time-field-controls">
        <DatePicker
          id={id}
          size={size}
          value={date === '' ? null : date}
          disabled={disabled}
          invalid={invalid}
          aria-describedby={describedBy}
          onChange={(next) => join(next, time)}
        />

        {timePicker ? (
          <div className="date-time-field-time date-time-field-picker">
            <TimeField
              labels={{
                field: messages.screenPatterns.dateTimeField.time(label),
                hourList: messages.screenPatterns.dateTimeField.hour(label),
                minuteList: messages.screenPatterns.dateTimeField.minute(label),
                hourHead: messages.screenPatterns.dateTimeField.hourLabel,
                minuteHead: messages.screenPatterns.dateTimeField.minuteLabel,
                placeholder: messages.screenPatterns.dateTimeField.timePlaceholder,
              }}
              hour={time.split(':')[0] ?? ''}
              minute={time.split(':')[1] ?? ''}
              onChange={(hour, minute) => join(date, `${hour}:${minute}`)}
              disabled={disabled}
              invalid={invalid}
              describedBy={describedBy}
            />
          </div>
        ) : (
          <TextField
            containerClassName="date-time-field-time"
            size={size}
            inputMode="numeric"
            maxLength={5}
            placeholder={messages.screenPatterns.dateTimeField.timePlaceholder}
            aria-label={messages.screenPatterns.dateTimeField.time(label)}
            value={time}
            disabled={disabled}
            aria-invalid={invalid || undefined}
            onChange={(event) => join(date, event.target.value)}
          />
        )}
      </div>
    </div>
  );
};
