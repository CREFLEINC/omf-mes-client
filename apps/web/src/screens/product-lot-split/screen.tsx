import { isForbidden } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useId, useRef, useState, type RefObject } from 'react';

import { formatBaseQty, isCountUom, parseQtyInput } from '../../patterns/package-qty';
import { usePopIdentity } from '../../patterns/pop-identity';
import { PopTopPrinter } from '../../patterns/pop-top-status';
import {
  PuActionBar,
  PuButton,
  PuChip,
  PuCols,
  PuCount,
  PuDialog,
  PuEmpty,
  PuField,
  PuIcon,
  PuInput,
  PuKeypad,
  PuKv,
  PuNote,
  PuPager,
  PuScanField,
  PuScreen,
  PuSection,
  PuTiles,
  applyKeypadKey,
  useClientPage,
  useFitTableRows,
} from '../../patterns/pop-uniform';
import { PopWorkerMissingBanner } from '../../patterns/pop-worker-missing-banner';
import { toApiError } from '../../patterns/request';
import { PrinterChip } from '../pop-material-lot-label/printer-chip';
import {
  choosePrinter,
  rememberPrinterName,
  storedPrinterName,
} from '../pop-material-lot-label/printer-choice';
import {
  usePrinters,
  useReissueReasons,
  useShellSelectsPrinter,
} from '../pop-material-lot-label/queries';
import { ReasonPicker } from '../pop-material-lot-label/reason-picker';
import { useLabelPrintRunner } from '../production-result/flow-print';
import {
  blockViewOf,
  conflictCodeOf,
  initialLocationId,
  isRangeRejection,
  isSplitBlockCode,
  lotTail,
  qtyProblemOf,
  shortAt,
  subtractQty,
  type BlockView,
} from './model';
import {
  productLotSplitKeys,
  useCreateSplit,
  useReissueSplitLabels,
  useSplitLookup,
  useSplitQueue,
  useSplitWorkOrder,
  type ProductLotSplit,
  type SplitLookup,
  type SplitResult,
} from './queries';
import { printOutcomeViewOf, splitPrintTargets, type SplitLabelSource } from './split-print';
import './uniform.css';

const t = messages.productLotSplit;

/** 분리 직후 미리보기 — 분리 응답과 그때의 LOT 값. */
interface SplitDone {
  result: SplitResult;
  source: SplitLabelSource;
  /** 원래 상자에 붙어 있던 옛 라벨 수량(분리 전 LOT 수량). */
  oldQty: number;
}

/** 마지막 인쇄가 무엇이었는가 — 결과 띠의 장 수 · 문구를 고른다. */
interface PrintRun {
  total: number;
  isReprint: boolean;
}

/**
 * `P-04-08` 생산 LOT 분리 (POP · 피처 013 · omf-all-around#303 · 시안 P0408 승인 2026-11-20).
 *
 * ```
 * ┌ 분리하기 ──────────────────────┐ ┌ 확인 대기 (n) ─────────────────────────────────┐
 * │ [생산 LOT 라벨 스캔] [직접 입력] │ │ ○ 원래 LOT → 새 LOT | 남음/새 | 위치 | 시각 | 라벨 │
 * │ LOT(품목 · 번호 · 상태 · W/O)    │ │ …                                               │
 * │ 분리할 위치 [타일]              │ │                                                 │
 * │ 분리할 수량 [  30 EA] [키패드]   │ │                                                 │
 * │ 원래에 남음 70 ⇄ 새 LOT 30       │ │                                    ‹ 1 / 1 ›    │
 * ├ 작업 줄: [분리하고 라벨 2장 출력] / [고른 분리 라벨 2장 다시 출력] ───────────────────┤
 * ```
 *
 * ⭐ 막는 조건은 서버가 정한다 — 스캔 조회의 `blocked`(LOT · 위치)와 분리 409 `code` 를 같은 문구로 보인다.
 * ⭐ 분리 직후 두 장은 사유를 묻지 않는다(원래 LOT 사유 `LOT_SPLIT` 은 서버가 붙인다). 확인 대기에서 다시 출력할
 *    때만 사유를 고른다 — 그 목록에 `LOT_SPLIT` 은 없다.
 * ⭐ 확인 대기 수는 목록 머리에만 보인다(「화면 이동」 배지 없음 · 설계 검토 2026-11-20).
 */
