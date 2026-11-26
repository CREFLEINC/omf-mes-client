import { TextField, type TextFieldProps } from '@crefle/web-ui';
import { type ReactNode, useId } from 'react';

/**
 * 잠긴 코드 칸의 이름. 이름 옆 「변경 불가」 라벨은 두지 않는다(팝업 디자인 시안 2026-11-26 · omf-all-around#360) —
 * 잠긴 칸은 회색(잠긴) 칸 모양으로만 구분한다. 잠금 사유 문장은 화면에 펼치지 않고, 이름에 마우스를 올리면 보이며(`title`),
 * 입력칸은 `reasonId` 의 숨긴 글을 `aria-describedby` 로 가리켜 화면 읽기 프로그램이 읽는다.
 *
 * `children` 은 그 칸의 이름(필수 표시 포함). 잠기지 않았으면 이름만 낸다.
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
    <span className="code-lock-label-row" title={reason}>
      {children}
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
