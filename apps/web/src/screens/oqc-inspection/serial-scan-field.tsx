import { TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, useState, type KeyboardEvent, type ReactNode } from 'react';

import { FieldLabel } from './field-label';

const t = messages.oqcInspection.serials;

export interface SerialScanFieldProps {
  label: string;
  /** 라벨 오른쪽 같은 줄의 안내. 주면 칸 아래 안내 대신 라벨 옆에 선다(#136). */
  labelHint?: string;
  /** 입력 칸 안내 글. 없으면 공용 스캔 안내다. */
  placeholder?: string;
  helperText?: ReactNode;
  /** 스캔 결과로 보일 문구 — 막힌 이유나 실패. */
  error?: string | null;
  disabled?: boolean;
  /** 끝나면(성공·실패 모두) 칸을 비운다 — 다음 스캔을 바로 받는다. */
  onScan: (serialNo: string) => Promise<void>;
}

/**
 * 시리얼 스캔 칸(omf-all-around#68). 스캐너는 끝에 Enter 를 보낸다.
 * ⛔ Enter 가 바깥 판정 폼을 제출하지 않게 막는다 — 제출은 되돌릴 수 없는 판정 저장을 연다.
 */
export const SerialScanField = ({
  label,
  labelHint,
  placeholder = t.scanPlaceholder,
  helperText,
  error,
  disabled = false,
  onScan,
}: SerialScanFieldProps) => {
  const [value, setValue] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const inputId = useId();

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const serialNo = value.trim();
    if (serialNo === '' || isScanning) return;
    setIsScanning(true);
    void onScan(serialNo).finally(() => {
      setIsScanning(false);
      setValue('');
    });
  };

  const field = (
    <TextField
      id={labelHint === undefined ? undefined : inputId}
      label={labelHint === undefined ? label : undefined}
      fullWidth
      size="sm"
      placeholder={placeholder}
      value={value}
      disabled={disabled}
      helperText={isScanning ? t.scanning : helperText}
      error={error ?? undefined}
      onChange={(event) => setValue(event.target.value)}
      onKeyDown={handleKeyDown}
    />
  );

  /* DS 라벨은 글만 받아 옆 안내를 붙일 수 없다 — 그때만 라벨을 직접 세우고 id 로 잇는다. */
  if (labelHint === undefined) return field;

  return (
    <div className="field-cell">
      <FieldLabel htmlFor={inputId} label={label} hint={labelHint} />
      {field}
    </div>
  );
};