export const ProductLotSplitScreen = () => {
  const { workerNo, plantId = null } = usePopIdentity();
  const workTitleId = useId();
  const queryClient = useQueryClient();

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
  const shellPrinterName = isPrinterSelectable ? (headPrinter?.printerName ?? null) : null;
  const runner = useLabelPrintRunner(workerNo, shellPrinterName);

  const lookup = useSplitLookup();
  const createSplit = useCreateSplit();
  const reissue = useReissueSplitLabels();
  const queue = useSplitQueue(plantId !== null);

  const [scanText, setScanText] = useState('');
  const [found, setFound] = useState<SplitLookup | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [locationId, setLocationId] = useState<number | null>(null);
  const [qtyText, setQtyText] = useState('');
  /* 분리 요청이 서버에서 거절된 이유(409 code · 400 RANGE). 다시 스캔하거나 값을 바꾸면 지운다. */
  const [rejection, setRejection] = useState<BlockView | null>(null);
  const [isRangeRejected, setRangeRejected] = useState(false);
  const [done, setDone] = useState<SplitDone | null>(null);
  const [printRun, setPrintRun] = useState<PrintRun | null>(null);
  const [notice, setNotice] = useState<{ tone: 'bad' | 'warn'; text: string } | null>(null);
  const [freshSplitId, setFreshSplitId] = useState<number | null>(null);
  const [selectedSplitId, setSelectedSplitId] = useState<number | null>(null);
  const [isReprintOpen, setReprintOpen] = useState(false);

  const splits = queue.data?.items ?? [];
  const selectedSplit = splits.find((each) => each.productLotSplitId === selectedSplitId) ?? null;
  const isBusy =
    lookup.isPending ||
    createSplit.isPending ||
    reissue.isPending ||
    runner.state.phase === 'sending';

  const lot = found?.lot ?? null;
  const lotBlock = found?.blocked ?? null;
  const location = found?.locations.find((each) => each.locationId === locationId) ?? null;
  const uomCode = lot?.uomCode ?? null;
  const qty = parseQtyInput(qtyText);
  const qtyProblem = isRangeRejected ? 'range' : qtyProblemOf(qtyText, location, uomCode);
  const canSplit =
    lot !== null &&
    lotBlock === null &&
    rejection === null &&
    location !== null &&
    qty !== null &&
    qtyProblem === null &&
    workerNo !== null &&
    !isBusy;

  const outcome =
    printRun === null ? null : printOutcomeViewOf(runner.state, printRun.total, printRun.isReprint);

  const clearWork = (): void => {
    setFound(null);
    setLocationId(null);
    setQtyText('');
    setRejection(null);
    setRangeRejected(false);
  };

  const submitScan = (value: string): void => {
    const lotNo = value.trim();
    if (lotNo === '' || isBusy) return;

    clearWork();
    setScanError(null);
    setNotice(null);
    setPrintRun(null);
    runner.reset();
    setSelectedSplitId(null);
    createSplit.resetKey();
    lookup.mutate(lotNo, {
      onSuccess: (data) => {
        setFound(data);
        setLocationId(data.blocked === null ? initialLocationId(data.locations) : null);
      },
      onError: (cause) => {
        const error = toApiError(cause);
        setScanText('');
        setScanError(
          error.kind !== 'network' && error.status === 404
            ? t.work.notFound(lotNo)
            : t.work.lookupFailed,
        );
      },
    });
  };

  const changeQty = (next: string): void => {
    setQtyText(next);
    setRangeRejected(false);
  };

  const startSplit = (): void => {
    if (!canSplit || lot === null || location === null || qty === null || workerNo === null) return;

    const source: SplitLabelSource = {
      itemCode: lot.itemCode,
      uomCode: lot.uomCode,
      workOrderNo: lot.workOrderNo,
    };
    const oldQty = lot.labelQty;

    createSplit.mutate(
      { lotId: lot.lotId, locationId: location.locationId, qty, workerNo },
      {
        onSuccess: (result) => {
          createSplit.resetKey();
          clearWork();
          setScanText('');
          setFreshSplitId(result.productLotSplitId);
          setDone({ result, source, oldQty });
        },
        onError: (cause) => {
          const error = toApiError(cause);
          const code = conflictCodeOf(error);

          if (error.kind === 'network') {
            /* 같은 키로 다시 누를 수 있게 키를 남긴다. */
            setNotice({ tone: 'bad', text: t.result.splitFailed });
            return;
          }
          createSplit.resetKey();
          if (isForbidden(error)) setNotice({ tone: 'bad', text: t.result.forbidden });
          else if (isRangeRejection(error)) setRangeRejected(true);
          else if (isSplitBlockCode(code)) setRejection(blockViewOf(code));
          else setNotice({ tone: 'bad', text: t.result.splitFailed });
        },
      },
    );
  };

  const printLabels = async (
    labels: Parameters<typeof splitPrintTargets>[0],
    source: SplitLabelSource,
    isReprint: boolean,
  ): Promise<void> => {
    setPrintRun({ total: labels.length, isReprint });
    await runner.run(splitPrintTargets(labels, source));
    await queryClient.invalidateQueries({ queryKey: productLotSplitKeys.queue });
  };

  const printDone = (): void => {
    if (done === null) return;
    const { result, source } = done;
    setDone(null);
    void printLabels(
      [
        { role: 'parent', ...result.parentLot },
        { role: 'child', ...result.childLot },
      ],
      source,
      false,
    );
  };

  const startReprint = (split: ProductLotSplit, reasonCode: string, workOrderNo: string | null) => {
    if (workerNo === null) return;

    reissue.mutate(
      { split, reasonCode, printerName: headPrinter?.printerName ?? null, workerNo },
      {
        onSuccess: ({ parent, child }) => {
          setReprintOpen(false);
          setSelectedSplitId(null);
          void printLabels(
            [
              {
                role: 'parent',
                documentIssueLogId: parent.documentIssueLogId,
                issueSeq: parent.issueSeq,
                lotNo: split.parentLot.lotNo,
                qty: split.parentLot.qty,
              },
              {
                role: 'child',
                documentIssueLogId: child.documentIssueLogId,
                issueSeq: child.issueSeq,
                lotNo: split.childLot.lotNo,
                qty: split.childLot.qty,
              },
            ],
            { itemCode: split.item.itemCode, uomCode: split.item.uomCode, workOrderNo },
            true,
          );
        },
        onError: (cause) => {
          setReprintOpen(false);
          setNotice({
            tone: 'bad',
            text: isForbidden(toApiError(cause)) ? t.result.forbidden : t.result.reprintFailed,
          });
        },
      },
    );
  };

  const actionBar = (
    <PuActionBar label={t.bar.label}>
      {selectedSplit === null ? (
        <PuButton variant="primary" icon="print" disabled={!canSplit} onClick={startSplit}>
          {createSplit.isPending ? t.bar.splitting : t.bar.split}
        </PuButton>
      ) : (
        <PuButton
          variant="primary"
          icon="print"
          disabled={workerNo === null || isBusy}
          onClick={() => {
            setReprintOpen(true);
          }}
        >
          {t.bar.reprint}
        </PuButton>
      )}
    </PuActionBar>
  );

  return (
    <main className="pop-ui pls-screen" aria-label={t.title}>
      <h1 className="pls-title">{t.title}</h1>
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

      <PuScreen className="pls-body" actionBar={actionBar}>
        <PuCols variant="c2">
          <PuSection
            title={t.work.title}
            labelId={workTitleId}
            className="pls-work"
            bodyClassName="pls-work-body"
          >
            <PuScanField
              label={t.work.scanLabel}
              value={scanText}
              done={found !== null}
              error={scanError}
              disabled={isBusy}
              manual={{ label: t.work.manualLabel }}
              onChange={(value) => {
                setScanText(value);
                setScanError(null);
              }}
              onSubmit={submitScan}
            />
            {lookup.isPending ? <PuNote live>{t.work.looking}</PuNote> : null}
            {notice === null ? null : <PuNote tone={notice.tone}>{notice.text}</PuNote>}
            {outcome === null ? null : (
              <PuNote
                tone={outcome.tone}
                live
                action={
                  outcome.canRetryReport ? (
                    <PuButton
                      size="sm"
                      onClick={() => {
                        void runner.retryReport();
                      }}
                    >
                      {t.queue.retry}
                    </PuButton>
                  ) : undefined
                }
              >
                <b>{outcome.title}</b>
                {outcome.body === null ? null : ` ${outcome.body}`}
              </PuNote>
            )}
            {lotBlock === null ? null : (
              <BlockNote view={blockViewOf(lotBlock.code, lotBlock.detail)} />
            )}
            {rejection === null ? null : <BlockNote view={rejection} />}
            {lot === null || found === null ? (
              found === null && outcome === null && notice === null && !lookup.isPending ? (
                <PuNote>{t.work.idleHint}</PuNote>
              ) : null
            ) : (
              <>
                <LotInfo lookup={found} />
                {lotBlock === null ? (
                  <SplitInputs
                    lookup={found}
                    locationId={locationId}
                    qtyText={qtyText}
                    qtyProblem={qtyProblem}
                    isLocked={isBusy}
                    onLocation={(next) => {
                      setLocationId(next);
                      setRejection(null);
                      setRangeRejected(false);
                    }}
                    onQty={changeQty}
                  />
                ) : null}
              </>
            )}
          </PuSection>

          <QueueSection
            query={queue}
            splits={splits}
            freshSplitId={freshSplitId}
            selectedSplitId={selectedSplitId}
            isLocked={isBusy}
            onSelect={(id) => {
              setSelectedSplitId((current) => (current === id ? null : id));
            }}
          />
        </PuCols>
      </PuScreen>

      {done === null ? null : (
        <SplitLabelsDialog
          done={done}
          onClose={() => {
            setDone(null);
            setPrintRun(null);
            setNotice({ tone: 'warn', text: t.result.notPrinted });
          }}
          onPrint={printDone}
        />
      )}
      {isReprintOpen && selectedSplit !== null ? (
        <ReprintDialog
          split={selectedSplit}
          isBusy={reissue.isPending}
          onCancel={() => {
            setReprintOpen(false);
          }}
          onPrint={(reasonCode, workOrderNo) => {
            startReprint(selectedSplit, reasonCode, workOrderNo);
          }}
        />
      ) : null}
    </main>
  );
};

