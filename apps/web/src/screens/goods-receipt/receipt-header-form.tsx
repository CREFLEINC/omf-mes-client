import { DatePicker, Select, TextField, type SelectOption } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, useState } from 'react';

const t = messages.goodsReceipt;

export interface ReceiptHeaderFormProps {
  /** 입고 일시(`YYYY-MM-DDTHH:mm`). 날짜·시각 중 하나라도 비었으면 빈 문자열이다. */
  receiptDatetime: string;
  remarks: string;
  /** 화면이 잡은 오류와 서버가 준 필드 오류를 합친 것. 어느 쪽이든 같은 자리에 낸다 */
  fieldErrors: Record<string, string>;
  isLocked: boolean;
  /** 입고 일시·비고 칸이 열려 있는가 — 입고 정보는 순서대로 입력한다(`post-steps.ts`). 주지 않으면 열린다. */
  isOpen?: boolean;
  onChangeReceiptDatetime: (value: string) => void;
  onChangeRemarks: (value: string) => void;
}

interface DatetimeParts {
  date: string;
  /** `00`~`23`. 고르지 않았으면 빈 문자열. */
  hour: string;
  /** `00`~`59`. 고르지 않았으면 빈 문자열. */
  minute: string;
}

const twoDigits = (count: number): SelectOption[] =>
  Array.from({ length: count }, (_, index) => {
    const value = String(index).padStart(2, '0');

    return { value, label: value };
  });

/** 시 `00`~`23` · 분 `00`~`59` — 1분 단위로 정확히 고른다(담당자 지시: 시각도 날짜처럼 «선택»). */
const HOUR_OPTIONS = twoDigits(24);
const MINUTE_OPTIONS = twoDigits(60);

const splitDatetime = (value: string): DatetimeParts =>
  value === ''
    ? { date: '', hour: '', minute: '' }
    : { date: value.slice(0, 10), hour: value.slice(11, 13), minute: value.slice(14, 16) };

/** 날짜·시·분이 다 있을 때만 입고 일시가 된다 — 아니면 빈 값(지금까지의 «미입력»과 같다). */
const joinDatetime = ({ date, hour, minute }: DatetimeParts): string =>
  date !== '' && hour !== '' && minute !== '' ? `${date}T${hour}:${minute}` : '';

/**
 * 입고 일자 · 입고 시각 · 비고.
 *
 * **입고 일시를 날짜와 시각 두 칸으로 받는다**(담당자 지시 — 시스템 표기 `yyyy-MM-dd HH:mm`).
 * 브라우저 기본 `datetime-local` 은 OS 언어를 따라 「연도. 월. 일. 오후 02:05」로 보여 표기를 맞출 수 없다.
 * 날짜는 디자인 시스템 `DatePicker`(표기 `YYYY-MM-DD` 고정 — 다른 화면과 같은 부품), 시각은 시(00~23)·분(00~59)
 * 두 개의 DS `Select` 로 **고른다**(담당자 지시 — 날짜처럼 선택. DS 에 시각 선택 부품이 없어 기존 부품을 조합했다.
 * 네이티브 `type="time"` 은 「오후 02:05」로 보인다). **보내는 값과 검증은 그대로다** — 날짜·시·분이 다 골라졌을 때만
 * 지금까지와 같은 `YYYY-MM-DDTHH:mm` 하나를 올리고, 아니면 빈 값을 올린다.
 *
 * **영업일 입력칸을 두지 않는다.** 계약이 영업일을 필수로 요구하지만 산출 규칙(야간조 경계 등)이
 * 어디에도 정의돼 있지 않아, 입력칸을 두면 사용자가 무엇을 넣어야 하는지 화면이 설명할 수 없다.
 * 입고 일시의 날짜로 파생하고 **그 사실을 「입고 정보」 제목 옆 안내로 밝힌다**(계획 결정 10) — 칸 아래에 두면
 * 그 칸만 키가 커져 같은 줄 칸들의 아랫선이 어긋난다.
 *
 * **수량 입력칸이 없다.** 전량 입고라 고른 입하 라인의 수량을 그대로 싣는다(계획 결정 4).
 *
 * 기존 디자인 시스템 컴포넌트의 조합이라 이 화면 슬라이스가 소유한다.
 */
