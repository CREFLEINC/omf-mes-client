import { Icon, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

import { FieldLabel } from './field-label';

const t = messages.oqcInspection.serials;

export interface SerialScanFieldProps {
  label: string;
  /**
   * 라벨 오른쪽 같은 줄의 안내. 주면 목록 위 검색 칸 모양이 된다(#136) — 제목 크기 라벨 · 스캔 아이콘 ·
   * 한 단계 큰 칸.
   */
  labelHint?: string;
  /** 입력 칸 안내 글. 없으면 공용 스캔 안내다. */
  placeholder?: string;
  helperText?: ReactNode;
  /** 스캔 결과로 보일 문구 — 막힌 이유나 실패. */
  error?: string | null;
  disabled?: boolean;
  /**
   * 끝나면 칸을 비운다 — 다음 스캔을 바로 받는다. `false` 로 끝나면(찾지 못함) 친 번호를 남기고 전체 선택한다 —
   * 무엇이 틀렸는지 보이고, 다음 스캔은 그 글자를 덮어쓴다.
   */
  onScan: (serialNo: string) => Promise<boolean | void>;
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
  const inputRef = useRef<HTMLInputElement>(null);
  /** 찾지 못해 남겨 둔 번호 — 다음에 치는 글자가 이것에 이어 붙지 않고 새로 시작한다(칸을 눌러 선택이 풀려도). */
  const keptRef = useRef(false);

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const serialNo = value.trim();
    if (serialNo === '' || isScanning) return;
    setIsScanning(true);
    void onScan(serialNo)
      .then(
        (ok) => {
          if (ok === false) {
            keptRef.current = true;
            return inputRef.current?.select();
          }
          setValue('');
        },
        () => setValue(''),
      )
      .finally(() => setIsScanning(false));
  };

  const field = (
    <TextField
      ref={inputRef}
      id={labelHint === undefined ? undefined : inputId}
      label={labelHint === undefined ? label : undefined}
      fullWidth
      size={labelHint === undefined ? 'sm' : 'md'}
      leadingIcon={
        labelHint === undefined ? undefined : (
          <Icon name="qr_code_scanner" size={20} aria-hidden="true" />
        )
      }
      placeholder={placeholder}
      value={value}
      disabled={disabled}
      helperText={isScanning ? t.scanning : helperText}
      error={error ?? undefined}
      onChange={(event) => {
        const typed = keptRef.current ? (event.nativeEvent as InputEvent).data : null;
        keptRef.current = false;
        setValue(typed ?? event.target.value);
      }}
      onKeyDown={handleKeyDown}
    />
  );

  /* DS 라벨은 글만 받아 옆 안내를 붙일 수 없다 — 그때만 라벨을 직접 세우고 id 로 잇는다. */
  if (labelHint === undefined) return field;

  return (
    <div className="field-cell oqc-inspection-serial-scan">
      <FieldLabel htmlFor={inputId} label={label} hint={labelHint} />
      {field}
    </div>
  );
};