const BlockNote = ({ view }: { view: BlockView }) => (
  <PuNote tone="bad">
    <b>{view.title}</b> {view.body}
  </PuNote>
);

/** 스캔한 LOT — 품목 · 번호 · 상태(정상은 칩 없음 · C-21) · W/O. */
const LotInfo = ({ lookup }: { lookup: SplitLookup }) => {
  const { lot, blocked } = lookup;
  const state = lot.statusCode === 'NORMAL' ? undefined : t.lot.statuses[lot.statusCode];

  return (
    <div className="pls-lot" role="group" aria-label={t.lot.label}>
      <PuKv
        items={[
          {
            label: t.lot.item,
            value: (
              <>
                <b>{lot.itemName}</b> ({lot.itemCode})
              </>
            ),
          },
          { label: t.lot.lotNo, value: <span className="pu-mono pls-lotno">{lot.lotNo}</span> },
          {
            label: t.lot.status,
            value: (
              <span className="pls-chips">
                {state === undefined ? null : (
                  <PuChip tone={lot.statusCode === 'INSPECTION_PENDING' ? 'info' : 'warn'}>
                    {state}
                  </PuChip>
                )}
                {blocked?.code === 'LOT_SPLIT_UNCONFIRMED' ? (
                  <PuChip tone="info">{t.lot.queued}</PuChip>
                ) : null}
                {blocked?.code === 'LOT_ALREADY_RESERVED' && blocked.detail !== null ? (
                  <PuChip tone="warn">{blocked.detail}</PuChip>
                ) : null}
                {state === undefined && blocked === null ? '-' : null}
              </span>
            ),
          },
          {
            label: t.lot.workOrder,
            value: <span className="pu-mono">{lot.workOrderNo ?? '-'}</span>,
          },
          { label: t.lot.labelQty, value: formatBaseQty(lot.labelQty, lot.uomCode) },
        ]}
      />
    </div>
  );
};

