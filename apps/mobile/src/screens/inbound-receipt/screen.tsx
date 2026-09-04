import { AlertBanner, Button, Card, NumberPad, Select, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useRef, useState } from 'react';
import { Link } from 'react-router';

import { isMaterialLotNo } from '../../patterns/material-lot-no';
import { useItem, useItemLabels, useSuppliers, useUomCodes } from '../../patterns/masters';
import { useOutbox } from '../../patterns/outbox';
import { currentPlantId } from '../../patterns/plant';
import { useScanField } from '../../patterns/use-scan-field';
import { useScreenTitle } from '../../patterns/screen-title';
import { useWorkerSession } from '../../patterns/worker-session';
import { useCodeValues } from '../../patterns/code-values';
import { SUBSTITUTE_LOT_REASON, useOpenPurchaseOrders, usePurchaseOrderLines } from './queries';
import {
  NORMAL,
  OVER,
  UNDER,
  canSubmit,
  isExpiryBeforeManufactured,
  packageProblem,
  qtyProblem,
  queuedQtyOf,
  remainingQtyOf,
  sourceOf,
  toOutboxDraft,
  verdictOf,
  type PurchaseOrder,
  type PurchaseOrderLine,
  type ReceiptDraft,
} from './receipt';
import './screen.css';

const t = messages.inboundReceipt;

type Outcome = 'queued' | 'sent' | 'rejected';

const emptyDraft: ReceiptDraft = {
  supplierLotNo: '',
  supplierLotMissing: false,
  substituteLotReasonCode: '',
  unordered: false,
  supplierId: null,
  itemId: null,
  uomId: null,
  purchaseOrder: null,
  purchaseOrderLine: null,
  deliveryNoteNo: '',
  receivedQty: '',
  packageCount: '',
  manufacturedDate: '',
  expiryDate: '',
};

