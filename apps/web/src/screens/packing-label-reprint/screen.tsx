import { AlertBanner, Card, Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import { usePopIdentity } from '../../patterns/pop-identity';
import { useReprintEntry } from './entry-context';
import { HandlingUnitPane } from './handling-unit-pane';
import { useContentRows, useHandlingUnit, usePrinters } from './queries';
import { useTerminalGate } from './terminal-gating';
import type { Printer } from './types';

const t = messages.packingLabelReprint;

/** 프린터 상태별 칩 색. 문구는 서버가 준 것을 쓴다 — 화면이 `status` 로 말을 조립하지 않는다. */
const printerTone = (status: Printer['status']) => {
  switch (status) {
    case 'READY':
      return 'success' as const;
    case 'BUSY':
      return 'info' as const;
    case 'OFFLINE':
    case 'ERROR':
      return 'error' as const;
  }
};

/** 화면 머리에 세울 프린터 한 대. 기본 프린터가 있으면 그것, 없으면 첫 번째다. */
const headlinePrinter = (printers: readonly Printer[] | undefined): Printer | null => {
  if (printers === undefined || printers.length === 0) return null;

  return printers.find((printer) => printer.isDefault) ?? printers[0] ?? null;
};

/**
 * 프린터 칩에 적을 말. **이름표를 사유 앞에 붙이지 않는다** — 사유 문구가 이미 「프린터를 …」로
 * 시작해, 앞에 이름표를 덧대면 말이 겹친다(전례 `P-02-05` 실측).
 */
const printerChipText = (printer: Printer | null, failed: boolean): string => {
  if (printer !== null) return `${t.device.printerLabel} ${printer.displayName}`;

  return failed ? t.device.printerUnknown : t.device.printerNone;
};

/**
 * P-02-09 포장 라벨·인식표 재출력·부착.
 *
 * ⚠ **지금은 좌단 《포장 단위》까지다.** 우단 《재출력 대상》과 재출력 실행은 아직 없다 —
 * 「LOT 라벨」의 대상 축이 스펙(§5-2·§5-3 · LOT 마다 1장)과 요구서(§3-8 · `PACKING_LABEL` 의
 * 대상 유형은 포장)에서 갈려, 대상 목록·요약 조회 축·발행 본문이 그 답에 통째로 걸린다.
 * 추측으로 세우면 답이 온 뒤 두 슬라이스를 다시 만든다.
 */
export const PackingLabelReprintScreen = () => {
  const titleId = useId();
  const entry = useReprintEntry();
  const identity = usePopIdentity();
  const gate = useTerminalGate(identity.terminalId, identity.processId);

  const handlingUnit = useHandlingUnit(entry.handlingUnitId);
  const contents = useContentRows(handlingUnit.data?.contents ?? []);
  const printers = usePrinters();

  const blockedReason = ((): string | null => {
    if (entry.handlingUnitId === null) return t.entry.missingHandlingUnit;
    if (entry.workerNo === null) return t.entry.missingWorker;
    if (gate.verdict !== 'allowed') return t.gate[gate.verdict];

    return null;
  })();

  const printer = headlinePrinter(printers.data);

  return (
    <main className="pop-shell" aria-labelledby={titleId}>
      <header className="pop-header">
        <h1 id={titleId} className="pop-title">
          {t.title}
        </h1>
        <div className="pop-context-right">
          <Chip status={printer === null ? 'warning' : printerTone(printer.status)}>
            {printerChipText(printer, printers.isError)}
          </Chip>
          <Chip status={identity.terminalId === null ? 'warning' : 'info'}>
            {`${t.device.terminalLabel} ${identity.terminalId === null ? t.device.terminalUnknown : String(identity.terminalId)}`}
          </Chip>
        </div>
      </header>

      {blockedReason !== null && (
        <div className="banner-slot">
          <AlertBanner variant="warning" title={blockedReason} />
        </div>
      )}

      {handlingUnit.isError && (
        <div className="banner-slot">
          <AlertBanner variant="error" title={t.handlingUnit.loadFailed}>
            {messages.httpError.description}
          </AlertBanner>
        </div>
      )}

      <div className="pop-panes">
        <Card bordered className="pop-section" aria-label={t.handlingUnit.sectionLabel}>
          <h2 className="pane-title">{t.handlingUnit.sectionLabel}</h2>
          {handlingUnit.data === undefined ? null : (
            <HandlingUnitPane
              handlingUnit={handlingUnit.data.handlingUnit}
              rows={contents.rows}
              namesFailed={contents.isNameError}
            />
          )}
        </Card>
      </div>
    </main>
  );
};
