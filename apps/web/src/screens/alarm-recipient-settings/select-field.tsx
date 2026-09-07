import { Select } from '@crefle/web-ui';
import { useId } from 'react';

import type { Option } from './types';

export interface SelectFieldProps {
  label: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  error?: string;
  note?: string;
  placeholder: string;
  disabled?: boolean;
}

export const SelectField = ({
  label,
  options,
  value,
  onChange,
  error,
  note,
  placeholder,
  disabled = false,
}: SelectFieldProps) => {
  const id = useId();
  const errorId = `${id}-error`;
  const noteId = `${id}-note`;

  return (
    <div className="field-cell wide-select">
      <span className="field-label">
        <label htmlFor={id}>{label}</label>
      </span>
      <Select
        id={id}
        options={options}
        value={value === '' ? null : value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        invalid={error !== undefined}
        aria-describedby={
          [error === undefined ? null : errorId, note === undefined ? null : noteId]
            .filter((value) => value !== null)
            .join(' ') || undefined
        }
      />
      {error !== undefined && (
        <span id={errorId} className="field-error">
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
