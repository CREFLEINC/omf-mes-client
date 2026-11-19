import { Button, Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import { chooseTerminalPrinter } from '../../patterns/pop-printer-choice';
import { PopPrinterPicker } from '../../patterns/pop-printer-picker';
import { PuIcon } from '../../patterns/pop-uniform';
import { isServerBaselineBuild } from '../../patterns/pop-server-baseline';
import { popTouchClass } from '../../patterns/pop-touch';
import type { PrinterStatus, PrinterView } from './types';

const t = messages.popMaterialLotLabel.printer;
const pickerText = messages.popChrome.printerPicker;

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
  /**
   * @deprecated 쓰지 않는다 — 창은 셸과 상관없이 늘 열린다(사용자 지시 2026-11-19). 고른 프린터를 셸 인쇄에
   * 싣는지는 화면이 따로 정한다(`shellSelectsPrinter`). 부르는 쪽이 아직 넘겨 남겨 둔다.
   */
  isSelectable?: boolean;
  /** 발행 중에는 바꾸지 못한다. */
  isLocked: boolean;
  onRetry: () => void;
  onSelect: (printerName: string) => void;
  /** 머리줄 칩 문구를 화면이 바꿀 때만 넘긴다(생산 작업 · 개선 명세 ② 11). 넘기지 않으면 종전 문구다. */
  noneLabel?: string;
  unknownLabel?: string;
  retryLabel?: string;
  /**
   * 「프린터 없음」 칩을 보일까. 공통 메뉴 맨 위 줄(`HeaderPrinter`)만 켠다 — 화면마다 다시 세우지 않는다
   * (사용자 지시 2026-11-17 · #291). 넘기지 않으면 없을 때 아무것도 그리지 않는다.
   */
  showNone?: boolean;
}

/**
 * 맨 위 줄의 프린터 — **지금 나갈 프린터와 상태를 늘 보이고, 누르면 바꾼다**(개편안 2026-10-24).
 *
 * ⭐ 누르면 「프린터 선택」 창(`PopPrinterPicker`)이 뜬다 — 한 대뿐이어도, 없어도(빈 안내) 열린다(사용자 지시
 *    2026-11-19). 고른 프린터는 이 단말에 기억되고(`pop-printer-choice`) 이 단말의 모든 발행이 따른다.
 * ⛔ 「없다」와 「모른다」를 같은 모양으로 그리지 않는다(공유계약 G-9). 조회 중에는 아무것도 단정하지 않는다.
 */
export const PrinterChip = ({
  printers,
  selected,
  isLoading,
  isError,
  isLocked,
  onRetry,
  onSelect,
  noneLabel = t.none,
  unknownLabel = t.unknown,
  retryLabel = t.retry,
  showNone = false,
}: PrinterChipProps) => {
  const [isOpen, setIsOpen] = useState(false);

  if (isError) {
    return (
      <div className="pop-mlot-printer">
        <Chip status="error">{unknownLabel}</Chip>
        <Button className={popTouchClass('normal')} variant="outlined" size="xl" onClick={onRetry}>
          {retryLabel}
        </Button>
      </div>
    );
  }

  if (isLoading || printers === undefined) return null;
  if (selected === null && !showNone) return null;

  /*
   * ⭐ 맨 위 줄 사번 칩(「👥 이름 (사번) | 전환」)과 같은 단추·같은 클래스(`pop-logout`)다 — 「🖨 이름 | 변경」
   *    (사용자 지시 2026-11-19). 칩 자체는 초록이 아니고, 상태 색은 이름 앞 작은 점으로만 보인다.
   */
  return (
    <>
      <Button
        className="pop-logout"
        variant="outlined"
        size="md"
        aria-haspopup="dialog"
        aria-label={selected === null ? t.choose : `${t.choose}: ${selected.displayName}`}
        title={selected === null ? noneLabel : `${t.label} ${selected.displayName}`}
        disabled={isLocked}
        onClick={() => {
          setIsOpen(true);
        }}
      >
        <PuIcon name="print" className="pop-nav-icon" />
        <span
          className="prn-chip__dot"
          data-status={selected === null ? 'warning' : chipStatusOf(selected.status)}
          aria-hidden="true"
        >
          ●
        </span>
        {selected === null ? noneLabel : selected.displayName}
        <span className="pop-nav-top__switch" aria-hidden>
          {pickerText.change}
        </span>
      </Button>
      {isOpen ? (
        <PopPrinterPicker
          printers={printers}
          selectedName={selected?.printerName ?? null}
          onClose={() => {
            setIsOpen(false);
          }}
          onSelect={(name) => {
            chooseTerminalPrinter(name);
            onSelect(name);
            setIsOpen(false);
          }}
        />
      ) : null}
    </>
  );
};
