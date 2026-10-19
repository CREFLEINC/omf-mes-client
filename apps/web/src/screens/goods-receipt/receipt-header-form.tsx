import { DatePicker, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState } from 'react';

import { FieldLabel } from '../../patterns/select-field';

const t = messages.goodsReceipt;

/** `YYYY-MM-DDTHH:mm` — 요청 조립(`toOffsetDateTime`)이 받는 형식 그대로다. */
const join = (date: string, time: string): string =>
  date === '' || time === '' ? '' : `${date}T${time}`;

export interface ReceiptDatetimeFieldProps {
  /** `YYYY-MM-DDTHH:mm` 또는 빈 문자열 */
  value: string;
  error?: string;
  disabled: boolean;
  className?: string;
  onChange: (value: string) => void;
}

/**
 * 입고 일시 — 날짜는 DS `DatePicker`(C-12), 시각은 시:분 입력.
 *
 * DS에 일시 선택 부품이 없어 둘로 나눴다. **둘 다 채워야 값이 된다** — 한쪽만 넣은 동안은
 * 화면에는 남기되 초안에는 빈 값으로 둔다(입고 처리가 「입고 일시를 넣으세요」로 막힌다).
 * 영업일은 이 값의 날짜로 정해진다 — 그 사실은 「자동 적용 값」 구획이 밝힌다.
 */
export const ReceiptDatetimeField = ({
  value,
  error,
  disabled,
  className,
  onChange,
}: ReceiptDatetimeFieldProps) => {
  const dateId = useId();
  const errorId = `${dateId}-error`;
  const [date, setDate] = useState(value.slice(0, 10));
  const [time, setTime] = useState(value.slice(11, 16));

  /* 초안이 밖에서 채워지면(되돌림 등) 두 칸을 그 값에 맞춘다. 비워진 경우는 치던 반쪽을 지우지 않는다. */
  useEffect(() => {
    if (value === '') return;

    setDate(value.slice(0, 10));
    setTime(value.slice(11, 16));
  }, [value]);

  return (
    <div className={['field-cell', className].filter(Boolean).join(' ')}>
      <FieldLabel htmlFor={dateId} label={t.fields.receiptDatetime} required />
      <div className="goods-receipt-datetime">
        <DatePicker
          id={dateId}
          value={date === '' ? null : date}
          placeholder={messages.common.selectDate}
          invalid={error !== undefined}
          disabled={disabled}
          aria-describedby={error === undefined ? undefined : errorId}
          onChange={(next) => {
            setDate(next);
            onChange(join(next, time));
          }}
        />
        <TextField
          type="time"
          aria-label={t.process.receiptTime}
          value={time}
          disabled={disabled}
          onChange={(event) => {
            setTime(event.target.value);
            onChange(join(date, event.target.value));
          }}
        />
      </div>
      {error !== undefined && (
        <span id={errorId} className="field-error">
          {error}
        </span>
      )}
    </div>
  );
};

export interface RemarksFieldProps {
  value: string;
  error?: string;
  disabled: boolean;
  onChange: (value: string) => void;
}

/** 비고 — 선택 입력이라 「추가 입력(선택)」 안에 둔다(T-W-C). */
export const RemarksField = ({ value, error, disabled, onChange }: RemarksFieldProps) => (
  <div className="field-cell">
    <TextField
      label={t.fields.remarks}
      value={value}
      error={error}
      disabled={disabled}
      onChange={(event) => {
        onChange(event.target.value);
      }}
    />
  </div>
);
