import { forwardRef, useId, type ReactNode, type TextareaHTMLAttributes } from 'react';

import './text-area.css';

export type TextAreaResize = 'none' | 'vertical' | 'horizontal' | 'both';

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** 시각적 라벨. 없으면 aria-label 또는 aria-labelledby를 전달해야 한다. */
  label?: string;
  /** 도움말. 오류나 비활성 사유가 있으면 우선순위에 따라 대체된다. */
  helperText?: ReactNode;
  /** 오류 상태와 오류 문구. */
  error?: ReactNode;
  /** 비활성일 때만 표시하는 잠금 사유. 오류가 있으면 오류가 우선한다. */
  disabledReason?: ReactNode;
  /** 컨트롤을 부모 폭에 맞춘다. */
  fullWidth?: boolean;
  /** 사용자가 바꿀 수 있는 크기 조절 방향. */
  resize?: TextAreaResize;
}

const joinIds = (...ids: Array<string | undefined>): string | undefined => {
  const joined = ids
    .flatMap((id) => id?.split(/\s+/) ?? [])
    .filter((id) => id !== '')
    .join(' ');

  return joined === '' ? undefined : joined;
};

const joinClassNames = (...classNames: Array<string | false | undefined>): string =>
  classNames.filter(Boolean).join(' ');

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  {
    label,
    helperText,
    error,
    disabledReason,
    fullWidth = false,
    resize = 'vertical',
    className,
    id,
    disabled,
    required,
    'aria-describedby': ariaDescribedBy,
    'aria-invalid': ariaInvalid,
    'aria-required': ariaRequired,
    ...textareaProps
  },
  ref,
) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const helperId = `${controlId}-helper`;
  const errorId = `${controlId}-error`;
  const disabledReasonId = `${controlId}-reason`;
  const hasError = Boolean(error);
  const hasDisabledReason = Boolean(disabled && disabledReason) && !hasError;
  const message = hasError ? error : hasDisabledReason ? disabledReason : helperText;
  const messageId = hasError ? errorId : hasDisabledReason ? disabledReasonId : helperId;
  const describedBy = joinIds(ariaDescribedBy, message ? messageId : undefined);

  return (
    <div
      className="omf-text-area"
      data-disabled={disabled || undefined}
      data-full-width={fullWidth || undefined}
    >
      {label && (
        <label className="omf-text-area__label" htmlFor={controlId}>
          {label}
        </label>
      )}
      <textarea
        {...textareaProps}
        ref={ref}
        id={controlId}
        className={joinClassNames('omf-text-area__control', className)}
        disabled={disabled}
        required={required}
        aria-describedby={describedBy}
        aria-invalid={hasError ? true : ariaInvalid}
        aria-required={required ? true : ariaRequired}
        data-resize={resize}
      />
      {message && (
        <p
          id={messageId}
          className={joinClassNames(
            'omf-text-area__message',
            hasError && 'omf-text-area__message--error',
          )}
        >
          {message}
        </p>
      )}
    </div>
  );
});
