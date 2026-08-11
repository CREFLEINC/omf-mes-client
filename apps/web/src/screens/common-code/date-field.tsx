import { DatePicker } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import { FieldLabel } from './field-label';

export interface DateFieldProps {
  label: string;
  /** `YYYY-MM-DD` 또는 빈 문자열. 폼 값의 자료형은 그대로 두고 표현만 달력으로 바꾼다. */
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  /** 보조 안내. 오류가 있으면 오류가 우선한다. */
  note?: string;
  error?: string;
}

/**
 * 라벨과 보조 문구가 붙는 날짜칸.
 *
 * 디자인 시스템 `DatePicker`에는 `label`·`error` prop이 없다 — `Select`와 같은 사정이라
 * 같은 방법으로 푼다(배치 규범 3). 라벨을 직접 만들고, 오류는 항상 보이는 DOM 텍스트로 렌더해
 * `aria-describedby`로 잇는다. 컴포넌트에는 `invalid`만 넘겨 테두리와 `aria-invalid`를 맡긴다.
 *
 * **빈 값과 고른 값을 가른다.** 폼 값은 빈 문자열로 「지정하지 않음」을 나타내지만
 * `DatePicker`는 `null`을 그 뜻으로 받는다. 빈 문자열을 그대로 넘기면 날짜로 읽으려 든다.
 *
 * ⚠ `DatePicker`에는 **고른 날짜를 다시 비우는 수단이 없다**(0.2.0 실측). 계약이 널을 허용하는
 * 칸에서도 한 번 고르면 「지정하지 않음」으로 되돌릴 수 없다 — 통지 #63에 물어 둔 사항이다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const DateField = ({
  label,
  value,
  onChange,
  required = false,
  disabled = false,
  note,
  error,
}: DateFieldProps) => {
  const id = useId();
  const noteId = `${id}-note`;
  // 지금 고칠 수 있는 것을 먼저 보인다 — 오류가 있으면 안내를 밀어낸다.
  const message = error ?? note;

  return (
    <div className="field-cell">
      <FieldLabel htmlFor={id} label={label} required={required} />
      <DatePicker
        id={id}
        value={value === '' ? null : value}
        onChange={onChange}
        placeholder={messages.common.selectDate}
        disabled={disabled}
        invalid={error !== undefined}
        aria-required={required || undefined}
        aria-describedby={message === undefined ? undefined : noteId}
      />
      {message !== undefined && (
        <span id={noteId} className={error === undefined ? 'field-note' : 'field-error'}>
          {message}
        </span>
      )}
    </div>
  );
};