/** 위치 타일 + 수량(키패드) + 나눈 뒤 미리보기. */
const SplitInputs = ({
  lookup,
  locationId,
  qtyText,
  qtyProblem,
  isLocked,
  onLocation,
  onQty,
}: {
  lookup: SplitLookup;
  locationId: number | null;
  qtyText: string;
  qtyProblem: 'range' | 'integer' | null;
  isLocked: boolean;
  onLocation: (locationId: number) => void;
  onQty: (text: string) => void;
}) => {
  const { lot, locations } = lookup;
  const location = locations.find((each) => each.locationId === locationId) ?? null;
  const qty = parseQtyInput(qtyText);
  const decimal = !isCountUom(lot.uomCode);
  const showsPreview = location !== null && qty !== null && qtyProblem === null;

  return (
    <>
      <PuField label={t.location.label} required>
        {locations.length > 1 ? (
          <PuNote>
            {t.location.many(locations.length, formatBaseQty(lot.labelQty, lot.uomCode))}
          </PuNote>
        ) : null}
        {locations.length === 0 ? (
          <PuNote tone="warn">{t.location.none}</PuNote>
        ) : (
          <PuTiles
            label={t.location.label}
            cols={Math.min(3, locations.length)}
            value={locationId === null ? null : String(locationId)}
            disabled={isLocked}
            options={locations.map((each) => {
              const reason =
                each.blocked === null ? undefined : t.location.blocked[each.blocked.code];
              return {
                value: String(each.locationId),
                disabled: !each.selectable,
                label: (
                  <span className="pls-tile">
                    <b>{each.locationCode}</b>
                    <span>
                      {t.location.tile(
                        each.warehouseCode,
                        formatBaseQty(each.onHandQty, lot.uomCode),
                      )}
                    </span>
                    {reason === undefined ? null : <span className="pls-tile-why">{reason}</span>}
                  </span>
                ),
              };
            })}
            onChange={(value) => {
              onLocation(Number(value));
            }}
          />
        )}
      </PuField>

      {location === null ? null : (
        <div className="pls-qty">
          <div className="pls-qty-main">
            <PuField label={t.qty.label} required>
              <div className="pu-row">
                <PuInput
                  value={qtyText}
                  aria-label={t.qty.label}
                  numeric
                  target
                  need={qtyText === ''}
                  inputMode="none"
                  readOnly
                />
                <span className="pu-unit">{lot.uomCode}</span>
              </div>
            </PuField>
            {qtyProblem === null ? null : (
              <PuNote tone="bad">
                <b>{t.qty.badTitle}</b>{' '}
                {qtyProblem === 'integer'
                  ? t.qty.badInteger
                  : t.qty.bad(formatBaseQty(location.onHandQty, lot.uomCode))}
              </PuNote>
            )}
            {showsPreview ? (
              <div className="pls-split" role="group" aria-label={t.preview.label}>
                <div className="pls-half">
                  <small>{t.preview.parent}</small>
                  <b>{formatBaseQty(subtractQty(lot.labelQty, qty), lot.uomCode)}</b>
                  <span className="pu-mono">{lotTail(lot.lotNo)}</span>
                </div>
                <PuIcon name="chevr" />
                <div className="pls-half is-new">
                  <small>{t.preview.child}</small>
                  <b>{formatBaseQty(qty, lot.uomCode)}</b>
                  <span>{t.preview.childNo}</span>
                </div>
              </div>
            ) : null}
          </div>
          <PuKeypad
            targetLabel={t.qty.label}
            showTarget={false}
            decimal={decimal}
            disabled={isLocked}
            onKey={(key) => {
              onQty(applyKeypadKey(qtyText, key, { decimal }));
            }}
            onClearAll={() => {
              onQty('');
            }}
          />
        </div>
      )}
    </>
  );
};

