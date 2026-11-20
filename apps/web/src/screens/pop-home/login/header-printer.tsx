import { messages } from '@omf-mes/i18n';
import { useMemo, useState } from 'react';

import { useTerminalPrinterName } from '../../../patterns/pop-printer-choice';
import { PrinterChip } from '../../pop-material-lot-label/printer-chip';
import { choosePrinter, storedPrinterName } from '../../pop-material-lot-label/printer-choice';
import { useShellSelectsPrinter } from '../../pop-material-lot-label/queries';
import { toPrinterView } from '../../pop-material-lot-label/types';
import { LOT_PRINTER_STORAGE_KEY, usePrinters } from '../../production-result/flow-queries';

const t = messages.productionResult.flow.work;

/**
 * 맨 위 줄의 프린터 연결 정보(omf-all-around#288) — 생산 작업 머리줄과 **같은 프린터·같은 표시**다.
 *
 * ⭐ 누르면 고른다(사용자 지시 2026-11-19). 고른 프린터는 이 단말에 기억되고(`pop-printer-choice`) 모든 발행
 *    화면이 따른다. 목록은 종전대로 생산 LOT 라벨 프린터다.
 */
export const HeaderPrinter = () => {
  /* 고른 프린터가 바뀌면 다시 그린다 — 고르는 값은 `choosePrinter` 가 읽는다. */
  useTerminalPrinterName();
  const printers = usePrinters('PRODUCTION_LOT_LABEL');
  const isSelectable = useShellSelectsPrinter().data === true;
  /* 생산 작업과 같이 화면을 열 때 한 번만 읽는다. */
  const [rememberedPrinter] = useState(() => storedPrinterName(LOT_PRINTER_STORAGE_KEY));
  const views = useMemo(
    () => (printers.data === undefined ? undefined : printers.data.map(toPrinterView)),
    [printers.data],
  );
  const choice = choosePrinter(views ?? [], null, isSelectable ? rememberedPrinter : null);

  return (
    <PrinterChip
      printers={views}
      selected={choice.printer}
      isLoading={printers.isPending}
      isError={printers.isError}
      isLocked={false}
      onRetry={() => {
        void printers.refetch();
      }}
      onSelect={() => undefined}
      noneLabel={t.printerNone}
      showNone
      unknownLabel={t.printerUnknown}
      retryLabel={messages.common.retry}
    />
  );
};