export const ReceiptHeaderForm = ({
  receiptDatetime,
  remarks,
  fieldErrors,
  isLocked,
  isOpen = true,
  onChangeReceiptDatetime,
  onChangeRemarks,
}: ReceiptHeaderFormProps) => {
  const groupLabelId = useId();
  const errorId = `${groupLabelId}-error`;
  const isDisabled = isLocked || !isOpen;

  /*
   * 반쯤 채운 값(날짜만·시각 일부)은 이 칸이 들고 있는다 — 위로는 빈 값만 올라간다.
   * 위에서 값이 바뀌면(초안 비우기 등) 그 값을 따른다. 이 칸이 올린 값과 같으면 반쯤 채운 값을 지킨다.
   */
  const [parts, setParts] = useState<DatetimeParts>(() => splitDatetime(receiptDatetime));
  const [seenValue, setSeenValue] = useState(receiptDatetime);

  if (receiptDatetime !== seenValue) {
    setSeenValue(receiptDatetime);

    if (receiptDatetime !== joinDatetime(parts)) setParts(splitDatetime(receiptDatetime));
  }

  const changeParts = (next: DatetimeParts): void => {
    setParts(next);
    onChangeReceiptDatetime(joinDatetime(next));
  };

  const serverError = fieldErrors.receiptDatetime;
  const describedBy = serverError === undefined ? undefined : errorId;

  return (
    <div className="form-grid goods-receipt-post-grid">
      {/*
       * 입고 일시는 한 묶음 — 라벨 하나(「입고 일시 *」) 아래 날짜와 시각을 나란히 둔다(담당자 지시).
       * 두 칸의 접근 이름은 각각 「입고 일자」·「입고 시각」이고, 묶음 이름이 「입고 일시」다.
       */}
      <div
        className="field-cell goods-receipt-step-receiptDatetime goods-receipt-receipt-datetime"
        role="group"
        aria-labelledby={groupLabelId}
      >
        <span className="field-label">
          <span id={groupLabelId}>{t.fields.receiptDatetime}</span>
          <span className="goods-receipt-required" aria-hidden="true">
            *
          </span>
        </span>
        <div className="goods-receipt-datetime-pair">
          <DatePicker
            mode="single"
            aria-label={t.fields.receiptDate}
            placeholder={messages.common.selectDate}
            value={parts.date === '' ? null : parts.date}
            disabled={isDisabled}
            invalid={serverError !== undefined}
            aria-required
            aria-describedby={describedBy}
            onChange={(value) => {
              changeParts({ ...parts, date: value });
            }}
          />
          {/* 시·분 — 목록이 길면(분 60개) 목록 안에서 구른다. */}
          <Select
            aria-label={t.fields.receiptHour}
            aria-required
            aria-describedby={describedBy}
            options={HOUR_OPTIONS}
            value={parts.hour === '' ? null : parts.hour}
            placeholder={t.values.receiptHourPlaceholder}
            disabled={isDisabled}
            invalid={serverError !== undefined}
            onChange={(value) => {
              changeParts({ ...parts, hour: value });
            }}
          />
          <Select
            aria-label={t.fields.receiptMinute}
            aria-required
            aria-describedby={describedBy}
            options={MINUTE_OPTIONS}
            value={parts.minute === '' ? null : parts.minute}
            placeholder={t.values.receiptMinutePlaceholder}
            disabled={isDisabled}
            invalid={serverError !== undefined}
            onChange={(value) => {
              changeParts({ ...parts, minute: value });
            }}
          />
        </div>
        {serverError !== undefined && (
          <span id={errorId} className="field-error">
            {serverError}
          </span>
        )}
      </div>

      <div className="field-cell goods-receipt-remarks">
        <TextField
          label={t.fields.remarks}
          value={remarks}
          error={fieldErrors.remarks}
          disabled={isDisabled}
          onChange={(event) => {
            onChangeRemarks(event.target.value);
          }}
        />
      </div>
    </div>
  );
};