/** 라벨 한 장 미리보기 — 생산 LOT 라벨(80 × 30 mm) 줄 그대로. */
const LabelPreview = ({
  caption,
  tone,
  seq,
  itemCode,
  qty,
  uomCode,
  lotNo,
  workOrderNo,
  qtyChanged,
}: {
  caption: string;
  tone: 'idle' | 'info';
  seq: number | null;
  itemCode: string;
  qty: number;
  uomCode: string | null;
  lotNo: string;
  workOrderNo: string | null;
  qtyChanged: boolean;
}) => (
  <div className="pls-label">
    <PuChip tone={tone}>{caption}</PuChip>
    <figure className="pu-label-preview pls-label-face" aria-label={t.dialog.labelName(lotNo)}>
      <span className="pu-mono">{seq === null ? 'PROD LOT' : `PROD LOT  #${String(seq)}`}</span>
      <div className="qr" aria-hidden="true" />
      <span className="pu-mono">{`ITEM ${itemCode}`}</span>
      <span className={qtyChanged ? 'pu-mono pls-changed' : 'pu-mono'}>
        {`QTY ${formatBaseQty(qty, uomCode)}`}
      </span>
      <span className="pu-mono pls-label-lot">{`LOT ${lotNo}`}</span>
      <span className="pu-mono">{`W/O ${workOrderNo ?? '-'}`}</span>
    </figure>
  </div>
);

