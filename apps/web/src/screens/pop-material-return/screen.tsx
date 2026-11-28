import { isForbidden, type ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { formatBaseQty, isCountUom } from '../../patterns/package-qty';
import { usePopIdentity } from '../../patterns/pop-identity';
import { PopTopPrinter } from '../../patterns/pop-top-status';
import {
  PuActionBar,
  PuButton,
  PuChip,
  PuCols,
  PuEmpty,
  PuField,
  PuInput,
  PuKeypad,
  PuNote,
  PuRemoveButton,
  PuScanField,
  PuScreen,
  PuSection,
  applyKeypadKey,
} from '../../patterns/pop-uniform';
import { PopWorkerMissingBanner } from '../../patterns/pop-worker-missing-banner';
import { toApiError } from '../../patterns/request';
import { serverReasonOf } from '../../patterns/server-reason';
import { PrinterChip } from '../pop-material-lot-label/printer-chip';
import {
  choosePrinter,
  rememberPrinterName,
  storedPrinterName,
} from '../pop-material-lot-label/printer-choice';
import { usePrinters, useShellSelectsPrinter } from '../pop-material-lot-label/queries';
import { FindByWorkOrderDialog } from './find-by-wo';
import { ReturnLabelDialog, type LabelOutcome } from './label-dialog';
import {
  addLine,
  canSubmit,
  destinationOf,
  lineIndexOfField,
  lineOf,
  qtyProblemOf,
  removeLine,
  totalsOf,
  type ReturnLine,
} from './lines';
import { useReceiveMaterialReturn } from './mutations';
import { drainMaterialReturns, pendingMaterialReturnCount } from './outbox';
import { useReturnLookup, useTerminalWarehouse } from './queries';
import './uniform.css';

/* 부를 때 읽는다 — 단말 언어(`setLocale`)를 모듈이 실릴 때 붙잡지 않는다. */
const words = () => messages.materialReturn;

interface Notice {
  tone: 'ok' | 'warn' | 'bad';
  text: string;
}

/** 조회 실패 문구 — 400(반납 대상 아님 · 남은 양 없음)은 서버 문구 그대로, 없는 LOT 은 404, 나머지는 연결. */
const lookupErrorOf = (error: ApiError, lotNo: string): string => {
  const t = words().pop;
  if (isForbidden(error)) return t.forbidden;
  const reason = serverReasonOf(error);
  if (reason !== null) return reason;
  if (error.kind !== 'network' && error.status === 404) return t.notFound(lotNo);

  return t.lookupFailed;
};

/** 보내기 거절의 첫 줄 차례 — 그 줄을 골라 보인다. */
const rejectedLineOf = (error: ApiError): number | null =>
  error.kind === 'validation' || error.kind === 'stateLocked'
    ? (error.errors.map((item) => lineIndexOfField(item.field)).find((index) => index !== null) ??
      null)
    : null;

/**
 * `P-01-03` 반납 입고 (POP · 피처 019 · omf-all-around#367 · 시안 ②·③ 확정 2026-11-27).
 *
 * ```
 * ┌───────────────────────────────────────────────────────────┐ ┌ 반납 수량 * ┐
 * │ [스캔 칸 ──────── ● 스캔 대기][직접 입력][라벨이 없어요 · W/O 로 찾기] │ │ [   20 ] EA │
 * │ 받는 곳: 그 LOT 을 출고한 생산창고의 적치 대기 (이 창고 G)              │ │ 반납 가능 n │
 * │ No │ 품목 │ LOT 번호(+W/O 로 찾음) │ 반납 가능 │ 반납 수량 │ 받는 곳 │ × │ │ [키패드]    │
 * │ n줄 · 합 …                                                │ │             │
 * ├ 작업 줄: [목록 비우기]                          [반납 입고 (n건)] ─────────────┤
 * ```
 *
 * ⭐ 사람이 주는 것은 LOT 과 수량뿐이다(FR-001). 귀속 W/O 는 어디에도 그리지 않는다(FR-013) — 「W/O 로 찾기」로
 *    담은 줄에만 「W/O 로 찾음」 칩이 붙는다.
 * ⭐ 수량 처음 값은 빈칸, 여러 줄을 한 건으로 보낸다(시안 확정). 오류는 서버 문구 그대로 스캔 칸 아래 빨간 줄.
 * ⭐ 「반납 가능」(`can_return_material`)이 꺼진 단말은 이 탭이 없다 — 서버 화면 정책이 거른다(`pop-access`).
 */
export const PopMaterialReturnScreen = () => {
  const t = words().pop;
  const { client } = useApiClient();
  const { workerNo, terminalId, plantId = null } = usePopIdentity();

  const printers = usePrinters();
  const printerSelectable = useShellSelectsPrinter();
  const isPrinterSelectable = printerSelectable.data === true;
  const [pickedPrinter, setPickedPrinter] = useState<string | null>(null);
  const [rememberedPrinter] = useState(storedPrinterName);
  const headPrinter = choosePrinter(
    printers.data ?? [],
    pickedPrinter,
    isPrinterSelectable ? rememberedPrinter : null,
  ).printer;

  const terminal = useTerminalWarehouse(terminalId);
  const terminalWarehouseId = terminal.data?.warehouseId ?? null;
  const terminalWarehouseName = terminal.data?.warehouseName ?? null;

  const lookup = useReturnLookup();
  const receive = useReceiveMaterialReturn();

  const [scanText, setScanText] = useState('');
  const scanRef = useRef<HTMLInputElement>(null);
  const [lines, setLines] = useState<ReturnLine[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [isFindOpen, setFindOpen] = useState(false);
  const [labelLotIds, setLabelLotIds] = useState<number[] | null>(null);
  const [pendingCount, setPendingCount] = useState(pendingMaterialReturnCount);

  const isBusy = lookup.isPending || receive.isPending;
  const current = selected === null ? null : (lines[selected] ?? null);
  const currentProblem = current === null ? null : qtyProblemOf(current);
  const isSubmittable = canSubmit(lines) && workerNo !== null && !isBusy;

  /* 조회 · 보내기가 끝나 칸이 다시 켜지면 스캔 칸을 잡는다 — 실기 스캐너의 다음 스캔이 버려지지 않게(P-04-08 F1). */
  const isDialogOpen = isFindOpen || labelLotIds !== null;
  useEffect(() => {
    if (!isBusy && !isDialogOpen) scanRef.current?.focus();
  }, [isBusy, isDialogOpen]);

  /* 대기열 — 화면에 들어올 때와 연결이 돌아올 때 보낸다(다른 POP 화면과 같다). */
  const drain = useCallback(() => {
    if (pendingMaterialReturnCount() === 0) return;
    void drainMaterialReturns(client)
      .then((result) => {
        setPendingCount(pendingMaterialReturnCount());
        if (result.lastRejection !== null) {
          const reason = serverReasonOf(result.lastRejection);
          setNotice({
            tone: 'bad',
            text: reason === null ? words().pop.rejectedNoReason : words().pop.rejected(reason),
          });
        }
      })
      .catch(() => {
        setPendingCount(pendingMaterialReturnCount());
      });
  }, [client]);

  useEffect(() => {
    if (globalThis.navigator.onLine) drain();
    globalThis.addEventListener('online', drain);
    return () => {
      globalThis.removeEventListener('online', drain);
    };
  }, [drain]);

  const putLine = (line: ReturnLine): void => {
    const next = addLine(lines, line);
    setLines(next.lines);
    setSelected(next.selected);
  };

  const submitScan = (value: string): void => {
    const lotNo = value.trim();
    if (lotNo === '' || isBusy) return;

    setScanText('');
    setError(null);
    setNotice(null);
    lookup.mutate(lotNo, {
      onSuccess: (found) => {
        putLine(lineOf(found));
      },
      onError: (cause) => {
        setError(lookupErrorOf(toApiError(cause), lotNo));
      },
    });
  };

  const changeQty = (text: string): void => {
    if (selected === null) return;
    setLines((all) => all.map((line, at) => (at === selected ? { ...line, qtyText: text } : line)));
    setError(null);
  };

  const clearAll = (): void => {
    setLines([]);
    setSelected(null);
    setError(null);
  };

  const submit = (): void => {
    if (!isSubmittable || workerNo === null) return;

    setError(null);
    setNotice(null);
    const sent = lines;
    receive.mutate(
      { lines: sent, workerNo },
      {
        onSuccess: (outcome) => {
          clearAll();
          setScanText('');
          if (outcome.kind === 'queued') {
            setPendingCount(pendingMaterialReturnCount());
            setNotice({ tone: 'warn', text: t.queued });
            return;
          }
          const resultLines = outcome.result.lines ?? [];
          setNotice({ tone: 'ok', text: t.done(resultLines.length || sent.length) });
          const unprinted = resultLines
            .filter((line) => line.labelUnprinted === true)
            .map((line) => line.lotId);
          if (unprinted.length > 0) setLabelLotIds(unprinted);
        },
        onError: (cause) => {
          const apiError = toApiError(cause);
          if (isForbidden(apiError)) {
            setError(t.forbidden);
            return;
          }
          const index = rejectedLineOf(apiError);
          if (index !== null && index < lines.length) setSelected(index);
          setError(serverReasonOf(apiError) ?? t.submitFailed);
        },
      },
    );
  };

  const finishLabels = (outcome: LabelOutcome): void => {
    const l = words().label;
    setLabelLotIds(null);
    if (outcome.kind === 'printed') setNotice({ tone: 'ok', text: l.printed(outcome.count) });
    if (outcome.kind === 'failed') {
      setNotice({
        tone: 'bad',
        text: outcome.reason === null ? l.failedNoReason : l.failed(outcome.reason),
      });
    }
  };

  const decimal = current === null ? true : !isCountUom(current.uomCode);

  const actionBar = (
    <PuActionBar
      label={t.barLabel}
      lead={
        <PuButton icon="reset" disabled={lines.length === 0 || isBusy} onClick={clearAll}>
          {t.clear}
        </PuButton>
      }
    >
      <PuButton variant="primary" icon="check" disabled={!isSubmittable} onClick={submit}>
        {receive.isPending ? t.submitting : t.submit(lines.length)}
      </PuButton>
    </PuActionBar>
  );

  return (
    <main className="pop-ui pmr-screen" aria-label={words().title}>
      <h1 className="pmr-title">{words().title}</h1>
      <PopTopPrinter>
        <PrinterChip
          printers={printers.data}
          selected={headPrinter}
          isLoading={printers.isPending}
          isError={printers.isError}
          isLocked={isBusy}
          onRetry={() => {
            void printers.refetch();
          }}
          onSelect={(name) => {
            setPickedPrinter(name);
            rememberPrinterName(name);
          }}
        />
      </PopTopPrinter>

      <PopWorkerMissingBanner workerNo={workerNo} />

      <PuScreen className="pmr-body" actionBar={actionBar}>
        <PuCols variant="k2">
          <PuSection label={words().title} className="pmr-work" bodyClassName="pmr-work-body">
            <div className="pmr-scan-row">
              <PuScanField
                className="pmr-scan"
                label={t.scanLabel}
                value={scanText}
                done={lines.length > 0}
                error={error}
                disabled={isBusy}
                manual={{ label: t.manualLabel }}
                inputRef={scanRef}
                onChange={(value) => {
                  setScanText(value);
                  setError(null);
                }}
                onSubmit={submitScan}
              />
              <PuButton
                className="pmr-find"
                icon="search"
                disabled={isBusy}
                onClick={() => {
                  setFindOpen(true);
                }}
              >
                {t.byWorkOrder}
              </PuButton>
            </div>
            {lookup.isPending ? <PuNote live>{t.looking}</PuNote> : null}
            {notice === null ? null : (
              <PuNote tone={notice.tone} live>
                {notice.text}
              </PuNote>
            )}
            {pendingCount > 0 ? <PuNote tone="warn">{t.pending(pendingCount)}</PuNote> : null}

            {lines.length === 0 ? (
              <PuEmpty icon="scan" title={t.emptyTitle} hint={t.emptyHint} />
            ) : (
              <>
                <p className="pmr-dest">
                  {terminalWarehouseName === null
                    ? t.destinationPlain
                    : t.destination(terminalWarehouseName)}
                </p>
                <LineTable
                  lines={lines}
                  selected={selected}
                  terminalWarehouseId={terminalWarehouseId}
                  isLocked={isBusy}
                  onSelect={setSelected}
                  onRemove={(index) => {
                    const next = removeLine(lines, index, selected);
                    setLines(next.lines);
                    setSelected(next.selected);
                  }}
                />
                <p className="pmr-sum">{t.sum(lines.length, totalsOf(lines))}</p>
              </>
            )}
          </PuSection>

          <PuSection title={t.qtyLabel} className="pmr-qty" bodyClassName="pmr-qty-body" split>
            {current === null ? (
              <PuNote>{t.noLine}</PuNote>
            ) : (
              <div className="pmr-qty-main">
                <PuField label={t.qtyLabel} required>
                  <div className="pu-row">
                    <PuInput
                      value={current.qtyText}
                      aria-label={t.qtyLabel}
                      numeric
                      target
                      need={current.qtyText === ''}
                      inputMode="none"
                      readOnly
                    />
                    <span className="pu-unit">{current.uomCode}</span>
                  </div>
                </PuField>
                <span className="pmr-hint">
                  {t.returnableHint(formatBaseQty(current.returnableQty, current.uomCode))}
                </span>
                {currentProblem === null ? null : (
                  <PuNote tone="bad">
                    {currentProblem === 'integer'
                      ? t.qtyInteger
                      : t.qtyOver(formatBaseQty(current.returnableQty, current.uomCode))}
                  </PuNote>
                )}
              </div>
            )}
            {/* 키패드를 눌러도 스캔 칸이 포커스를 잃지 않게 한다(눌림은 그대로 된다). */}
            <div
              onMouseDown={(event) => {
                event.preventDefault();
              }}
            >
              <PuKeypad
                targetLabel={current === null ? null : t.qtyLabel}
                showTarget={false}
                decimal={decimal}
                disabled={isBusy}
                onKey={(key) => {
                  if (current === null) return;
                  changeQty(applyKeypadKey(current.qtyText, key, { decimal }));
                }}
                onClearAll={() => {
                  changeQty('');
                }}
              />
            </div>
          </PuSection>
        </PuCols>
      </PuScreen>

      {isFindOpen ? (
        <FindByWorkOrderDialog
          onClose={() => {
            setFindOpen(false);
          }}
          onAdd={(line) => {
            setFindOpen(false);
            setError(null);
            setNotice(null);
            putLine(line);
          }}
        />
      ) : null}
      {labelLotIds === null ? null : (
        <ReturnLabelDialog
          lotIds={labelLotIds}
          plantId={plantId}
          workerNo={workerNo}
          printer={{
            printerName: headPrinter?.printerName ?? null,
            shellPrinterName: isPrinterSelectable ? (headPrinter?.printerName ?? null) : null,
          }}
          onDone={finishLabels}
        />
      )}
    </main>
  );
};

const LineTable = ({
  lines,
  selected,
  terminalWarehouseId,
  isLocked,
  onSelect,
  onRemove,
}: {
  lines: readonly ReturnLine[];
  selected: number | null;
  terminalWarehouseId: number | null;
  isLocked: boolean;
  onSelect: (index: number) => void;
  onRemove: (index: number) => void;
}) => {
  const t = words().pop;

  return (
    <div className="pu-table-wrap pmr-table" role="group" aria-label={t.table.label}>
      <table className="pu-table">
        <thead>
          <tr>
            <th className="fit num">{t.table.no}</th>
            <th>{t.table.item}</th>
            <th>{t.table.lotNo}</th>
            <th className="fit num">{t.table.returnable}</th>
            <th className="fit num">{t.table.qty}</th>
            <th className="fit">{t.table.destination}</th>
            <th className="fit mid" />
          </tr>
        </thead>
        <tbody>
          {lines.map((line, index) => {
            const destination = destinationOf(line, terminalWarehouseId);

            return (
              <tr
                key={line.lotId}
                className={index === selected ? 'is-pick is-selected' : 'is-pick'}
                aria-selected={index === selected}
                onClick={
                  isLocked
                    ? undefined
                    : () => {
                        onSelect(index);
                      }
                }
              >
                <td className="fit num">{index + 1}</td>
                <td className="pmr-two" title={`${line.itemCode} ${line.itemName}`}>
                  <b className="pu-mono">{line.itemCode}</b>
                  <span className="pmr-sub">{line.itemName}</span>
                </td>
                <td className="pmr-lotcol">
                  <span className="pu-mono pmr-lotno">{line.lotNo}</span>
                  {line.pickedWorkOrderId === null ? null : (
                    <PuChip tone="info">{t.byWorkOrderChip}</PuChip>
                  )}
                </td>
                <td className="fit num">{formatBaseQty(line.returnableQty, line.uomCode)}</td>
                <td className="fit num pmr-qtycell">
                  <b>{line.qtyText === '' ? '' : line.qtyText}</b>
                </td>
                <td className="fit">
                  {destination.kind === 'staging' ? (
                    <PuChip>{t.staging}</PuChip>
                  ) : destination.kind === 'other' ? (
                    <PuChip tone="warn">{t.otherWarehouse(destination.warehouseName)}</PuChip>
                  ) : (
                    <PuChip>{t.stagingOf(destination.warehouseName)}</PuChip>
                  )}
                </td>
                <td className="fit mid">
                  <PuRemoveButton
                    label={t.table.remove(line.lotNo)}
                    disabled={isLocked}
                    onClick={(event) => {
                      event.stopPropagation();
                      onRemove(index);
                    }}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
