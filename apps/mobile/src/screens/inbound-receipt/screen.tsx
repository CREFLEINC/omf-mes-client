import { AlertBanner, Button, Card, Chip, Select, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { Fragment } from 'react';
import { Link, useNavigate } from 'react-router';

import { ScanReplaceDialog } from '../../patterns/scan-replace-dialog';
import { useScreenTitle } from '../../patterns/screen-title';
import { displayNameOf } from '../../patterns/code-values';
import { DockedNumberPad } from '../../patterns/docked-number-pad';
import { FailureBanner } from '../../patterns/failure-banner';
import { useLoadFailure } from '../../patterns/load-failure';
import {
  NORMAL,
  OVER,
  isExpiryBeforeManufactured,
  LINE_SCOPED_BLANK,
  openLinesFirst,
  packageProblem,
  remainingAfterOf,
  remainingQtyOf,
  type PurchaseOrder,
  type PurchaseOrderLine,
} from './receipt';
import { useReceiptFlow } from './use-receipt-flow';
import { ItemPicker } from '../../patterns/item-picker';
import './screen.css';

const t = messages.inboundReceipt;
/* 필수 표시는 화면마다 짓지 않는다. 같은 뜻이 여러 모양으로 갈린다. */
const required = messages.common.required;
/* 비워도 되는 칸임을 라벨이 말한다 — 필수와 같은 자리·같은 모양이라 둘이 눈에 갈린다. */
const optional = messages.common.optional;

/**
 * 거래명세서 구역을 화면에 세울 것인가 — **지금은 감춘다**(사용자 지시 2026-09-19 ·
 * omf-all-around#34).
 *
 * ⛔ **지우지 않는다.** 현장에서 다시 쓰기로 하면 이 값만 `true` 로 되돌리면 된다 — 문구
 *    (i18n)도, 본문에 값을 싣는 자리(`receipt.ts` 의 `deliveryNoteNo` · `vehicleNo`)도 그대로
 *    두었다.
 *
 * ⚠ **구역 제목이 「거래명세서」라 그 안의 차량번호도 함께 감춘다**(사용자 결정). 두 칸 모두
 *   선택 입력이라 비어도 등록은 막히지 않고, 값이 없으면 본문에 실리지도 않는다(`optional`).
 */
const SHOW_DELIVERY_NOTE = false;

/*
 * 상태·판정·제출은 `useReceiptFlow` 가 들고 있다. 이 화면은 그 값을 그린다.
 */
export const InboundReceiptScreen = () => {
  useScreenTitle(t.title);
  const failureText = useLoadFailure();

  const navigate = useNavigate();
  const {
    worker,
    draft,
    malformed,
    setMalformed,
    registeredLotNo,
    setRegisteredLotNo,
    externalLotInput,
    setExternalLotInput,
    externalLotNo,
    setExternalLotNo,
    externalLotError,
    setExternalLotError,
    outcome,
    recorded,
    continueUnder,
    setContinueUnder,
    varianceNext,
    setVarianceNext,
    splitExceptionType,
    setSplitExceptionType,
    splitExceptionReason,
    setSplitExceptionReason,
    saveFailed,
    keypadFor,
    setKeypadFor,
    setShowAllOrders,
    poSection,
    qtySection,
    patch,
    pickLine,
    takeExternalLot,
    scanField,
    scannedCode,
    scannedItem,
    orders,
    itemCheck,
    strictLabel,
    candidates,
    narrowed,
    narrowedWithCandidates,
    lines,
    reasons,
    exceptionTypes,
    item,
    uoms,
    suppliers,
    pickingItem,
    setPickingItem,
    plantId,
    started,
    received,
    queuedFor,
    queuedQty,
    verdict,
    splitQuantities,
    labelMismatch,
    labelUnverified,
    labelChecking,
    lock,
    ready,
    splitReady,
    varianceReady,
    uomOf,
    uom,
    itemPartsOf,
    qtyMessage,
    restart,
    submit,
  } = useReceiptFlow();

  /*
   * 찾는 동안에는 폼을 접고 화면을 내준다. 스캔한 번호와 고른 자재 P/O 는 이 화면의 상태라
   * 그대로 남는다 - 다른 주소로 나갔다 오면 그것들이 사라진다.
   */
  if (pickingItem) {
    return (
      <ItemPicker
        onPick={(picked) => {
          /* 품목이 바뀌면 수량도 그 품목의 것이 아니다 - 라인을 바꿀 때와 같은 이유로 비운다. */
          patch(
            picked.itemId === draft.itemId
              ? { itemId: picked.itemId }
              : { itemId: picked.itemId, ...LINE_SCOPED_BLANK },
          );
          setPickingItem(false);
        }}
        onCancel={() => {
          setPickingItem(false);
        }}
      />
    );
  }

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
            {varianceNext ? ` ${t.queued.varianceLater}` : ''}
          </AlertBanner>
        ) : null}
        {/* 오류는 입하 라인에 달린다. 받아 둔 뒤에야 붙일 자리가 생긴다. */}
        {varianceNext && outcome === 'sent' ? (
          <Button
            className="receipt__wide"
            variant="filled"
            size="2xl"
            onClick={() => void navigate('/inbound-variance')}
          >
            {t.sent.toVariance}
          </Button>
        ) : null}
        {outcome === 'rejected' ? (
          <AlertBanner variant="error" title={t.rejected.title}>
            {t.rejected.description}
            <Link to="/rejections">{t.rejected.action}</Link>
          </AlertBanner>
        ) : null}
        {/*
         * ⭐ **적은 값을 등록 뒤에 다시 보인다**(현장 요청 2026-09-21). 전에는 띠와 「다음
         *    입하」 단추뿐이라, 같은 자재 P/O 의 자재를 여러 번 넣을 때 앞 자재를 무엇으로
         *    얼마나 넣었는지 되짚을 곳이 화면에 없었다.
         *
         * 되돌아온 건(`rejected`)에는 세우지 않는다 - 등록되지 않은 값을 등록한 내용으로
         * 보이면 사람이 들어간 줄 안다.
         */}
        {recorded === null || outcome === 'rejected' ? null : (
          <section className="receipt__section">
            <h2>{t.recorded.legend}</h2>
            <dl className="receipt__counts">
              {recorded.purchaseOrderNo === null ? null : (
                <>
                  <dt>{t.recorded.purchaseOrder}</dt>
                  <dd>
                    {recorded.lineNo === null
                      ? recorded.purchaseOrderNo
                      : `${recorded.purchaseOrderNo} · ${t.recorded.line(String(recorded.lineNo))}`}
                  </dd>
                </>
              )}
              <dt>{t.recorded.item}</dt>
              <dd>
                {item.data === undefined
                  ? t.po.itemUnknown
                  : `${item.data.itemCode} ${item.data.itemName}`}
              </dd>
              {recorded.parts.map((each) => (
                <Fragment key={each.part ?? 'only'}>
                  <dt>
                    {each.part === null
                      ? t.recorded.qty
                      : each.part === 'normal'
                        ? t.recorded.normalQty
                        : t.recorded.excessQty}
                  </dt>
                  <dd>{`${String(each.receivedQty)} ${uomOf(recorded.uomId)}`}</dd>
                </Fragment>
              ))}
              {recorded.parts[0]?.packageCount == null ? null : (
                <>
                  <dt>{t.recorded.packageCount}</dt>
                  <dd>{String(recorded.parts[0].packageCount)}</dd>
                </>
              )}
              <dt>{t.recorded.lotNo}</dt>
              <dd>
                {recorded.supplierLotMissing
                  ? `${t.recorded.lotMissing} · ${displayNameOf(
                      reasons.data ?? [],
                      recorded.substituteLotReasonCode ?? '',
                    )}`
                  : (recorded.supplierLotNo ?? t.recorded.none)}
              </dd>
              {recorded.manufacturedDate === null ? null : (
                <>
                  <dt>{t.recorded.manufactured}</dt>
                  <dd>{recorded.manufacturedDate}</dd>
                </>
              )}
              {recorded.expiryDate === null ? null : (
                <>
                  <dt>{t.recorded.expiry}</dt>
                  <dd>{recorded.expiryDate}</dd>
                </>
              )}
            </dl>
          </section>
        )}
        <Button className="receipt__wide" variant="filled" size="2xl" onClick={restart}>
          {t.another}
        </Button>
      </div>
    );
  }

  return (
    <div className={keypadFor === null ? 'receipt' : 'receipt docked-pad-open'}>
      <section className="receipt__section">
        <h2>{t.scan.legend}</h2>
        <TextField
          ref={scanField.ref}
          label={t.scan.label}
          placeholder={t.scan.placeholder}
          size="xl"
          fullWidth
          error={
            malformed !== null
              ? t.scan.malformed(malformed)
              : registeredLotNo !== null
                ? t.scan.registered(registeredLotNo)
                : undefined
          }
        />
        {/*
         * 스캔 칸 하나로 받는다. 스캐너를 기다리는 동안에는 키보드를 열지 않고, 직접
         * 입력을 누르면 그 칸이 열린다. 치는 도중 스캔이 오면 스캔값이 이긴다.
         */}
        {/*
         * ⭐ **직접 입력과 되돌리기를 한 줄에 나란히 둔다**(사용자 지시 2026-09-19 ·
         *    omf-all-around#34). 세로로 쌓으면 스캔 칸과 아래 구획 사이가 단추로 메워진다.
         *
         * ⛔ **「공급사 LOT 번호가 없습니다」 띠를 세우지 않는다**(같은 지시). 고른 사람이 방금
         *    누른 것을 되풀이해 말할 뿐이고, 사유 선택칸이 아래에서 같은 사실을 이미 말한다.
         *
         * ⭐ **사유 입력은 여기 두지 않는다.** 고른 뒤 발주·수량을 거쳐 화면을 한참 내려가
         *    등록하는데, 그 사이 사유는 화면 밖으로 밀려난다 — 등록 단추 바로 위로 옮겼다.
         */}
        <div className="receipt__row">
          {scanField.manual ? (
            <Button variant="outlined" size="xl" onClick={scanField.submitManual}>
              {t.scan.manualSubmit}
            </Button>
          ) : (
            <Button variant="text" size="xl" onClick={scanField.openManual}>
              {t.scan.manualLabel}
            </Button>
          )}
          {draft.supplierLotMissing ? (
            <Button
              variant="text"
              size="xl"
              onClick={() => {
                patch({
                  supplierLotMissing: false,
                  supplierLotLabelAttached: true,
                  substituteLotReasonCode: '',
                });
              }}
            >
              {t.scan.back}
            </Button>
          ) : null}
        </div>

        {draft.supplierLotMissing ? null : draft.supplierLotNo === '' ? (
          <>
            {externalLotInput ? (
              <div className="receipt__field">
                <TextField
                  label={t.scan.externalLabel}
                  placeholder={t.scan.externalPlaceholder}
                  size="xl"
                  fullWidth
                  value={externalLotNo}
                  error={externalLotError ?? undefined}
                  onChange={(event) => {
                    setExternalLotNo(event.target.value);
                    setExternalLotError(null);
                  }}
                />
                <Button
                  className="receipt__wide"
                  variant="filled"
                  size="xl"
                  onClick={takeExternalLot}
                >
                  {t.scan.externalSubmit}
                </Button>
              </div>
            ) : (
              <Button
                className="receipt__wide"
                variant="outlined"
                size="xl"
                onClick={() => {
                  setMalformed(null);
                  setRegisteredLotNo(null);
                  setExternalLotError(null);
                  setExternalLotInput(true);
                }}
              >
                {t.scan.externalEntry}
              </Button>
            )}
            <Button
              className="receipt__wide"
              variant="outlined"
              size="xl"
              onClick={() => {
                setMalformed(null);
                setRegisteredLotNo(null);
                setExternalLotInput(false);
                setExternalLotError(null);
                patch({
                  supplierLotNo: '',
                  supplierLotMissing: true,
                  supplierLotLabelAttached: false,
                });
              }}
            >
              {t.scan.missing}
            </Button>
          </>
        ) : (
          <p className="receipt__note">
            {draft.supplierLotLabelAttached
              ? t.scan.scanned(draft.supplierLotNo)
              : t.scan.externalTaken(draft.supplierLotNo)}
          </p>
        )}
      </section>

      {!started ? null : (
        <>
          <section className="receipt__section" ref={poSection}>
            <h2>{t.po.legend}</h2>
            {/* 번호만으로는 어느 발주 물품인지 확정되지 않는다. 담당자가 고른다. */}
            {narrowedWithCandidates ? (
              <p className="receipt__note">{t.po.narrowedNote}</p>
            ) : candidates === null || narrowed ? null : (
              <p className="receipt__note">{t.po.pickNote}</p>
            )}
            {itemCheck === 'pending' ? <p role="status">{t.po.itemChecking}</p> : null}
            {itemCheck === 'failed' && strictLabel ? (
              <FailureBanner
                variant="error"
                title={failureText(scannedItem.error, t.po.itemCheckFailed)}
              />
            ) : null}
            {itemCheck === 'unknown' && strictLabel && scannedCode !== null ? (
              <AlertBanner variant="warning" title={t.po.itemNotFound(scannedCode)} />
            ) : null}
            {candidates?.isPending ? <p role="status">{t.po.loading}</p> : null}
            {candidates?.isError ? (
              <FailureBanner
                variant="error"
                title={failureText(candidates.error, t.po.loadFailed)}
              />
            ) : null}
            {candidates?.isSuccess && candidates.data.length === 0 ? (
              narrowed && strictLabel && scannedCode !== null ? (
                <AlertBanner variant="warning" title={t.po.noneForItem(scannedCode)} />
              ) : (
                <p className="receipt__note">{t.po.none}</p>
              )
            ) : null}
            {candidates === null ||
            orders.data === undefined ||
            (narrowed && orders.data.length === 0) ? null : (
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
                      exceptionTypeCode: '',
                      exceptionReason: '',
                      ...LINE_SCOPED_BLANK,
                    });
                  }}
                  options={orders.data.map((each) => ({
                    value: String(each.purchaseOrderId),
                    label: each.purchaseOrderNo,
                  }))}
                />
              </div>
            )}

            {/*
             * 좁힌 것이 틀릴 수 있다. 번호 양식이 다르거나 다른 품목으로 들어온 물건이면
             * 후보에 없다 - 막지 않고 전체로 넓힐 길을 둔다(화면 스펙 §3 · §6).
             */}
            {narrowedWithCandidates ? (
              <Button
                className="receipt__wide"
                variant="text"
                size="xl"
                onClick={() => {
                  setShowAllOrders(true);
                  patch({ purchaseOrder: null, purchaseOrderLine: null, ...LINE_SCOPED_BLANK });
                }}
              >
                {t.po.showAll}
              </Button>
            ) : null}

            {draft.purchaseOrder === null ? null : (
              <>
                {lines.isPending ? <p role="status">{t.po.linesLoading}</p> : null}
                {lines.isError ? (
                  <AlertBanner variant="error" title={t.po.linesLoadFailed} />
                ) : null}
                {lines.isSuccess && lines.data.length === 0 ? (
                  <AlertBanner variant="warning" title={t.po.linesNone} />
                ) : null}
                <ul className="receipt__lines">
                  {openLinesFirst(lines.data ?? [], queuedFor).map((line: PurchaseOrderLine) => {
                    /* 표시와 표식이 갈리지 않게 한 번만 센다. */
                    const lineRemaining = remainingQtyOf(line, queuedFor(line.purchaseOrderLineId));

                    return (
                      <li key={line.purchaseOrderLineId}>
                        <Card
                          bordered
                          interactive
                          onClick={() => {
                            pickLine(line);
                          }}
                        >
                          <Card.Body className="card-body receipt__line">
                            {/* ⭐ 코드와 이름을 각자의 줄에 적는다(사용자 지시 2026-09-19). */}
                            {itemPartsOf(line.itemId) === null ? (
                              <strong>{t.po.itemUnknown}</strong>
                            ) : (
                              <>
                                <strong>
                                  {t.po.lineItemCode(itemPartsOf(line.itemId)?.code ?? '')}
                                </strong>
                                <p>{t.po.lineItemName(itemPartsOf(line.itemId)?.name ?? '')}</p>
                              </>
                            )}
                            <p>{t.po.lineOrdered(String(line.orderedQty), uomOf(line.uomId))}</p>
                            <p>{t.po.received(String(line.receivedQty))}</p>
                            {/*
                             * 후보 목록은 발주 단위라 그 품목의 라인이 다 찬 발주도 선다.
                             * 견주는 수를 카드가 직접 말하지 않으면 발주량대로 적게 된다.
                             *
                             * ⭐ **발주량과 같으면 세우지 않는다**(사용자 지시 2026-09-19) — 같은
                             *    수를 두 번 말할 뿐이고, 그때는 발주량대로 적는 것이 맞다.
                             */}
                            {lineRemaining === line.orderedQty ? null : (
                              <p>
                                {t.po.lineRemaining(String(lineRemaining))}
                                {lineRemaining > 0 ? null : (
                                  <>
                                    {' · '}
                                    <strong>{t.po.lineClosed}</strong>
                                  </>
                                )}
                              </p>
                            )}
                            <p>
                              {t.po.tolerance(
                                String(line.toleranceOverQty),
                                String(line.toleranceUnderQty),
                              )}
                            </p>
                            {draft.purchaseOrderLine?.purchaseOrderLineId ===
                            line.purchaseOrderLineId ? (
                              <Chip status="success">{t.po.linePicked}</Chip>
                            ) : null}
                          </Card.Body>
                        </Card>
                      </li>
                    );
                  })}
                </ul>
                <Button
                  variant="text"
                  size="lg"
                  onClick={() => {
                    patch({ purchaseOrder: null, purchaseOrderLine: null, ...LINE_SCOPED_BLANK });
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
                    exceptionTypeCode: '',
                    exceptionReason: '',
                    ...LINE_SCOPED_BLANK,
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
              {suppliers.isSuccess && suppliers.data.length === 0 ? (
                <AlertBanner variant="warning" title={t.exception.supplierNone} />
              ) : null}
              {suppliers.data === undefined || suppliers.data.length === 0 ? null : (
                <div className="receipt__field">
                  <label htmlFor="receipt-supplier">{required(t.exception.supplierLabel)}</label>
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

              {/*
                마스터가 9,000건인 곳이 있어 목록으로 늘어놓지 않는다. 앞에서 잘린 목록을
                보이면 있는 품목이 없는 것으로 읽혀, 고르지 못하고도 이유를 알 수 없다.
              */}
              <div className="receipt__field">
                <p>{required(t.exception.itemLabel)}</p>
                {draft.itemId === null || item.data === undefined ? (
                  <p className="receipt__note">{t.exception.itemNone}</p>
                ) : (
                  <p>
                    <strong>{`${item.data.itemCode} ${item.data.itemName}`}</strong>
                  </p>
                )}
                <Button
                  variant="outlined"
                  size="xl"
                  className="receipt__wide"
                  onClick={() => {
                    setPickingItem(true);
                  }}
                >
                  {draft.itemId === null ? t.exception.itemPick : t.exception.itemChange}
                </Button>
              </div>
              {/* 품목 마스터의 주인은 ERP 다. 여기서 만들 길을 찾지 않는다. */}
              <AlertBanner variant="info" title={t.exception.itemUnregistered}>
                {t.exception.itemUnregisteredWhy}
              </AlertBanner>

              {uoms.isError ? (
                <AlertBanner variant="error" title={t.exception.uomLoadFailed} />
              ) : null}
              {uoms.data === undefined ? null : (
                <div className="receipt__field">
                  <label htmlFor="receipt-uom">{required(t.exception.uomLabel)}</label>
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

              <div className="receipt__field">
                <label htmlFor="receipt-unordered-exception-type">
                  {required(t.exception.typeLabel)}
                </label>
                <Select
                  id="receipt-unordered-exception-type"
                  placeholder={t.exception.typePlaceholder}
                  size="xl"
                  value={draft.exceptionTypeCode === '' ? null : draft.exceptionTypeCode}
                  onChange={(value) => {
                    patch({ exceptionTypeCode: String(value) });
                  }}
                  options={(exceptionTypes.data ?? []).map((each) => ({
                    value: each.code,
                    label: each.name,
                  }))}
                />
                {exceptionTypes.isError ? (
                  <p className="receipt__note">{t.exception.typeLoadFailed}</p>
                ) : null}
              </div>
              <TextField
                label={required(t.exception.reasonLabel)}
                size="xl"
                fullWidth
                value={draft.exceptionReason}
                onChange={(event) => {
                  patch({ exceptionReason: event.target.value });
                }}
              />

              {/* 예정 수량이 없어 견줄 것이 없다. 판정하지 않는다는 사실을 말한다. */}
              <p className="receipt__note">{t.exception.noVerdict}</p>

              <Button
                variant="text"
                size="lg"
                onClick={() => {
                  patch({
                    unordered: false,
                    supplierId: null,
                    itemId: null,
                    uomId: null,
                    exceptionTypeCode: '',
                    exceptionReason: '',
                  });
                }}
              >
                {t.exception.close}
              </Button>
            </section>
          ) : null}

          {!SHOW_DELIVERY_NOTE ? null : (
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

              <TextField
                label={t.note.vehicle}
                size="xl"
                fullWidth
                value={draft.vehicleNo}
                onChange={(event) => {
                  patch({ vehicleNo: event.target.value });
                }}
              />
              {draft.deliveryNoteNo.trim() === '' ? (
                <AlertBanner variant="warning" title={t.note.absent} />
              ) : null}
            </section>
          )}

          {draft.purchaseOrderLine === null &&
          !(draft.unordered && draft.itemId !== null) ? null : (
            <section className="receipt__section" ref={qtySection}>
              <h2>{t.qty.legend}</h2>
              <Card bordered>
                <Card.Body className="card-body receipt__card">
                  {/* ⭐ 여기서도 코드와 이름을 각자의 줄에 적는다(사용자 지시 2026-09-19). */}
                  {item.data === undefined ? (
                    <strong>{t.po.itemUnknown}</strong>
                  ) : (
                    <>
                      <strong>{t.qty.itemCode(item.data.itemCode)}</strong>
                      <p>{t.qty.itemName(item.data.itemName)}</p>
                    </>
                  )}
                  {item.isError ? <p className="receipt__note">{t.qty.itemLoadFailed}</p> : null}
                  {/*
                   * 발주가 없으면 견줄 수량이 없다. 없는 것을 0 으로 보이지 않는다.
                   *
                   * 판정이 견주는 것은 발주 총량이 아니라 남은 예정이다. 총량만 칸 옆에 두면
                   * 적는 사람이 그 수에 맞추려 하고, 판정은 다른 수로 나온다.
                   */}
                  {draft.purchaseOrderLine === null ? null : (
                    <>
                      <p>{t.qty.ordered(String(draft.purchaseOrderLine.orderedQty), uom)}</p>
                      {/* ⭐ 발주량과 같으면 세우지 않는다 — 같은 수를 두 번 말할 뿐이다. */}
                      {remainingQtyOf(draft.purchaseOrderLine, queuedQty) ===
                      draft.purchaseOrderLine.orderedQty ? null : (
                        <p>
                          <strong>
                            {t.qty.remaining(
                              String(remainingQtyOf(draft.purchaseOrderLine, queuedQty)),
                              uom,
                            )}
                          </strong>
                        </p>
                      )}
                    </>
                  )}
                </Card.Body>
              </Card>

              {/*
               * 숫자판은 고른 칸 바로 아래에 붙는다 - 부품의 골격이 포커스 연동 버퍼다
               * (공유계약 D-4). 어느 칸에 들어가는지는 자리로 보인다. 늘 띄워 두면 그것이
               * 흐려지고, 칸마다 하나씩 두면 큰 판이 둘이 되어 아래 칸을 화면 밖으로 민다.
               */}
              <div className="receipt__keypad-group">
                <div className="receipt__qty-field">
                  <TextField
                    id="receipt-received-qty"
                    label={required(t.qty.received)}
                    inputMode="none"
                    size="xl"
                    fullWidth
                    value={draft.receivedQty}
                    onChange={(event) => {
                      patch({ receivedQty: event.target.value });
                    }}
                    onFocus={() => {
                      setKeypadFor('received');
                    }}
                    error={qtyMessage()}
                  />
                </div>

                <div className="receipt__qty-field">
                  <TextField
                    id="receipt-package-count"
                    label={t.qty.packageCount}
                    inputMode="none"
                    size="xl"
                    fullWidth
                    value={draft.packageCount}
                    onChange={(event) => {
                      patch({ packageCount: event.target.value });
                    }}
                    onFocus={() => {
                      setKeypadFor('package');
                    }}
                    error={
                      packageProblem(draft.packageCount) === null
                        ? undefined
                        : t.qty.packageNotPositive
                    }
                  />
                </div>
              </div>

              <div className="receipt__row receipt__row--split">
                <TextField
                  type="date"
                  label={optional(t.qty.manufactured)}
                  size="xl"
                  fullWidth
                  value={draft.manufacturedDate}
                  onChange={(event) => {
                    patch({ manufacturedDate: event.target.value });
                  }}
                />
                <TextField
                  type="date"
                  label={optional(t.qty.expiry)}
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
                <>
                  <AlertBanner
                    variant="warning"
                    title={t.verdict.over(
                      String(remainingQtyOf(draft.purchaseOrderLine, queuedQty)),
                      String(received),
                    )}
                  >
                    {t.verdict.overNext}
                  </AlertBanner>
                  {splitQuantities === null ? null : (
                    <section className="receipt__split">
                      <h2>{t.verdict.split.legend}</h2>
                      <dl className="receipt__counts">
                        <dt>{t.verdict.split.remaining}</dt>
                        <dd>{`${String(splitQuantities.remaining)} ${uom}`}</dd>
                        <dt>{t.verdict.split.normal}</dt>
                        <dd>{`${String(splitQuantities.normal)} ${uom}`}</dd>
                        <dt>{t.verdict.split.excess}</dt>
                        <dd>{`${String(splitQuantities.excess)} ${uom}`}</dd>
                      </dl>

                      <div className="receipt__field">
                        <label htmlFor="receipt-split-exception-type">
                          {required(t.verdict.split.exceptionType)}
                        </label>
                        <Select
                          id="receipt-split-exception-type"
                          placeholder={t.verdict.split.exceptionTypePlaceholder}
                          size="xl"
                          value={splitExceptionType === '' ? null : splitExceptionType}
                          onChange={(value) => {
                            setSplitExceptionType(String(value));
                          }}
                          options={(exceptionTypes.data ?? []).map((each) => ({
                            value: each.code,
                            label: each.name,
                          }))}
                        />
                        {exceptionTypes.isError ? (
                          <p className="receipt__note">{t.verdict.split.exceptionTypeLoadFailed}</p>
                        ) : null}
                      </div>

                      <TextField
                        label={required(t.verdict.split.exceptionReason)}
                        size="xl"
                        fullWidth
                        value={splitExceptionReason}
                        onChange={(event) => {
                          setSplitExceptionReason(event.target.value);
                        }}
                      />

                      <div className="receipt__split-actions">
                        <Button
                          variant="filled"
                          size="xl"
                          disabled={
                            !splitReady ||
                            splitQuantities.normal <= 0 ||
                            splitQuantities.excess <= 0 ||
                            splitExceptionType === '' ||
                            splitExceptionReason.trim() === ''
                          }
                          onClick={() => void submit('BOTH')}
                        >
                          {t.verdict.split.both}
                        </Button>
                        <Button
                          variant="outlined"
                          size="xl"
                          disabled={!splitReady || splitQuantities.normal <= 0}
                          onClick={() => void submit('NORMAL_ONLY')}
                        >
                          {t.verdict.split.normalOnly}
                        </Button>
                        <Button
                          variant="outlined"
                          size="xl"
                          disabled={
                            !splitReady ||
                            splitQuantities.excess <= 0 ||
                            splitExceptionType === '' ||
                            splitExceptionReason.trim() === ''
                          }
                          onClick={() => void submit('EXCESS_ONLY')}
                        >
                          {t.verdict.split.excessOnly}
                        </Button>
                      </div>
                      {/* 비활성은 사유를 함께 보인다(공유계약 G-1). 왜 못 누르는지 알아야 한다. */}
                      {splitExceptionType === '' || splitExceptionReason.trim() === '' ? (
                        <p className="receipt__note">{t.verdict.split.excessLocked}</p>
                      ) : null}
                      <p className="receipt__note">{t.verdict.split.atomic}</p>
                    </section>
                  )}
                </>
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
                    <dd>
                      {`${String(
                        remainingAfterOf(draft.purchaseOrderLine, received, queuedQty),
                      )} ${uom}`}
                    </dd>
                  </dl>
                  <p>{t.verdict.underAsk}</p>
                  {/*
                   * 두 길을 세로로 세우고 각 길에 자기 설명을 붙인다. 나란히 두면 어느
                   * 설명이 어느 길의 것인지 흐려지고, 설명을 하나만 두면 고르기 전에는
                   * 다른 길이 무엇인지 알 수 없다.
                   *
                   * 둘 다 같은 부품·같은 크기다. 하나가 링크면 규격이 달라져 한쪽이 더
                   * 무겁게 보이는데, 이 자리의 두 길은 대등하다.
                   */}
                  <div className="receipt__under-choice">
                    <div className="receipt__under-path">
                      <Button
                        className="receipt__wide"
                        variant={continueUnder ? 'filled' : 'outlined'}
                        size="xl"
                        onClick={() => {
                          setContinueUnder(true);
                        }}
                      >
                        {t.verdict.underContinue}
                      </Button>
                      <p className="receipt__note">{t.verdict.underContinueNote}</p>
                    </div>
                    <div className="receipt__under-path">
                      <Button
                        className="receipt__wide"
                        variant="outlined"
                        size="xl"
                        disabled={!varianceReady}
                        onClick={() => {
                          if (!varianceReady) {
                            return;
                          }

                          setVarianceNext(true);
                          void submit();
                        }}
                      >
                        {t.verdict.underVariance}
                      </Button>
                      <p className="receipt__note">{t.verdict.underVarianceNote}</p>
                    </div>
                  </div>
                </AlertBanner>
              )}

              <p className="receipt__note">{t.inspectionNote}</p>
            </section>
          )}

          <section className="receipt__section">
            {labelMismatch === null ? null : (
              <AlertBanner variant="error" title={t.label[labelMismatch]}>
                {t.label.rescan}
              </AlertBanner>
            )}
            {labelChecking ? (
              <p className="receipt__note" role="status">
                {t.label.checking}
              </p>
            ) : null}
            {labelUnverified ? <p className="receipt__note">{t.label.unverified}</p> : null}
            {saveFailed ? (
              <AlertBanner variant="error" title={t.saveFailed.title}>
                {t.saveFailed.description}
              </AlertBanner>
            ) : null}
            {worker === null ? <p className="receipt__note">{t.noWorker}</p> : null}
          </section>

          {/*
           * 이 단추는 바닥에 붙이지 않는다. 붙이면 숫자판 아랫줄을 덮어 누를 수 없고, 덮이는
           * 동안만 풀면 같은 단추가 상태에 따라 붙었다 흘렀다 한다. 등록은 다 채운 뒤에
           * 하는 마지막 일이라 흐름 끝에 두어도 찾는 데 문제가 없다.
           */}
          {/*
           * ⭐ **대체 LOT 사유는 등록 단추 바로 위에 선다**(사용자 지시 2026-09-19 ·
           *    omf-all-around#34). 필수값이라 누르기 직전에 한 번 더 눈에 들어와야 한다 — 스캔
           *    구역에 두면 발주·수량을 거치는 사이 화면 밖으로 밀려났다.
           */}
          {draft.supplierLotMissing ? (
            <section className="receipt__section">
              <div className="receipt__field">
                <label htmlFor="receipt-reason">{required(t.scan.reasonLabel)}</label>
                <Select
                  id="receipt-reason"
                  placeholder={t.scan.reasonPlaceholder}
                  size="xl"
                  value={
                    draft.substituteLotReasonCode === '' ? null : draft.substituteLotReasonCode
                  }
                  onChange={(value) => {
                    patch({ substituteLotReasonCode: String(value) });
                  }}
                  options={(reasons.data ?? []).map((each) => ({
                    value: each.code,
                    label: each.name,
                  }))}
                />
                {reasons.isError ? (
                  <p className="receipt__note">{t.scan.reasonLoadFailed}</p>
                ) : null}
              </div>
            </section>
          ) : null}

          {verdict === OVER ? null : (
            <>
              <Button
                className="receipt__wide"
                variant="filled"
                size="2xl"
                disabled={!ready}
                onClick={() => void submit()}
              >
                {t.submit}
              </Button>
              {/*
               * 잠긴 이유는 단추 «바로 아래»에 선다. 위에 두면 사유 선택칸과 붙어 그 칸의
               * 설명으로 읽히고, 무엇이 안 눌리는지가 흐려진다.
               *
               * 위에서부터 처음 비어 있는 것 하나만 말한다 - 다 늘어놓으면 무엇부터 할지가
               * 흐려진다. 다음 것은 이것을 채우면 그 자리에 선다.
               */}
              {lock === null ? null : (
                <p className="receipt__note receipt__locked" role="status">
                  {t.locked[lock]}
                </p>
              )}
            </>
          )}
        </>
      )}

      <ScanReplaceDialog field={scanField} />

      {keypadFor === null ? null : (
        <DockedNumberPad
          head={keypadFor === 'received' ? t.qty.received : t.qty.packageCount}
          fieldId={keypadFor === 'received' ? 'receipt-received-qty' : 'receipt-package-count'}
          value={keypadFor === 'received' ? draft.receivedQty : draft.packageCount}
          onChange={(value) => {
            patch(keypadFor === 'received' ? { receivedQty: value } : { packageCount: value });
          }}
          onClose={() => {
            setKeypadFor(null);
          }}
          move={{
            canPrevious: keypadFor === 'package',
            canNext: keypadFor === 'received',
            onPrevious: () => {
              setKeypadFor('received');
            },
            onNext: () => {
              setKeypadFor('package');
            },
            previousLabel: t.qty.previousField,
            nextLabel: t.qty.nextField,
          }}
          /* 포장 수는 개수라 소수점 키를 두지 않는다. */
          allowDecimal={keypadFor === 'received'}
        />
      )}
    </div>
  );
};