/** 분리 직후 — 두 장 미리보기 → [2장 인쇄]. 사유를 묻지 않는다. */
const SplitLabelsDialog = ({
  done,
  onClose,
  onPrint,
}: {
  done: SplitDone;
  onClose: () => void;
  onPrint: () => void;
}) => {
  const { result, source, oldQty } = done;

  return (
    <PuDialog
      title={t.dialog.splitTitle}
      wide
      onClose={onClose}
      footer={
        <>
          <span className="pls-dialog-foot">
            {t.dialog.oldLabel(formatBaseQty(oldQty, source.uomCode))}
          </span>
          <PuButton onClick={onClose}>{t.dialog.close}</PuButton>
          <PuButton variant="primary" icon="print" onClick={onPrint}>
            {t.dialog.print}
          </PuButton>
        </>
      }
    >
      <div className="pls-labels">
        <LabelPreview
          caption={t.dialog.parentCaption(result.parentLot.issueSeq)}
          tone="idle"
          seq={result.parentLot.issueSeq}
          itemCode={source.itemCode}
          qty={result.parentLot.qty}
          uomCode={source.uomCode}
          lotNo={result.parentLot.lotNo}
          workOrderNo={source.workOrderNo}
          qtyChanged
        />
        <LabelPreview
          caption={t.dialog.childCaption(result.childLot.issueSeq)}
          tone="info"
          seq={result.childLot.issueSeq}
          itemCode={source.itemCode}
          qty={result.childLot.qty}
          uomCode={source.uomCode}
          lotNo={result.childLot.lotNo}
          workOrderNo={source.workOrderNo}
          qtyChanged={false}
        />
      </div>
    </PuDialog>
  );
};

/**
 * 확인 대기에서 다시 출력 — 사유(사람 목록 · `LOT_SPLIT` 없음) + 두 장 미리보기. 회차는 발행할 때 정해져
 * 미리보기에는 적지 않는다.
 */
