import { Button, Chip, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import { isServerBaselineBuild } from '../../patterns/pop-server-baseline';
import { popTouchClass } from '../../patterns/pop-touch';
import type { PrinterStatus, PrinterView } from './types';

const t = messages.popMaterialLotLabel.printer;

const CHIP_STATUS: Record<PrinterStatus, 'success' | 'warning' | 'error'> = {
  READY: 'success',
  BUSY: 'warning',
  OFFLINE: 'error',
  ERROR: 'error',
};

/*
 * ⭐ 서버 기준 빌드에서는 「꺼짐」을 경고로 낮춘다 — 그 빌드는 셸이 단말 프린터를 대신 답하지 않아 서버
 *    목록의 상태가 실제 프린터와 다를 수 있다(`pop-server-baseline`).
 */
const chipStatusOf = (status: PrinterStatus): 'success' | 'warning' | 'error' =>
  status === 'OFFLINE' && isServerBaselineBuild() ? 'warning' : CHIP_STATUS[status];

export interface PrinterChipProps {
  printers: readonly PrinterView[] | undefined;
  selected: PrinterView | null;
  isLoading: boolean;
  isError: boolean;
  /** 셸이 고른 프린터를 받는가. 아니면 칩을 눌러도 창을 열지 않는다(브라우저 · 옛 설치본). */
  isSelectable: boolean;
  /** 발행 중에는 바꾸지 못한다. */
  isLocked: boolean;
  onRetry: () => void;
  onSelect: (printerName: string) => void;
}

/**
 * 머리줄의 프린터 — **지금 나갈 프린터와 상태를 늘 보이고, 누르면 바꾼다**(개편안 2026-10-24).
 *
 * ⭐ 옛 화면은 오른쪽 구획에 입력칸 모양의 프린터 칸을 두었다 — 글자를 치는 칸처럼 보였고, 바꿀 일이
 *    드문 값이 주 동작 위 좋은 자리를 차지했다. 인쇄가 안 될 때 가장 먼저 보는 머리줄로 옮긴다(스펙 §3).
 * ⛔ 「없다」와 「모른다」를 같은 모양으로 그리지 않는다(공유계약 G-9). 조회 중에는 아무것도 단정하지 않는다.
 */
export const PrinterChip = ({
  printers,
  selected,
  isLoading,
  isError,
  isSelectable,
  isLocked,
  onRetry,
  onSelect,
}: PrinterChipProps) => {
  const [isOpen, setIsOpen] = useState(false);

  if (isError) {
    return (
      <div className="pop-mlot-printer">
        <Chip status="error">{t.unknown}</Chip>
        <Button className={popTouchClass('normal')} variant="outlined" size="xl" onClick={onRetry}>
          {t.retry}
        </Button>
      </div>
    );
  }

  if (isLoading || printers === undefined) return null;
  if (selected === null) return <Chip status="warning">{t.none}</Chip>;

  const chip = (
    <Chip status={chipStatusOf(selected.status)}>{`${t.label} ${selected.displayName}`}</Chip>
  );

  if (!isSelectable || printers.length < 2) return chip;

  return (
    <>
      <button
        type="button"
        className="pop-mlot-printer-button"
        aria-haspopup="dialog"
        aria-label={`${t.choose}: ${selected.displayName}`}
        disabled={isLocked}
        onClick={() => {
          setIsOpen(true);
        }}
      >
        {chip}
      </button>
      {isOpen ? (
        <Dialog
          open
          onClose={() => {
            setIsOpen(false);
          }}
          className="pop-mlot-printer-dialog"
          size="lg"
          /* POP 팝업은 바깥을 눌러 닫히지 않는다(#1005) — 장갑 낀 손이 창 밖을 스치면 사라졌다. */
          closeOnBackdropClick={false}
          title={t.choose}
          footer={
            <Button
              className={popTouchClass('normal')}
              variant="outlined"
              size="xl"
              onClick={() => {
                setIsOpen(false);
              }}
            >
              {t.close}
            </Button>
          }
        >
          <ul className="pop-mlot-printer-list">
            {printers.map((printer) => (
              <li key={printer.printerName}>
                <button
                  type="button"
                  className="pop-mlot-printer-option"
                  aria-pressed={printer.printerName === selected.printerName}
                  onClick={() => {
                    onSelect(printer.printerName);
                    setIsOpen(false);
                  }}
                >
                  <span className="pop-mlot-printer-name">{printer.displayName}</span>
                  {/* 상태 설명은 서버가 준 문장만 보인다 — 코드값(READY 등)을 화면에 내지 않는다(규범 C-13). */}
                  {printer.statusMessage === null ? null : (
                    <Chip status={chipStatusOf(printer.status)}>{printer.statusMessage}</Chip>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </Dialog>
      ) : null}
    </>
  );
};
