import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import { isServerBaselineBuild } from './pop-server-baseline';
import { PuButton, PuChip, PuDialog, PuEmpty, type PuChipTone } from './pop-uniform';
import './pop-printer-picker.css';

const t = messages.popChrome.printerPicker;

type PrinterStatus = keyof typeof t.status;

export interface PickerPrinter {
  printerName: string;
  displayName: string;
  status: string;
  isDefault: boolean;
}

const TONE: Record<PrinterStatus, PuChipTone> = {
  READY: 'ok',
  BUSY: 'warn',
  OFFLINE: 'bad',
  ERROR: 'bad',
};

const isKnownStatus = (status: string): status is PrinterStatus => status in TONE;

/*
 * ⭐ 서버 기준 빌드에서는 「꺼짐」을 경고로 낮춘다 — 셸이 단말 프린터를 대신 답하지 않아 서버 목록의 상태가
 *    실제 프린터와 다를 수 있다(`pop-server-baseline` · 종전 칩과 같은 규칙).
 */
const toneOf = (status: PrinterStatus): PuChipTone =>
  status === 'OFFLINE' && isServerBaselineBuild() ? 'warn' : TONE[status];

/**
 * 프린터 고르는 창 — 맨 위 줄 프린터 칩을 누르면 뜬다(사용자 지시 2026-11-19). 다른 POP 고르기 창과 같은
 * 모양(`PuDialog` · `pu-opt` 줄)이고, 줄을 누르면 표시만 옮기고 [선택]을 눌러야 바뀐다.
 *
 * ⭐ 한 대뿐이어도 창은 열린다(무엇이 골라져 있는지 보인다). 없으면 빈 안내만 서고 [선택]은 꺼진다.
 */
export const PopPrinterPicker = ({
  printers,
  selectedName,
  onSelect,
  onClose,
}: {
  printers: readonly PickerPrinter[];
  selectedName: string | null;
  onSelect: (printerName: string) => void;
  onClose: () => void;
}) => {
  const [pending, setPending] = useState(selectedName);
  const canSelect = pending !== null && printers.some((each) => each.printerName === pending);

  return (
    <PuDialog
      title={t.title}
      onClose={onClose}
      footer={
        <>
          <PuButton onClick={onClose}>{t.cancel}</PuButton>
          <PuButton
            variant="primary"
            disabled={!canSelect}
            onClick={() => {
              if (pending !== null) onSelect(pending);
            }}
          >
            {t.select}
          </PuButton>
        </>
      }
    >
      {printers.length === 0 ? (
        <PuEmpty icon="print" title={t.empty} />
      ) : (
        <div className="pu-list" role="listbox" aria-label={t.title}>
          {printers.map((printer) => (
            <button
              key={printer.printerName}
              type="button"
              role="option"
              className={printer.printerName === pending ? 'pu-opt is-on' : 'pu-opt'}
              aria-selected={printer.printerName === pending}
              onClick={() => {
                setPending(printer.printerName);
              }}
            >
              <span className="prn-pick__name">{printer.displayName}</span>
              <span className="tail prn-pick__tail">
                {printer.isDefault && <PuChip tone="info">{t.defaultMark}</PuChip>}
                {isKnownStatus(printer.status) && (
                  <PuChip tone={toneOf(printer.status)}>{t.status[printer.status]}</PuChip>
                )}
              </span>
            </button>
          ))}
        </div>
      )}
    </PuDialog>
  );
};