const ReprintDialog = ({
  split,
  isBusy,
  onCancel,
  onPrint,
}: {
  split: ProductLotSplit;
  isBusy: boolean;
  onCancel: () => void;
  onPrint: (reasonCode: string, workOrderNo: string | null) => void;
}) => {
  const [code, setCode] = useState<string | null>(null);
  const reasons = useReissueReasons(true);
  const workOrder = useSplitWorkOrder(split.parentLot.lotNo);
  const workOrderNo = workOrder.data ?? null;

  return (
    <PuDialog
      title={t.dialog.reprintTitle}
      wide
      onClose={onCancel}
      footer={
        <>
          <PuButton onClick={onCancel} disabled={isBusy}>
            {t.dialog.close}
          </PuButton>
          <PuButton
            variant="primary"
            icon="print"
            disabled={code === null || isBusy || workOrder.isPending}
            onClick={() => {
              if (code !== null) onPrint(code, workOrderNo);
            }}
          >
            {t.dialog.print}
          </PuButton>
        </>
      }
    >
      <ReasonPicker
        reasons={reasons.data ?? []}
        isLoading={reasons.isPending}
        isError={reasons.isError}
        selected={code}
        isLocked={isBusy}
        onSelect={setCode}
        label={t.dialog.reasonLabel}
        hint={code === null ? <PuChip tone="bad">{t.dialog.reasonNeed}</PuChip> : undefined}
      />
      {workOrder.isPending ? <PuNote live>{t.dialog.workOrderLoading}</PuNote> : null}
      <div className="pls-labels">
        <LabelPreview
          caption={t.dialog.parentReprint}
          tone="idle"
          seq={null}
          itemCode={split.item.itemCode}
          qty={split.parentLot.qty}
          uomCode={split.item.uomCode}
          lotNo={split.parentLot.lotNo}
          workOrderNo={workOrderNo}
          qtyChanged={false}
        />
        <LabelPreview
          caption={t.dialog.childReprint}
          tone="info"
          seq={null}
          itemCode={split.item.itemCode}
          qty={split.childLot.qty}
          uomCode={split.item.uomCode}
          lotNo={split.childLot.lotNo}
          workOrderNo={workOrderNo}
          qtyChanged={false}
        />
      </div>
    </PuDialog>
  );
};

const PRINT_CHIP: Record<'PRINTED' | 'FAILED' | 'NONE', { tone: 'idle' | 'bad'; text: string }> = {
  PRINTED: { tone: 'idle', text: t.queue.printed },
  FAILED: { tone: 'bad', text: t.queue.failed },
  NONE: { tone: 'idle', text: t.queue.notPrinted },
};

/** 오른쪽 구획 — PDA 확인을 기다리는 분리(오래된 순). 줄을 누르면 고른다(다시 출력 대상, 하나만). */
const QueueSection = ({
  query,
  splits,
  freshSplitId,
  selectedSplitId,
  isLocked,
  onSelect,
}: {
  query: ReturnType<typeof useSplitQueue>;
  splits: readonly ProductLotSplit[];
  freshSplitId: number | null;
  selectedSplitId: number | null;
  isLocked: boolean;
  onSelect: (productLotSplitId: number) => void;
}) => {
  const titleId = useId();
  const fitRef = useRef<HTMLDivElement>(null);
  const pageSize = useFitTableRows(fitRef, { fallback: 6 });
  const page = useClientPage(splits, pageSize);
  const count = query.data?.unconfirmedCount;

  return (
    <PuSection
      title={t.queue.title}
      labelId={titleId}
      className="pls-queue"
      bodyClassName="pls-queue-body"
      meta={
        <>
          <PuCount>{count === undefined ? '?' : count}</PuCount>
          <span className="pls-queue-hint">{t.queue.hint}</span>
        </>
      }
    >
      {query.isError ? (
        <PuEmpty icon="bad" title={t.queue.loadFailedTitle} hint={t.queue.loadFailedBody}>
          <PuButton
            onClick={() => {
              void query.refetch();
            }}
          >
            {t.queue.retry}
          </PuButton>
        </PuEmpty>
      ) : query.isPending ? null : splits.length === 0 ? (
        <PuEmpty icon="ok" title={t.queue.emptyTitle} hint={t.queue.emptyBody} />
      ) : (
        <>
          <QueueTable
            splits={page.items}
            freshSplitId={freshSplitId}
            selectedSplitId={selectedSplitId}
            isLocked={isLocked}
            onSelect={onSelect}
            fitRef={fitRef}
          />
          <div className="pls-queue-foot">
            <PuPager
              label={t.queue.label}
              total={page.total}
              page={page.page}
              pages={page.pages}
              onPage={page.setPage}
            />
          </div>
        </>
      )}
    </PuSection>
  );
};

