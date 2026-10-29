import { DatePicker, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

/**
 * C-12 일시 입력. DS `DatePicker`(yyyy-MM-dd)와 시각 입력(HH:mm)의 조합이다.
 * 값은 `yyyy-MM-ddTHH:mm`(공장 시각) 문자열 하나로 주고받는다. 빈 값은 ''.
 * 시각은 24시간제 글자 칸(HH:mm)이다. 형식 검증은 부르는 쪽 모델이 한다.
 */
export interface DateTimeFieldProps {
  label: string;
  value: string;
  /** 칸 높이(C-19). */
  size?: 'sm' | 'md';
  disabled?: boolean;
  invalid?: boolean;
  /** 필수 칸 — 라벨 뒤 빨간 「*」(다른 필수 칸과 같은 표시). */
  required?: boolean;
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
  disabled = false,
  invalid = false,
  required = false,
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
        {required && (
          <span className="required-mark" aria-hidden="true">
            {' *'}
          </span>
        )}
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
        {/* 시각은 24시간제 HH:mm 글자 칸이다. 브라우저 시각 입력은 언어 설정에 따라 「오전/AM」이 섞인다(C-12, C-13). */}
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
      </div>
    </div>
  );
};
