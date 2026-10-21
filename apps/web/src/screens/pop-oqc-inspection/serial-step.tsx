import { Button, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useRef, useState } from 'react';

import { useScannerSubmit } from '../../patterns/pop-scanner-submit';
import { useSerialLookup } from '../oqc-inspection/queries';
import {
  checkScannedSerial,
  isNgLocked,
  toSerialRow,
  type SerialJudgment,
  type SerialRow,
} from '../oqc-inspection/serials';

const t = messages.oqcInspection.serials;

export interface PopSerialStepProps {
  inspectionRequestId: number;
  itemId: number;
  rows: SerialRow[];
  onChange: (rows: SerialRow[]) => void;
  /** 서버가 `serials` 칸을 짚어 준 오류. */
  serverError?: string;
  disabled: boolean;
}

/**
 * P-04-06 「검사한 시리얼」(omf-all-around#68) — 스캐너로 시리얼을 찍고 OK/NG 를 누른다.
 * 규칙은 W-04-03 과 같다(`oqc-inspection/serials.ts`). 비워 두면 LOT 판정만 저장된다.
 * ⛔ 판정 폼 안이라 `<form>` 을 겹치지 않는다 — 스캐너의 Enter 는 `useScannerSubmit` 이 막는다.
 */
export const PopSerialStep = ({
  inspectionRequestId,
  itemId,
  rows,
  onChange,
  serverError,
  disabled,
}: PopSerialStepProps) => {
  const lookup = useSerialLookup();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  const send = (raw: string): void => {
    const serialNo = raw.trim();
    if (serialNo === '' || isScanning) return;
    setValue('');
    setIsScanning(true);
    void lookup(serialNo)
      .then((found) => {
        if (found.kind === 'notFound') return setScanError(t.notFound(serialNo));
        if (found.kind === 'failed') return setScanError(t.lookupFailed);
        const blocked = checkScannedSerial(found.scan, { inspectionRequestId, itemId, rows });
        setScanError(blocked);
        if (blocked === null) onChange([...rows, toSerialRow(found.scan)]);
      })
      .finally(() => {
        setIsScanning(false);
        inputRef.current?.focus();
      });
  };

  const scanner = useScannerSubmit(send, () => inputRef.current?.value ?? '');

  const setJudgment = (serialNumberId: number, judgment: SerialJudgment): void =>
    onChange(
      rows.map((row) => (row.serialNumberId === serialNumberId ? { ...row, judgment } : row)),
    );

  return (
    <section className="pop-oqc-step" aria-label={t.heading}>
      <p className="pop-oqc-step__title">
        <span className="pop-oqc-step__no" aria-hidden>
          3
        </span>
        <span>{t.heading}</span>
        <span className="pop-oqc-step__hint">
          {t.count(rows.length, rows.filter((row) => row.judgment === 'NG').length)}
        </span>
      </p>
      <TextField
        size="xl"
        ref={inputRef}
        label={t.scanLabel}
        placeholder={t.scanPlaceholder}
        value={value}
        fullWidth
        autoComplete="off"
        disabled={disabled}
        helperText={isScanning ? t.scanning : t.help}
        error={scanError ?? serverError ?? undefined}
        onKeyDown={scanner.onKeyDown}
        onChange={(event) => {
          setValue(event.target.value);
          scanner.noteInput(event.target.value);
        }}
      />
      {rows.length === 0 ? (
        <p className="field-note">{t.empty}</p>
      ) : (
        <ul className="pop-oqc-serials" aria-label={t.heading}>
          {rows.map((row) => (
            <li key={row.serialNumberId} className="pop-oqc-serial">
              <span className="pop-oqc-serial__no">
                <strong>{row.serialNo}</strong>
                <span className="field-note">
                  {row.lotNo}
                  {row.previous === undefined
                    ? ''
                    : ` · ${t.previous(row.previous.firstJudgmentCode, row.previous.finalJudgmentCode)}`}
                </span>
              </span>
              <span role="group" aria-label={t.columns.judgment} className="pop-oqc-judge-row">
                {(['OK', 'NG'] as const).map((code) => (
                  <button
                    key={code}
                    type="button"
                    className={`pop-oqc-judge ${code === 'OK' ? 'pop-oqc-judge--accepted' : 'pop-oqc-judge--rejected'}`}
                    aria-pressed={row.judgment === code}
                    disabled={disabled || (code === 'NG' && isNgLocked(row))}
                    title={code === 'NG' && isNgLocked(row) ? t.firstOkLocked : undefined}
                    onClick={() => setJudgment(row.serialNumberId, code)}
                  >
                    {code === 'OK' ? t.ok : t.ng}
                  </button>
                ))}
              </span>
              <Button
                type="button"
                size="xl"
                variant="text"
                disabled={disabled}
                onClick={() =>
                  onChange(rows.filter((other) => other.serialNumberId !== row.serialNumberId))
                }
              >
                {t.remove}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
