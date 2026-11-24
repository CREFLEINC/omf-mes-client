import { type SelectOption, type SelectOptionGroup } from '@crefle/web-ui';
import { useId } from 'react';

import { InfoTip } from '../../patterns/info-tip';
import { Select } from '../../patterns/select';

export interface SelectFieldProps {
  label: string;
  options: (SelectOption | SelectOptionGroup)[];
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  /** 선택지의 한계(잘림·불러오기 실패·아직 안 옴)를 밝히는 보조 문구 — 그 사정이 있을 때만 준다. */
  note?: string;
  /** 칸의 규칙(무엇을 고르는지) — 칸 아래가 아니라 라벨 옆 ⓘ 로 둔다(관리웹 정리 시안 A). */
  info?: string;
  /** 그 칸 아래 서는 오류. 화면이 잡은 것과 서버가 준 것이 같은 칸에 붙는다. */
  error?: string;
  disabled?: boolean;
  /** 비활성 사유 — 규범 4: 항상 보이는 텍스트로 렌더하고 `aria-describedby` 로 잇는다. */
  disabledReason?: string;
  wide?: boolean;
}

/**
 * 라벨과 보조 문구가 붙는 선택칸. 디자인 시스템 `Select` 에는 `label`·`helperText` prop 이 없다
 * (규범 3) — 라벨을 직접 만들되 내장 라벨과 같은 토큰(`.field-label`)을 쓴다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const SelectField = ({
  label,
  options,
  value,
  onChange,
  required = false,
  placeholder,
  note,
  info,
  error,
  disabled = false,
  disabledReason,
  wide = false,
}: SelectFieldProps) => {
  const id = useId();
  const noteId = `${id}-note`;
  const errorId = `${id}-error`;
  const reasonId = `${id}-reason`;
  const isLocked = disabled && disabledReason !== undefined;
  const describedBy = [
    isLocked ? reasonId : undefined,
    error === undefined ? undefined : errorId,
    note === undefined ? undefined : noteId,
  ]
    .filter((part): part is string => part !== undefined)
    .join(' ');
  const labelNode = (
    <span className="field-label">
      <label htmlFor={id}>{label}</label>
      {/* 필수 표시는 라벨 밖 — 칸 이름에 `*` 가 섞이지 않게 한다. */}
      {required && (
        <span className="required-mark" aria-hidden="true">
          {' *'}
        </span>
      )}
    </span>
  );

  return (
    <div className={wide ? 'field-cell wide-select' : 'field-cell'}>
      {info === undefined ? (
        labelNode
      ) : (
        <span className="info-label">
          {labelNode}
          <InfoTip text={info} />
        </span>
      )}
      <Select
        id={id}
        options={options}
        value={value === '' ? null : value}
        placeholder={placeholder}
        disabled={disabled}
        invalid={error !== undefined}
        aria-required={required || undefined}
        aria-describedby={describedBy === '' ? undefined : describedBy}
        onChange={(next) => onChange(next ?? '')}
      />
      {isLocked && (
        <span id={reasonId} className="field-note">
          {disabledReason}
        </span>
      )}
      {error !== undefined && (
        <span id={errorId} className="field-error" role="alert">
          {error}
        </span>
      )}
      {note !== undefined && (
        <span id={noteId} className="field-note">
          {note}
        </span>
      )}
    </div>
  );
};
