import { Chip, TextField, type TextFieldProps } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useId } from 'react';

/**
 * 잠긴 코드 칸 이름 오른쪽의 「변경 불가」 상태 라벨(사용자 지시 2026-11-24 — 「지금은 코드를 바꿀 수 없습니다 …」 같은
 * 잠금 사유 문장 대신). 사유 문장은 화면에 펼치지 않는다 — 라벨에 마우스를 올리면 보이고(`title`), 입력칸은
 * `reasonId` 의 숨긴 글을 `aria-describedby` 로 가리켜 화면 읽기 프로그램이 읽는다.
 *
 * `children` 은 그 칸의 이름(필수 표시 포함) — 별은 이름 바로 뒤, 라벨은 그 오른쪽이다. 잠기지 않았으면 이름만 낸다.
 */
export const CodeLockLabel = ({
  reason,
  reasonId,
  children,
}: {
  reason: string | null;
  reasonId: string;
  children: ReactNode;
}) => {
  if (reason === null) return children;

  return (
    <span className="code-lock-label-row">
      {children}
      <Chip variant="status" size="sm" status="idle" className="code-lock-chip" title={reason}>
        {messages.editability.badge}
      </Chip>
      <span id={reasonId} className="visually-hidden">
        {reason}
      </span>
    </span>
  );
};

/**
 * 디자인 시스템 `TextField` 의 내장 라벨(`label`)을 쓰는 코드 칸용. 내장 라벨은 문자열이라 옆에 라벨을 끼울 자리가
 * 없어, **잠겼을 때만** 이름을 밖으로 꺼내 `CodeLockLabel` 로 그린다. 잠기지 않았으면 종전 `TextField` 그대로다.
 */
export const CodeLockTextField = ({
  lockReason,
  label,
  required,
  id,
  'aria-describedby': describedBy,
  ...rest
}: Omit<TextFieldProps, 'label' | 'disabled' | 'disabledReason'> & {
  label: string;
  lockReason: string | null;
}) => {
  const fallbackId = useId();
  const inputId = id ?? fallbackId;
  const reasonId = `${inputId}-lock`;

  if (lockReason === null) {
    return (
      <TextField
        {...rest}
        id={inputId}
        label={label}
        required={required}
        aria-describedby={describedBy}
      />
    );
  }

  return (
    <div className="code-lock-field">
      <CodeLockLabel reason={lockReason} reasonId={reasonId}>
        <span className="field-label">
          <label htmlFor={inputId}>{label}</label>
          {required === true && (
            <span className="required-mark" aria-hidden="true">
              {' '}
              *
            </span>
          )}
        </span>
      </CodeLockLabel>
      <TextField
        {...rest}
        id={inputId}
        required={required}
        disabled
        aria-describedby={[describedBy, reasonId].filter(Boolean).join(' ')}
      />
    </div>
  );
};
