import { messages } from '@omf-mes/i18n';
import { useMemo, useState } from 'react';

import { PrinterChip } from '../pop-material-lot-label/printer-chip';
import { choosePrinter, storedPrinterName } from '../pop-material-lot-label/printer-choice';
import { useShellSelectsPrinter } from '../pop-material-lot-label/queries';
import { toPrinterView } from '../pop-material-lot-label/types';
import { LOT_PRINTER_STORAGE_KEY, usePrinters } from '../production-result/flow-queries';

const t = messages.productionResult.flow.work;

/**
 * 머리줄의 프린터 연결 정보(omf-all-around#288) — 생산 작업 머리줄과 **같은 프린터·같은 표시**다.
 *
 * ⭐ 생산 작업이 LOT 라벨을 낼 프린터(이 단말에 기억한 것 → 기본 순)를 그대로 보인다. 여기서는
 *    고르지 않는다 — 고르는 곳은 생산 작업 머리줄 하나다.
 */
export const HeaderPrinter = () => {
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
      isSelectable={false}
      isLocked
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