const QueueTable = ({
  splits,
  freshSplitId,
  selectedSplitId,
  isLocked,
  onSelect,
  fitRef,
}: {
  splits: readonly ProductLotSplit[];
  freshSplitId: number | null;
  selectedSplitId: number | null;
  isLocked: boolean;
  onSelect: (productLotSplitId: number) => void;
  fitRef: RefObject<HTMLDivElement | null>;
}) => (
  <div ref={fitRef} className="pls-table" role="group" aria-label={t.queue.label}>
    <div className="pu-table-wrap">
      <table className="pu-table">
        <thead>
          <tr>
            <th className="fit mid" aria-hidden="true" />
            <th>{t.queue.cols.lots}</th>
            <th className="num fit">{t.queue.cols.qty}</th>
            <th className="fit">{t.queue.cols.location}</th>
            <th className="fit pls-narrow-hide">{t.queue.cols.splitAt}</th>
            <th className="fit mid pls-narrow-hide">{t.queue.cols.label}</th>
          </tr>
        </thead>
        <tbody>
          {splits.map((split) => {
            const isOn = split.productLotSplitId === selectedSplitId;
            const uom = split.item.uomCode;
            const choose = (): void => {
              if (!isLocked) onSelect(split.productLotSplitId);
            };

            return (
              <tr
                key={split.productLotSplitId}
                className={isOn ? 'is-pick is-selected' : 'is-pick'}
                aria-selected={isOn}
                onClick={choose}
              >
                <td className="fit mid">
                  <button
                    type="button"
                    role="radio"
                    className="pls-pick"
                    aria-checked={isOn}
                    aria-label={t.queue.choose(split.parentLot.lotNo)}
                    disabled={isLocked}
                    onClick={(event) => {
                      event.stopPropagation();
                      choose();
                    }}
                  >
                    {isOn ? <PuIcon name="check" /> : null}
                  </button>
                </td>
                <td title={`${split.parentLot.lotNo} ${split.childLot.lotNo}`}>
                  <span className="pu-mono pls-one pls-strong">{split.parentLot.lotNo}</span>
                  <span className="pu-mono pls-one pls-sub">
                    {`→ ${lotTail(split.childLot.lotNo)}`}
                    {split.productLotSplitId === freshSplitId ? (
                      <span className="pls-new">{t.queue.newTag}</span>
                    ) : null}
                  </span>
                </td>
                <td className="num fit">
                  <span>
                    {formatBaseQty(split.parentLot.qty, null)} /{' '}
                    <b>{formatBaseQty(split.childLot.qty, null)}</b>
                  </span>
                  <span className="pls-sub">{uom}</span>
                </td>
                <td className="fit">{split.location.locationCode}</td>
                <td className="fit pls-narrow-hide">{shortAt(split.splitAt)}</td>
                <td className="fit mid pls-narrow-hide">
                  <span className="pls-chips-col">
                    <PuChip tone={PRINT_CHIP[split.lastPrint.parent].tone}>
                      {t.queue.parentChip(PRINT_CHIP[split.lastPrint.parent].text)}
                    </PuChip>
                    <PuChip tone={PRINT_CHIP[split.lastPrint.child].tone}>
                      {t.queue.childChip(PRINT_CHIP[split.lastPrint.child].text)}
                    </PuChip>
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </div>
);
