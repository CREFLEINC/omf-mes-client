import { Button, Table, type Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import { useSerialLookup } from './queries';
import { SerialScanField } from './serial-scan-field';
import {
  checkScannedSerial,
  isNgLocked,
  toSerialRow,
  type SerialJudgment,
  type SerialRow,
} from './serials';

const t = messages.oqcInspection.serials;

export interface SerialJudgmentsProps {
  inspectionRequestId: number;
  itemId: number;
  rows: SerialRow[];
  onChange: (rows: SerialRow[]) => void;
  /** 서버가 `serials` 칸을 짚어 준 오류. */
  serverError?: string;
  disabled: boolean;
}

/**
 * 「검사한 시리얼」 — 판정 입력 구획 안에서 시리얼을 스캔하고 OK/NG 를 고른다(omf-all-around#68).
 * 비워 두면 지금처럼 LOT 판정만 저장된다.
 */
export const SerialJudgments = ({
  inspectionRequestId,
  itemId,
  rows,
  onChange,
  serverError,
  disabled,
}: SerialJudgmentsProps) => {
  const lookup = useSerialLookup();
  const [scanError, setScanError] = useState<string | null>(null);

  const scan = async (serialNo: string): Promise<void> => {
    const found = await lookup(serialNo);
    if (found.kind === 'notFound') return setScanError(t.notFound(serialNo));
    if (found.kind === 'failed') return setScanError(t.lookupFailed);
    const blocked = checkScannedSerial(found.scan, { inspectionRequestId, itemId, rows });
    setScanError(blocked);
    if (blocked === null) onChange([...rows, toSerialRow(found.scan)]);
  };

  const setJudgment = (serialNumberId: number, judgment: SerialJudgment): void =>
    onChange(
      rows.map((row) => (row.serialNumberId === serialNumberId ? { ...row, judgment } : row)),
    );

  const columns: Column<SerialRow>[] = [
    { key: 'serialNo', header: t.columns.serialNo },
    { key: 'lotNo', header: t.columns.lotNo },
    {
      key: 'previous',
      header: t.columns.previous,
      render: (row) =>
        row.previous === undefined
          ? ''
          : t.previous(row.previous.firstJudgmentCode, row.previous.finalJudgmentCode),
    },
    {
      key: 'judgment',
      header: t.columns.judgment,
      width: '200px',
      render: (row) => (
        <span className="form-actions">
          {(['OK', 'NG'] as const).map((code) => (
            <Button
              key={code}
              type="button"
              size="sm"
              variant={row.judgment === code ? 'filled' : 'outlined'}
              aria-pressed={row.judgment === code}
              disabled={disabled || (code === 'NG' && isNgLocked(row))}
              title={code === 'NG' && isNgLocked(row) ? t.firstOkLocked : undefined}
              onClick={() => setJudgment(row.serialNumberId, code)}
            >
              {code === 'OK' ? t.ok : t.ng}
            </Button>
          ))}
          <Button
            type="button"
            size="sm"
            variant="text"
            disabled={disabled}
            onClick={() =>
              onChange(rows.filter((other) => other.serialNumberId !== row.serialNumberId))
            }
          >
            {t.remove}
          </Button>
        </span>
      ),
    },
  ];

  return (
    <section aria-label={t.heading}>
      <h3>{t.heading}</h3>
      <p className="field-note">{t.help}</p>
      <SerialScanField
        label={t.scanLabel}
        error={scanError ?? serverError ?? null}
        disabled={disabled}
        onScan={scan}
      />
      <Table
        caption={t.count(rows.length, rows.filter((row) => row.judgment === 'NG').length)}
        density="compact"
        columns={columns}
        rows={rows}
        getRowId={(row) => String(row.serialNumberId)}
        empty={<p className="field-note">{t.empty}</p>}
      />
    </section>
  );
};