export const InboundReceiptScreen = () => {
  useScreenTitle(t.title);

  const { enqueue, flush, isRejected, loaded, pendingOf } = useOutbox();
  const { worker } = useWorkerSession();

  const [draft, setDraft] = useState<ReceiptDraft>(emptyDraft);
  const [malformed, setMalformed] = useState<string | null>(null);
  const [manual, setManual] = useState('');
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  /* 부족한데도 그대로 등록하겠다는 사람의 답. 화면은 더 올 것인지 알지 못한다. */
  const [continueUnder, setContinueUnder] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  /*
   * 보내는 중인가. 상태로 두면 같은 틱에 두 번 누른 것을 막지 못한다 - 다시 그리기 전에
   * 두 번째가 들어와 멱등키가 다른 두 건이 담기고, 서버가 흡수하지 못해 재고가 두 번 는다.
   */
  const inFlight = useRef(false);

  const patch = (next: Partial<ReceiptDraft>) => {
    /*
     * 판정을 이루는 값이 바뀌면 앞서 받은 답을 버린다. 남겨 두면 부족하다고 답한 수량이
     * 아닌 다른 수량이 그 답을 타고 넘어간다.
     */
    if ('receivedQty' in next || 'purchaseOrderLine' in next) {
      setContinueUnder(false);
    }

    setDraft((current) => ({ ...current, ...next }));
  };

  const take = (value: string) => {
    const code = value.trim();

    if (!isMaterialLotNo(code)) {
      setMalformed(code);
      return;
    }

    setMalformed(null);
    patch({ supplierLotNo: code, supplierLotMissing: false, substituteLotReasonCode: '' });
  };

  const scanField = useScanField({ onScan: take });

  const orders = useOpenPurchaseOrders();
  const lines = usePurchaseOrderLines(draft.purchaseOrder?.purchaseOrderId ?? null);
  const reasons = useCodeValues(SUBSTITUTE_LOT_REASON);
  const item = useItem((draft.unordered ? draft.itemId : draft.purchaseOrderLine?.itemId) ?? null);
  const uoms = useUomCodes(true);
  /* 목록의 발주 라인은 품목 식별자만 준다. 그 번호로는 실물 라벨과 대조할 수 없다. */
  const itemLabels = useItemLabels(draft.purchaseOrder !== null || draft.unordered);
  const suppliers = useSuppliers(draft.unordered);
  /* 공장은 단말 토큰이 싣고 온다. 발주가 없으면 승계할 곳이 여기뿐이다. */
  const plantId = draft.unordered ? currentPlantId() : (draft.purchaseOrder?.plantId ?? null);

  const started = draft.supplierLotNo !== '' || draft.supplierLotMissing;
  const received = Number(draft.receivedQty.trim());
  /* 서버의 누적 입하에는 큐에 있는 것이 없다. 셈에 넣지 않으면 초과가 초과로 보이지 않는다. */
  const queuedQty = queuedQtyOf(
    pendingOf(t.record),
    draft.purchaseOrderLine?.purchaseOrderLineId ?? -1,
  );
  const verdict =
    draft.purchaseOrderLine === null || qtyProblem(draft.receivedQty) !== null
      ? null
      : verdictOf(draft.purchaseOrderLine, received, queuedQty);
  /*
   * 부족은 더 올 것이 남았다고 사람이 답해야 넘어간다. 마지막 회차면 갈 곳이 다르다.
   *
   * 큐를 읽기 전에는 막아 둔다 - 담긴 것이 없는 것과 구별되지 않아, 앞서 담은 입하가 셈에서
   * 빠진 채로 같은 라인에 한 건이 더 나간다.
   */
  const ready =
    loaded &&
    plantId !== null &&
    canSubmit(draft, worker !== null) &&
    (verdict !== UNDER || continueUnder);
  const uom =
    uoms.data?.get((draft.unordered ? draft.uomId : draft.purchaseOrderLine?.uomId) ?? -1) ?? '';

  /* 코드와 이름을 함께 보인다. 라벨에는 코드가 찍혀 있고 사람은 이름으로 고른다. */
  const itemLabelOf = (itemId: number): string => {
    const found = itemLabels.data?.get(itemId);

    return found === undefined ? '' : `${found.itemCode} ${found.itemName}`;
  };

  const qtyMessage = (): string | undefined => {
    const problem = qtyProblem(draft.receivedQty);

    return problem === null || draft.receivedQty === '' ? undefined : t.qty[problem];
  };

  const restart = () => {
    setDraft(emptyDraft);
    setMalformed(null);
    setManual('');
    setOutcome(null);
    setContinueUnder(false);
    setSaveFailed(false);
    scanField.focus();
  };

  const submit = async () => {
    const source = sourceOf(draft);

    if (worker === null || source === null || plantId === null || inFlight.current) {
      return;
    }

    inFlight.current = true;
    setSaveFailed(false);

    try {
      const entry = toOutboxDraft(
        draft,
        source.itemId,
        source.uomId,
        plantId,
        source.supplierId,
        new Date(),
        worker.workerNo,
      );

      /* 담기지 못하면 적은 것이 어디에도 없다. 말하지 않으면 사람은 등록된 줄 안다. */
      try {
        await enqueue(entry);
      } catch {
        setSaveFailed(true);
        return;
      }

      const result = await flush().catch(() => null);
      const mine = (each: { idempotencyKey: string }) =>
        each.idempotencyKey === entry.idempotencyKey;

      /*
       * 자기가 부른 보내기의 결과만 보면 딸려 되돌아간 건을 놓친다 - 그 판정은 셸이 도는 다른
       * 회차에서 내려질 수 있고, 화면은 빈 결과를 받아 담아 두었다고 잘못 말한다.
       */
      if (
        (result !== null && result.rejected.some((each) => mine(each.entry))) ||
        isRejected(entry.idempotencyKey)
      ) {
        setOutcome('rejected');
        return;
      }

      setOutcome(result === null || result.remaining.some(mine) ? 'queued' : 'sent');
    } finally {
      inFlight.current = false;
    }
  };

  if (outcome !== null) {
    return (
      <div className="receipt">
        {outcome === 'sent' ? (
          <AlertBanner variant="success" title={t.sent.title}>
            {t.sent.description}
          </AlertBanner>
        ) : null}
        {outcome === 'queued' ? (
          <AlertBanner variant="warning" title={t.queued.title}>
            {t.queued.description}
          </AlertBanner>
        ) : null}
        {outcome === 'rejected' ? (
          <AlertBanner variant="error" title={t.rejected.title}>
            {t.rejected.description}
            <Link to="/rejections">{t.rejected.action}</Link>
          </AlertBanner>
        ) : null}
        <Button className="receipt__wide" variant="filled" size="2xl" onClick={restart}>
          {t.another}
        </Button>
      </div>
    );
  }

  return (
    <div className="receipt">
      <section className="receipt__section">
        <h2>{t.scan.legend}</h2>
        <TextField
          ref={scanField.ref}
          label={t.scan.label}
          placeholder={t.scan.placeholder}
          size="xl"
          fullWidth
          error={malformed === null ? undefined : t.scan.malformed(malformed.length)}
        />
        {/* 스캔이 실패했을 때 손으로 넣을 길을 함께 둔다. */}
        <div className="receipt__row">
          <TextField
            label={t.scan.manualLabel}
            size="xl"
            fullWidth
            value={manual}
            onChange={(event) => {
              setManual(event.target.value);
            }}
          />
          <Button
            variant="outlined"
            size="xl"
            onClick={() => {
              take(manual);
              /* 넣은 값을 남기면 다음 것을 적을 때 앞 값에 이어 붙는다. */
              setManual('');
            }}
          >
            {t.scan.manualSubmit}
          </Button>
        </div>

        {draft.supplierLotMissing ? (
          <>
            <AlertBanner variant="info" title={t.scan.missingChosen} />
            <div className="receipt__field">
              <label htmlFor="receipt-reason">{t.scan.reasonLabel}</label>
              <Select
                id="receipt-reason"
                placeholder={t.scan.reasonPlaceholder}
                size="xl"
                value={draft.substituteLotReasonCode === '' ? null : draft.substituteLotReasonCode}
                onChange={(value) => {
                  patch({ substituteLotReasonCode: String(value) });
                }}
                options={(reasons.data ?? []).map((each) => ({
                  value: each.code,
                  label: each.name,
                }))}
              />
              {reasons.isError ? <p className="receipt__note">{t.scan.reasonLoadFailed}</p> : null}
            </div>
            <Button
              variant="text"
              size="lg"
              onClick={() => {
                patch({ supplierLotMissing: false, substituteLotReasonCode: '' });
              }}
            >
              {t.scan.back}
            </Button>
          </>
        ) : draft.supplierLotNo === '' ? (
          <Button
            className="receipt__wide"
            variant="outlined"
            size="xl"
            onClick={() => {
              setMalformed(null);
              patch({ supplierLotNo: '', supplierLotMissing: true });
            }}
          >
            {t.scan.missing}
          </Button>
        ) : (
          <p className="receipt__note">{t.scan.scanned(draft.supplierLotNo)}</p>
        )}
      </section>

      {!started ? null : (
        <>
          <section className="receipt__section">
            <h2>{t.po.legend}</h2>
            {/* 번호만으로는 어느 발주 물품인지 확정되지 않는다. 담당자가 고른다. */}
            <p className="receipt__note">{t.po.pickNote}</p>
            {orders.isPending ? <p role="status">{t.po.loading}</p> : null}
            {orders.isError ? <AlertBanner variant="error" title={t.po.loadFailed} /> : null}
            {orders.data !== undefined && orders.data.length === 0 ? (
              <p className="receipt__note">{t.po.none}</p>
            ) : null}
            {orders.data === undefined ? null : (
              <div className="receipt__field">
                <label htmlFor="receipt-po">{t.po.selectLabel}</label>
                <Select
                  id="receipt-po"
                  placeholder={t.po.selectLabel}
                  size="xl"
                  value={
                    draft.purchaseOrder === null
                      ? null
                      : String(draft.purchaseOrder.purchaseOrderId)
                  }
                  onChange={(value) => {
                    const picked = (orders.data as PurchaseOrder[]).find(
                      (each) => each.purchaseOrderId === Number(value),
                    );
                    /*
                     * 발주를 고르면 무발주 갈래를 접는다. 둘이 함께 서 있으면 고른 발주는
                     * 판정에 쓰이는데 실려 나가는 것은 손으로 고른 값이라, 화면이 보이는
                     * 것과 서버에 남는 것이 달라진다.
                     */
                    patch({
                      purchaseOrder: picked ?? null,
                      purchaseOrderLine: null,
                      unordered: false,
                      supplierId: null,
                      itemId: null,
                      uomId: null,
                    });
                  }}
                  options={orders.data.map((each) => ({
                    value: String(each.purchaseOrderId),
                    label: each.purchaseOrderNo,
                  }))}
                />
              </div>
            )}

            {draft.purchaseOrder === null ? null : (
              <>
                {lines.isPending ? <p role="status">{t.po.linesLoading}</p> : null}
                {lines.isError ? (
                  <AlertBanner variant="error" title={t.po.linesLoadFailed} />
                ) : null}
                {lines.data !== undefined && lines.data.length === 0 ? (
                  <AlertBanner variant="warning" title={t.po.linesNone} />
                ) : null}
                <ul className="receipt__lines">
                  {(lines.data ?? []).map((line: PurchaseOrderLine) => (
                    <li key={line.purchaseOrderLineId}>
                      <Button
                        className="receipt__wide"
                        variant={
                          draft.purchaseOrderLine?.purchaseOrderLineId === line.purchaseOrderLineId
                            ? 'filled'
                            : 'outlined'
                        }
                        size="xl"
                        onClick={() => {
                          patch({ purchaseOrderLine: line });
                        }}
                      >
                        <span className="receipt__line">
                          <span>
                            {t.po.lineLabel(
                              itemLabelOf(line.itemId),
                              String(line.orderedQty),
                              uoms.data?.get(line.uomId) ?? '',
                            )}
                          </span>
                          <span>{t.po.received(String(line.receivedQty))}</span>
                          <span>
                            {t.po.tolerance(
                              String(line.toleranceOverQty),
                              String(line.toleranceUnderQty),
                            )}
                          </span>
                        </span>
                      </Button>
                    </li>
                  ))}
                </ul>
                <Button
                  variant="text"
                  size="lg"
                  onClick={() => {
                    patch({ purchaseOrder: null, purchaseOrderLine: null });
                  }}
                >
                  {t.po.clear}
                </Button>
              </>
            )}
            {/* 발주가 없으면 승계할 곳이 없어 담당자가 고른다. 고르지 않은 것과는 다른 상태다. */}
            {draft.unordered ? null : (
              <Button
                variant="text"
                size="lg"
                onClick={() => {
                  patch({
                    unordered: true,
                    purchaseOrder: null,
                    purchaseOrderLine: null,
                  });
                }}
              >
                {t.exception.open}
              </Button>
            )}
          </section>

          {draft.unordered ? (
            <section className="receipt__section">
              <h2>{t.exception.legend}</h2>
              <p className="receipt__note">{t.exception.openNote}</p>

              {plantId === null ? (
                <AlertBanner variant="error" title={t.exception.noPlant} />
              ) : null}

              {suppliers.isPending ? <p role="status">{t.exception.supplierLoading}</p> : null}
              {suppliers.isError ? (
                <AlertBanner variant="error" title={t.exception.supplierLoadFailed} />
              ) : null}
              {suppliers.data !== undefined && suppliers.data.length === 0 ? (
                <AlertBanner variant="warning" title={t.exception.supplierNone} />
              ) : null}
              {suppliers.data === undefined || suppliers.data.length === 0 ? null : (
                <div className="receipt__field">
                  <label htmlFor="receipt-supplier">{t.exception.supplierLabel}</label>
                  <Select
                    id="receipt-supplier"
                    placeholder={t.exception.supplierPlaceholder}
                    size="xl"
                    value={draft.supplierId === null ? null : String(draft.supplierId)}
                    onChange={(value) => {
                      patch({ supplierId: Number(value) });
                    }}
                    options={suppliers.data.map((each) => ({
                      value: String(each.partnerId),
                      label: each.partnerName,
                    }))}
                  />
                </div>
              )}

              {itemLabels.isError ? (
                <AlertBanner variant="error" title={t.exception.itemLoadFailed} />
              ) : null}
              {itemLabels.data === undefined ? null : (
                <div className="receipt__field">
                  <label htmlFor="receipt-item">{t.exception.itemLabel}</label>
                  <Select
                    id="receipt-item"
                    placeholder={t.exception.itemPlaceholder}
                    size="xl"
                    value={draft.itemId === null ? null : String(draft.itemId)}
                    onChange={(value) => {
                      patch({ itemId: Number(value) });
                    }}
                    options={[...itemLabels.data].map(([itemId, label]) => ({
                      value: String(itemId),
                      label: `${label.itemCode} ${label.itemName}`,
                    }))}
                  />
                </div>
              )}
              {/* 품목 마스터의 주인은 ERP 다. 여기서 만들 길을 찾지 않는다. */}
              <AlertBanner variant="info" title={t.exception.itemUnregistered}>
                {t.exception.itemUnregisteredWhy}
              </AlertBanner>

              {uoms.isError ? (
                <AlertBanner variant="error" title={t.exception.uomLoadFailed} />
              ) : null}
              {uoms.data === undefined ? null : (
                <div className="receipt__field">
                  <label htmlFor="receipt-uom">{t.exception.uomLabel}</label>
                  <Select
                    id="receipt-uom"
                    placeholder={t.exception.uomPlaceholder}
                    size="xl"
                    value={draft.uomId === null ? null : String(draft.uomId)}
                    onChange={(value) => {
                      patch({ uomId: Number(value) });
                    }}
                    options={[...uoms.data].map(([uomId, code]) => ({
                      value: String(uomId),
                      label: code,
                    }))}
                  />
                </div>
              )}

              {/* 예정 수량이 없어 견줄 것이 없다. 판정하지 않는다는 사실을 말한다. */}
              <p className="receipt__note">{t.exception.noVerdict}</p>

              <Button
                variant="text"
                size="lg"
                onClick={() => {
                  patch({ unordered: false, supplierId: null, itemId: null, uomId: null });
                }}
              >
                {t.exception.close}
              </Button>
            </section>
          ) : null}

          <section className="receipt__section">
            <h2>{t.note.legend}</h2>
            <p className="receipt__note">{t.note.photoAbsent}</p>
            <TextField
              label={t.note.label}
              size="xl"
              fullWidth
              value={draft.deliveryNoteNo}
              onChange={(event) => {
                patch({ deliveryNoteNo: event.target.value });
              }}
            />
            {draft.deliveryNoteNo.trim() === '' ? (
              <AlertBanner variant="warning" title={t.note.absent} />
            ) : null}
          </section>

          {draft.purchaseOrderLine === null &&
          !(draft.unordered && draft.itemId !== null) ? null : (
            <section className="receipt__section">
              <h2>{t.qty.legend}</h2>
              <Card bordered>
                <Card.Body className="card-body receipt__card">
                  <strong>
                    {item.data === undefined
                      ? String(draft.itemId ?? draft.purchaseOrderLine?.itemId ?? '')
                      : `${item.data.itemCode} ${item.data.itemName}`}
                  </strong>
                  {item.isError ? <p className="receipt__note">{t.qty.itemLoadFailed}</p> : null}
                  {/* 발주가 없으면 예정 수량이 없다. 없는 것을 0 으로 보이지 않는다. */}
                  {draft.purchaseOrderLine === null ? null : (
                    <p>{t.qty.ordered(String(draft.purchaseOrderLine.orderedQty), uom)}</p>
                  )}
                </Card.Body>
              </Card>

              <TextField
                label={t.qty.received}
                inputMode="decimal"
                size="xl"
                fullWidth
                value={draft.receivedQty}
                onChange={(event) => {
                  patch({ receivedQty: event.target.value });
                }}
                error={qtyMessage()}
              />
              <NumberPad
                value={draft.receivedQty}
                onChange={(value) => {
                  patch({ receivedQty: value });
                }}
                allowDecimal
              />

              <TextField
                label={t.qty.packageCount}
                inputMode="numeric"
                size="xl"
                fullWidth
                value={draft.packageCount}
                onChange={(event) => {
                  patch({ packageCount: event.target.value });
                }}
                error={
                  packageProblem(draft.packageCount) === null ? undefined : t.qty.packageNotPositive
                }
              />

              <div className="receipt__row">
                <TextField
                  type="date"
                  label={t.qty.manufactured}
                  size="xl"
                  fullWidth
                  value={draft.manufacturedDate}
                  onChange={(event) => {
                    patch({ manufacturedDate: event.target.value });
                  }}
                />
                <TextField
                  type="date"
                  label={t.qty.expiry}
                  size="xl"
                  fullWidth
                  value={draft.expiryDate}
                  onChange={(event) => {
                    patch({ expiryDate: event.target.value });
                  }}
                  error={
                    isExpiryBeforeManufactured(draft.manufacturedDate, draft.expiryDate)
                      ? t.qty.expiryBeforeManufactured
                      : undefined
                  }
                />
              </div>

              {/* 판정 결과를 먼저 보인 뒤에 넘긴다. 조용히 넘기면 왜 왔는지 알 수 없다. */}
              {verdict === null || draft.purchaseOrderLine === null ? null : verdict === NORMAL ? (
                <AlertBanner variant="success" title={t.verdict.normal} />
              ) : verdict === OVER ? (
                <AlertBanner
                  variant="warning"
                  title={t.verdict.over(
                    String(remainingQtyOf(draft.purchaseOrderLine, queuedQty)),
                    String(received),
                  )}
                >
                  {t.verdict.overNext}
                </AlertBanner>
              ) : (
                <AlertBanner
                  variant="warning"
                  title={t.verdict.under(
                    String(remainingQtyOf(draft.purchaseOrderLine, queuedQty)),
                    String(received),
                  )}
                >
                  <dl className="receipt__counts">
                    <dt>{t.verdict.counts.ordered}</dt>
                    <dd>{`${String(draft.purchaseOrderLine.orderedQty)} ${uom}`}</dd>
                    <dt>{t.verdict.counts.received}</dt>
                    <dd>{`${String(draft.purchaseOrderLine.receivedQty)} ${uom}`}</dd>
                    <dt>{t.verdict.counts.arrived}</dt>
                    <dd>{`${String(received)} ${uom}`}</dd>
                    <dt>{t.verdict.counts.remaining}</dt>
                    <dd>{`${String(remainingQtyOf(draft.purchaseOrderLine, queuedQty))} ${uom}`}</dd>
                  </dl>
                  <p>{t.verdict.underAsk}</p>
                  <div className="receipt__under-choice">
                    <Button
                      variant={continueUnder ? 'filled' : 'outlined'}
                      size="xl"
                      onClick={() => {
                        setContinueUnder(true);
                      }}
                    >
                      {t.verdict.underContinue}
                    </Button>
                    <Link to="/inbound-variance" className="receipt__under-link">
                      {t.verdict.underVariance}
                    </Link>
                  </div>
                  <p>{continueUnder ? t.verdict.underContinueNote : t.verdict.underVarianceNote}</p>
                </AlertBanner>
              )}

              <p className="receipt__note">{t.inspectionNote}</p>
            </section>
          )}

          <section className="receipt__section">
            {saveFailed ? (
              <AlertBanner variant="error" title={t.saveFailed.title}>
                {t.saveFailed.description}
              </AlertBanner>
            ) : null}
            {worker === null ? <p className="receipt__note">{t.noWorker}</p> : null}
            <Button
              className="receipt__wide"
              variant="filled"
              size="2xl"
              disabled={!ready}
              onClick={() => void submit()}
            >
              {t.submit}
            </Button>
          </section>
        </>
      )}
    </div>
  );
};
