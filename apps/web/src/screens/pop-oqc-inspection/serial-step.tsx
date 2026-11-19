import { messages } from '@omf-mes/i18n';
import { useRef, useState } from 'react';

import {
  PuButton,
  PuDialog,
  PuEmpty,
  PuPager,
  PuRemoveButton,
  PuScanField,
  pageOf,
  puCx,
} from '../../patterns/pop-uniform';
import { useSerialLookup } from '../oqc-inspection/queries';
import {
  checkScannedSerial,
  isNgLocked,
  toSerialRow,
  type SerialJudgment,
  type SerialRow,
} from '../oqc-inspection/serials';

const shared = messages.oqcInspection.serials;
const t = messages.popOqcInspection.serial;
const dialog = messages.popUniform.dialog;

/** 창 안 한 쪽 줄 수 — 창 높이가 정해져 있어 고정(시안과 같다). */
const SERIAL_PAGE_SIZE = 3;

const ngCount = (rows: readonly SerialRow[]): number =>
  rows.filter((row) => row.judgment === 'NG').length;

/** 2단계의 「검사 기기 n대 · NG n대」 줄 + [시리얼 검사 기록]. */
export const PopSerialSummary = ({
  rows,
  disabled,
  onOpen,
}: {
  rows: readonly SerialRow[];
  disabled: boolean;
  onOpen: () => void;
}) => (
  <div className="oqc-sersum">
    <span className="t">
      {t.summary(rows.length, ngCount(rows))}
      <small>{t.summaryHint}</small>
    </span>
    <PuButton disabled={disabled} onClick={onOpen}>
      {t.open}
    </PuButton>
  </div>
);

export interface PopSerialDialogProps {
  inspectionRequestId: number;
  itemId: number;
  rows: SerialRow[];
  onChange: (rows: SerialRow[]) => void;
  /** 서버가 `serials` 칸을 짚어 준 오류. */
  serverError?: string;
  disabled: boolean;
  onClose: () => void;
}

/**
 * P-04-06 [시리얼 검사 기록] 창(omf-all-around#68 · #295) — 스캐너로 시리얼을 찍고 OK/NG 를 누른다.
 * 규칙은 W-04-03 과 같다(`oqc-inspection/serials.ts`). 비워 두면 LOT 판정만 저장된다.
 * [확인]으로 닫아도 기록은 남고 판정과 함께 저장된다. [취소]는 창을 연 뒤 바꾼 것만 되돌린다.
 * ⛔ 스캐너의 Enter 는 `useScannerSubmit`(PuScanField)이 막는다 — 판정 폼이 제출되지 않는다.
 */
export const PopSerialDialog = ({
  inspectionRequestId,
  itemId,
  rows,
  onChange,
  serverError,
  disabled,
  onClose,
}: PopSerialDialogProps) => {
  const lookup = useSerialLookup();
  const inputRef = useRef<HTMLInputElement>(null);
  const [kept] = useState(rows);
  const [value, setValue] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [lastOk, setLastOk] = useState(false);
  const [page, setPage] = useState(() => Math.max(1, Math.ceil(rows.length / SERIAL_PAGE_SIZE)));

  const send = (raw: string): void => {
    const serialNo = raw.trim();
    if (serialNo === '' || isScanning) return;
    setValue('');
    setIsScanning(true);
    void lookup(serialNo)
      .then((found) => {
        setLastOk(false);
        if (found.kind === 'notFound') return setScanError(shared.notFound(serialNo));
        if (found.kind === 'failed') return setScanError(shared.lookupFailed);
        const blocked = checkScannedSerial(found.scan, { inspectionRequestId, itemId, rows });
        setScanError(blocked);
        if (blocked === null) {
          const next = [...rows, toSerialRow(found.scan)];
          onChange(next);
          setLastOk(true);
          setPage(Math.ceil(next.length / SERIAL_PAGE_SIZE));
        }
      })
      .finally(() => {
        setIsScanning(false);
        inputRef.current?.focus();
      });
  };

  const setJudgment = (serialNumberId: number, judgment: SerialJudgment): void => {
    onChange(
      rows.map((row) => (row.serialNumberId === serialNumberId ? { ...row, judgment } : row)),
    );
  };

  const shown = pageOf(rows, page, SERIAL_PAGE_SIZE);

  return (
    <PuDialog
      title={t.open}
      wide
      onClose={() => {
        onChange(kept);
        onClose();
      }}
      footer={
        <>
          <PuButton
            onClick={() => {
              onChange(kept);
              onClose();
            }}
          >
            {dialog.cancel}
          </PuButton>
          <PuButton variant="primary" onClick={onClose}>
            {dialog.confirm}
          </PuButton>
        </>
      }
    >
      <div className="oqc-ser">
        <PuScanField
          label={
            <>
              {t.label}
              <span className="oqc-ser-count">{t.count(rows.length, ngCount(rows))}</span>
            </>
          }
          ariaLabel={shared.scanLabel}
          value={value}
          onChange={(next) => {
            setValue(next);
            setLastOk(false);
          }}
          onSubmit={send}
          done={lastOk}
          error={isScanning ? null : (scanError ?? serverError ?? null)}
          manual={{ label: t.manualLabel }}
          disabled={disabled}
          inputRef={inputRef}
          autoFocus
        />
        <div className="oqc-ser-list">
          {rows.length === 0 ? (
            <PuEmpty icon="scan" title={t.emptyTitle} hint={t.emptyHint} />
          ) : (
            shown.items.map((row) => (
              <div key={row.serialNumberId} className="oqc-serial">
                <div className="n">
                  <b>{row.serialNo}</b>
                  <span>
                    {row.lotNo}
                    {row.previous !== undefined &&
                      ` · ${shared.previous(row.previous.firstJudgmentCode, row.previous.finalJudgmentCode)}`}
                  </span>
                </div>
                <span className="pu-judge-pair" role="group" aria-label={shared.columns.judgment}>
                  {(['OK', 'NG'] as const).map((code) => (
                    <button
                      key={code}
                      type="button"
                      className={puCx(
                        'pu-judge',
                        code === 'OK' ? 'j-ok' : 'j-ng',
                        row.judgment === code && 'is-on',
                      )}
                      aria-pressed={row.judgment === code}
                      disabled={disabled || (code === 'NG' && isNgLocked(row))}
                      title={code === 'NG' && isNgLocked(row) ? shared.firstOkLocked : undefined}
                      onClick={() => {
                        setJudgment(row.serialNumberId, code);
                      }}
                    >
                      {code === 'OK' ? shared.ok : shared.ng}
                    </button>
                  ))}
                </span>
                <PuRemoveButton
                  label={t.remove(row.serialNo)}
                  disabled={disabled}
                  onClick={() => {
                    onChange(rows.filter((other) => other.serialNumberId !== row.serialNumberId));
                  }}
                />
              </div>
            ))
          )}
        </div>
        <PuPager
          total={shown.total}
          page={shown.page}
          pages={shown.pages}
          label={t.pageNav}
          onPage={setPage}
        />
      </div>
    </PuDialog>
  );
};
