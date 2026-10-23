import { Button, EmptyState, Icon, Table, type Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, useState } from 'react';

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
const j = t.judge;

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
  /* 1차 OK 로 잠긴 NG 버튼의 사유 — 그 줄의 「이전 기록」 칸(C-4). */
  const idPrefix = useId();
  const previousIdOf = (serialNumberId: number): string =>
    `${idPrefix}-previous-${String(serialNumberId)}`;
  const [scanError, setScanError] = useState<string | null>(null);

  /** `false` 면 찾지 못했다 — 칸이 친 번호를 남긴다(목록 위 스캔 칸과 같은 동작 · #136). */
  const scan = async (serialNo: string): Promise<boolean> => {
    const found = await lookup(serialNo);
    if (found.kind === 'notFound') {
      setScanError(j.notFound);
      return false;
    }
    if (found.kind === 'failed') {
      setScanError(t.lookupFailed);
      return true;
    }
    const blocked = checkScannedSerial(found.scan, { inspectionRequestId, itemId, rows });
    setScanError(blocked);
    if (blocked === null) onChange([...rows, toSerialRow(found.scan)]);
    return true;
  };

  const okCount = rows.filter((row) => row.judgment === 'OK').length;
  const ngCount = rows.filter((row) => row.judgment === 'NG').length;

  const setJudgment = (serialNumberId: number, judgment: SerialJudgment): void =>
    onChange(
      rows.map((row) => (row.serialNumberId === serialNumberId ? { ...row, judgment } : row)),
    );

  const columns: Column<SerialRow>[] = [
    { key: 'serialNo', header: j.columns.serialNo, width: '168px' },
    { key: 'lotNo', header: j.columns.lotNo },
    {
      key: 'previous',
      header: j.columns.previous,
      render: (row) =>
        row.previous === undefined ? (
          ''
        ) : (
          <span id={previousIdOf(row.serialNumberId)}>
            {t.previous(row.previous.firstJudgmentCode, row.previous.finalJudgmentCode)}
          </span>
        ),
    },
    {
      key: 'judgment',
      header: j.columns.judgment,
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
              aria-describedby={
                code === 'NG' && isNgLocked(row) ? previousIdOf(row.serialNumberId) : undefined
              }
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
    <section className="oqc-inspection-serial-box" aria-label={j.heading}>
      {/* 제목 줄 — 검사·합격·불합격 건수를 칩으로(판정 확정 안내와 같은 모양 · #136). */}
      <div className="oqc-inspection-serial-box-head">
        <div className="oqc-inspection-serial-box-title">
          <h3>{j.heading}</h3>
        </div>
        <span className="oqc-inspection-guide-chips">
          <span>{j.inspected(rows.length)}</span>
          <span data-tone="accepted">{j.accepted(okCount)}</span>
          <span data-tone="rejected">{j.rejected(ngCount)}</span>
        </span>
      </div>
      {/* 목록 위 「시리얼 번호 스캔」과 같은 칸(#136). */}
      <SerialScanField
        label={j.scanLabel}
        labelHint={j.scanHint}
        placeholder={j.scanPlaceholder}
        error={scanError ?? serverError ?? null}
        disabled={disabled}
        onScan={scan}
      />
      <div className="oqc-inspection-serial-box-table">
        <Table
          caption={<span className="oqc-inspection-visually-hidden">{j.heading}</span>}
          density="compact"
          columns={columns}
          rows={rows}
          getRowId={(row) => String(row.serialNumberId)}
          empty={
            <EmptyState
              size="sm"
              icon={<Icon name="qr_code_scanner" size={32} />}
              title={j.emptyTitle}
              description={j.emptyDescription}
            />
          }
        />
      </div>
    </section>
  );
};
