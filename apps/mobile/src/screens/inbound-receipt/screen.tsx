import { AlertBanner, Button, Card, Chip, Select, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { Fragment, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';

import { BottomActionBar } from '../../patterns/bottom-action-bar';
import { ScanReplaceDialog } from '../../patterns/scan-replace-dialog';
import { useScreenTitle } from '../../patterns/screen-title';
import { displayNameOf } from '../../patterns/code-values';
import { DockedNumberPad } from '../../patterns/docked-number-pad';
import { FailureBanner } from '../../patterns/failure-banner';
import { useLoadFailure } from '../../patterns/load-failure';
import { StepSection } from '../../patterns/step-flow';
import { TaskHeader, type TaskHeaderField } from '../../patterns/task-header';
import {
  NORMAL,
  OVER,
  UNDER,
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

/** 단계 번호. 발주 없이 받기는 라인 고르기 자리를 대신한다. */
const STEP_COUNT = 3;

/** 발주 후보를 카드로 늘어놓는 한도. 넘으면 선택칸으로 둔다 — 카드가 라인을 화면 밖으로 민다. */
const ORDER_CARDS_MAX = 4;

/**
 * 입하 등록 — 한 단계에 지시 하나씩.
 *
 * 전에는 스캔·발주·예외·수량·판정·사유가 한 장에 이어져 수량을 적으러 내려가면 무엇을 받는지가
 * 화면 밖으로 나갔고, 정상 입하 한 건이 스캔 1회에 9탭이었다. 이제
 * 1) 라벨을 스캔하고 2) 자재 P/O 라인을 고르고(하나뿐이면 알아서) 3) 미리 채운 수량을 확인한다.
 * 처리 중인 값은 위의 작업 헤더가, 등록 단추는 화면 바닥이 늘 같은 자리에서 보인다.
 *
 * 상태·판정·제출은 `useReceiptFlow` 가 들고 있다. 이 화면은 그 값을 그린다.
 */
export const InboundReceiptScreen = () => {
  useScreenTitle(t.title);
  const failureText = useLoadFailure();

  const navigate = useNavigate();
  const {
    step,
    setChangingLine,
    qtyPlanned,
    editReceivedQty,
    finishedItem,
    underLock,
    submitContinueUnder,
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

  /* 스캔 칸. 결과 화면과 단계마다 같은 칸이 단말 스캐너의 입력을 받는다. */
  const scanInput = (placeholder: string) => (
    <TextField
      ref={scanField.ref}
      label={t.scan.label}
      placeholder={placeholder}
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
  );

  if (outcome !== null) {
    return (
      <div className="receipt with-bottom-action-bar">
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
                {finishedItem === null
                  ? t.po.itemUnknown
                  : `${finishedItem.itemCode} ${finishedItem.itemName}`}
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

        {/* 다음 라벨을 읽으면 「다음 입하」를 누르지 않아도 그 자리에서 다음 입하가 선다. */}
        <section className="receipt__section">{scanInput(t.nextScan)}</section>

        {/* 오류는 입하 라인에 달린다. 받아 둔 뒤에야 붙일 자리가 생긴다. */}
        <BottomActionBar
          primary={
            varianceNext && outcome === 'sent'
              ? { label: t.sent.toVariance, onClick: () => void navigate('/inbound-variance') }
              : { label: t.another, onClick: restart }
          }
          secondary={
            varianceNext && outcome === 'sent' ? { label: t.another, onClick: restart } : undefined
          }
        />
      </div>
    );
  }

  const line = draft.purchaseOrderLine;
  const lineRemaining = line === null ? null : remainingQtyOf(line, queuedQty);

  /*
   * 처리 중인 값 — 실물 라벨과 대조하는 것이 위에 붙어 있다. 품목 코드를 앞에 굵게 세운다.
   * 라인을 고르기 전에는 라벨에서 읽은 제품코드를 쓴다.
   */
  const headerFields: TaskHeaderField[] = [
    {
      label: t.header.item,
      value:
        item.data?.itemCode ??
        scannedCode ??
        (draft.supplierLotMissing ? t.recorded.lotMissing : draft.supplierLotNo),
      strong: true,
    },
    ...(item.data === undefined ? [] : [{ label: t.header.itemName, value: item.data.itemName }]),
    ...(draft.purchaseOrder === null
      ? []
      : [
          {
            label: t.header.purchaseOrder,
            value:
              line === null
                ? draft.purchaseOrder.purchaseOrderNo
                : t.header.lineOf(draft.purchaseOrder.purchaseOrderNo, String(line.lineNo)),
          },
        ]),
    ...(draft.supplierLotNo === '' ? [] : [{ label: t.header.lot, value: draft.supplierLotNo }]),
  ];

  /*
   * 견주는 수는 「자세히」에 둔다. 판정이 견주는 것은 발주 총량이 아니라 남은 예정이다.
   * ⭐ 남은 수량은 발주량과 다를 때만 세운다(사용자 지시 2026-09-19) — 같은 수를 두 번 말할 뿐이다.
   */
  const headerDetails =
    line === null || lineRemaining === null ? undefined : (
      <dl className="receipt__counts">
        <dt>{t.verdict.counts.ordered}</dt>
        <dd>{`${String(line.orderedQty)} ${uom}`}</dd>
        <dt>{t.verdict.counts.received}</dt>
        <dd>{`${String(line.receivedQty)} ${uom}`}</dd>
        {lineRemaining === line.orderedQty ? null : (
          <>
            <dt>{t.verdict.split.remaining}</dt>
            <dd>{`${String(lineRemaining)} ${uom}`}</dd>
          </>
        )}
        <dt>{t.header.tolerance}</dt>
        <dd>{`+${String(line.toleranceOverQty)} / -${String(line.toleranceUnderQty)}`}</dd>
      </dl>
    );

  const lineCards = (
    <ul className="receipt__lines">
      {openLinesFirst(lines.data ?? [], queuedFor).map((each: PurchaseOrderLine) => {
        /* 표시와 표식이 갈리지 않게 한 번만 센다. */
        const remaining = remainingQtyOf(each, queuedFor(each.purchaseOrderLineId));
        const parts = itemPartsOf(each.itemId);

        return (
          <li key={each.purchaseOrderLineId}>
            <Card
              bordered
              interactive
              onClick={() => {
                pickLine(each);
              }}
            >
              <Card.Body className="card-body receipt__line">
                {/* ⭐ 코드와 이름을 각자의 줄에 적는다(사용자 지시 2026-09-19). */}
                {parts === null ? (
                  <strong>{t.po.itemUnknown}</strong>
                ) : (
                  <>
                    <strong>{t.po.lineItemCode(parts.code)}</strong>
                    <p>{t.po.lineItemName(parts.name)}</p>
                  </>
                )}
                {/*
                 * 받을 것과 허용치를 한 줄로 줄인다. 카드 하나가 여섯 줄이라 두 장이면 화면이 찼다.
                 * ⭐ 발주량과 같으면 남은 수를 따로 세우지 않는다 — 그때는 발주량이 곧 받을 것이다.
                 */}
                <p>
                  {remaining === each.orderedQty
                    ? t.po.lineOrdered(String(each.orderedQty), uomOf(each.uomId))
                    : t.po.lineRemaining(String(remaining))}
                  {' · '}
                  {t.po.tolerance(String(each.toleranceOverQty), String(each.toleranceUnderQty))}
                  {remaining > 0 ? null : (
                    <>
                      {' · '}
                      <strong>{t.po.lineClosed}</strong>
                    </>
                  )}
                </p>
                {draft.purchaseOrderLine?.purchaseOrderLineId === each.purchaseOrderLineId ? (
                  <Chip status="success">{t.po.linePicked}</Chip>
                ) : null}
              </Card.Body>
            </Card>
          </li>
        );
      })}
    </ul>
  );

  /*
   * 발주를 고른다. 무발주 갈래를 접는다 — 둘이 함께 서 있으면 고른 발주는 판정에 쓰이는데 실려
   * 나가는 것은 손으로 고른 값이라, 화면이 보이는 것과 서버에 남는 것이 달라진다.
   */
  const pickOrder = (picked: PurchaseOrder | undefined) => {
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
  };

  /* 2단계 — 자재 P/O 와 그 라인. 고를 것이 하나뿐이면 이 단계는 알아서 지나간다. */
  const lineStep = (
    <StepSection title={t.steps.line} index={2} total={STEP_COUNT}>
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
        <FailureBanner variant="error" title={failureText(candidates.error, t.po.loadFailed)} />
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
      (narrowed && orders.data.length === 0) ? null : draft.purchaseOrder === null &&
        orders.data.length <= ORDER_CARDS_MAX ? (
        /*
         * 후보가 몇 건이면 카드로 늘어놓아 한 번에 누른다. 선택칸은 열고 고르는 두 번이다.
         * 많으면 카드가 화면을 덮어 라인이 보이지 않으므로 선택칸으로 둔다.
         */
        <ul className="receipt__lines" aria-label={t.po.selectLabel}>
          {orders.data.map((each) => (
            <li key={each.purchaseOrderId}>
              <Card
                bordered
                interactive
                onClick={() => {
                  pickOrder(each);
                }}
              >
                <Card.Body className="card-body receipt__line">
                  <strong>{each.purchaseOrderNo}</strong>
                  <p>{t.po.orderDate(each.orderDate)}</p>
                </Card.Body>
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <div className="receipt__field">
          <label htmlFor="receipt-po">{t.po.selectLabel}</label>
          <Select
            id="receipt-po"
            placeholder={t.po.selectLabel}
            size="xl"
            value={
              draft.purchaseOrder === null ? null : String(draft.purchaseOrder.purchaseOrderId)
            }
            onChange={(value) => {
              pickOrder(
                (orders.data as PurchaseOrder[]).find(
                  (each) => each.purchaseOrderId === Number(value),
                ),
              );
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
          {lines.isError ? <AlertBanner variant="error" title={t.po.linesLoadFailed} /> : null}
          {lines.isSuccess && lines.data.length === 0 ? (
            <AlertBanner variant="warning" title={t.po.linesNone} />
          ) : null}
          {lineCards}
        </>
      )}

      {/*
       * 좁힌 것이 틀릴 수 있다. 번호 양식이 다르거나 다른 품목으로 들어온 물건이면
       * 후보에 없다 - 막지 않고 전체로 넓힐 길을 둔다(화면 스펙 §3 · §6).
       */}
      <div className="receipt__links">
        {narrowedWithCandidates ? (
          <Button
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
          <Button
            variant="text"
            size="xl"
            onClick={() => {
              setChangingLine(false);
              patch({ purchaseOrder: null, purchaseOrderLine: null, ...LINE_SCOPED_BLANK });
            }}
          >
            {t.po.clear}
          </Button>
        )}
        {/* 발주가 없으면 승계할 곳이 없어 담당자가 고른다. 고르지 않은 것과는 다른 상태다. */}
        <Button
          variant="text"
          size="xl"
          onClick={() => {
            setChangingLine(false);
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
      </div>
    </StepSection>
  );

  /* 발주 없이 받기 — 라인 고르기 자리를 대신한다. 품목을 고르면 같은 자리에서 수량까지 적는다. */
  const unorderedFields = (
    <>
      <p className="receipt__note">{t.exception.openNote}</p>

      {plantId === null ? <AlertBanner variant="error" title={t.exception.noPlant} /> : null}

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
        {/* 품목 마스터의 주인은 ERP 다. 여기서 만들 길을 찾지 않는다. 띠가 아니라 한 줄로 말한다. */}
        <p className="receipt__note">{`${t.exception.itemUnregistered} ${t.exception.itemUnregisteredWhy}`}</p>
      </div>

      {uoms.isError ? <AlertBanner variant="error" title={t.exception.uomLoadFailed} /> : null}
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
        <label htmlFor="receipt-unordered-exception-type">{required(t.exception.typeLabel)}</label>
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
        size="xl"
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
    </>
  );

  /* 판정. 정상은 칩 하나로 — 띠로 세우면 아무 일 없는 것이 가장 크게 보인다. */
  const verdictView: ReactNode =
    verdict === null || line === null ? null : verdict === NORMAL ? (
      <div className="receipt__verdict">
        <Chip status="success">{t.verdict.normal}</Chip>
      </div>
    ) : verdict === OVER ? (
      <>
        <AlertBanner
          variant="warning"
          title={t.verdict.over(String(remainingQtyOf(line, queuedQty)), String(received))}
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

            {/* 세 길은 대등하지 않다 — 정량·초과를 함께 받는 것이 기본이라 그것만 채워 세운다. */}
            <div className="receipt__split-actions">
              <Button
                variant="filled"
                size="2xl"
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
      /*
       * 부족 — 물음 하나와 하단의 두 단추. 전에는 띠 하나에 네 수·물음·단추 둘·설명 둘이 들어
       * 있었고, 고른 뒤에도 등록 단추를 한 번 더 눌러야 했다. 이제 고르는 단추가 곧 등록이다.
       * 네 수는 위의 「자세히」에 있다.
       */
      <div className="receipt__under" role="group" aria-label={t.verdict.underAsk}>
        <Chip status="warning">
          {t.verdict.under(String(remainingQtyOf(line, queuedQty)), String(received))}
        </Chip>
        <p className="receipt__under-ask">{t.verdict.underAsk}</p>
        <dl className="receipt__counts">
          <dt>{t.verdict.counts.arrived}</dt>
          <dd>{`${String(received)} ${uom}`}</dd>
          <dt>{t.verdict.counts.remaining}</dt>
          <dd>{`${String(remainingAfterOf(line, received, queuedQty))} ${uom}`}</dd>
        </dl>
        <p className="receipt__note">{t.verdict.underContinueNote}</p>
        <p className="receipt__note">{t.verdict.underVarianceNote}</p>
      </div>
    );

  /* 3단계(및 발주 없이 받기)의 수량. */
  const qtyFields = (
    <>
      {/*
       * 숫자판은 화면 아래에 붙는다(공유계약 D-4). 어느 칸에 들어가는지는 머리줄과 칸 표시로
       * 보인다. 늘 띄워 두면 그것이 흐려지고, 칸마다 하나씩 두면 큰 판이 둘이 되어 아래 칸을
       * 화면 밖으로 민다.
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
              editReceivedQty(event.target.value);
            }}
            onFocus={() => {
              setKeypadFor('received');
            }}
            /* 미리 채운 값은 예정이다. 그대로인 동안 그렇다고 칸 아래에 적는다. */
            helperText={qtyPlanned ? t.plannedQty : undefined}
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
              packageProblem(draft.packageCount) === null ? undefined : t.qty.packageNotPositive
            }
          />
        </div>
      </div>

      {verdictView}

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

      {item.isError ? <p className="receipt__note">{t.qty.itemLoadFailed}</p> : null}
      <p className="receipt__note">{t.inspectionNote}</p>
    </>
  );

  const showQty = step === 'qty' || (step === 'unordered' && draft.itemId !== null);

  /*
   * 등록 바로 앞의 확인들 — 라벨 대조·저장 실패·사번. 단추 가까이에 두어야 왜 막혔는지가 보인다.
   *
   * ⭐ **대체 LOT 사유는 등록 단추 바로 위에 선다**(사용자 지시 2026-09-19 · omf-all-around#34).
   *    필수값이라 누르기 직전에 한 번 더 눈에 들어와야 한다.
   */
  const beforeSubmit = (
    <>
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
      {draft.supplierLotMissing ? (
        <div className="receipt__field">
          <label htmlFor="receipt-reason">{required(t.scan.reasonLabel)}</label>
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
      ) : null}
    </>
  );

  /*
   * 화면 바닥의 확정 단추(공통 골격 S3). 숫자판이 열린 동안은 숨는다 - 전에 이 화면이 단추를
   * 바닥에 붙이지 않았던 까닭(숫자판 아랫줄을 덮는다)이 그렇게 풀린다.
   * - 초과: 분리 구획이 자기 단추를 가진다. 바를 세우지 않는다.
   * - 부족: 「분할 납품으로 등록」 · 「보류로 받고 오류 등록」 두 길.
   */
  const bar =
    !showQty || verdict === OVER ? null : verdict === UNDER ? (
      <BottomActionBar
        primary={{
          label: t.verdict.underContinue,
          onClick: submitContinueUnder,
          disabled: underLock !== null,
          lockReason: underLock === null ? undefined : t.locked[underLock],
        }}
        secondary={{
          label: t.verdict.underVariance,
          disabled: !varianceReady,
          onClick: () => {
            if (!varianceReady) {
              return;
            }

            setVarianceNext(true);
            void submit();
          },
        }}
      />
    ) : (
      <BottomActionBar
        primary={{
          label: t.submit,
          onClick: () => void submit(),
          disabled: !ready,
          /*
           * 위에서부터 처음 비어 있는 것 하나만 말한다 - 다 늘어놓으면 무엇부터 할지가 흐려진다.
           * 다음 것은 이것을 채우면 그 자리에 선다.
           */
          lockReason: lock === null ? undefined : t.locked[lock],
        }}
      />
    );

  return (
    <div
      className={
        keypadFor === null
          ? 'receipt with-bottom-action-bar'
          : 'receipt with-bottom-action-bar docked-pad-open'
      }
    >
      {started ? <TaskHeader fields={headerFields} details={headerDetails} /> : null}

      {/*
       * 1단계 — 스캔. 라벨을 받은 뒤에도 칸은 남는다: 단말 스캐너의 입력을 이 칸이 받아,
       * 다른 라벨을 읽으면 되묻고 바꾼다.
       */}
      {step === 'scan' ? (
        <StepSection title={t.steps.scan} index={1} total={STEP_COUNT}>
          {scanInput(t.scan.placeholder)}
          {/*
           * ⭐ **직접 입력과 되돌리기를 한 줄에 나란히 둔다**(사용자 지시 2026-09-19 ·
           *    omf-all-around#34). 세로로 쌓으면 스캔 칸과 아래 구획 사이가 단추로 메워진다.
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
          </div>

          {/* 라벨이 없을 때의 두 길. 스캔이 기본이라 그 아래에 둔다. */}
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
                size="2xl"
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
        </StepSection>
      ) : (
        <section className="receipt__section receipt__section--scan">
          {scanInput(t.scan.placeholder)}
          {/*
           * 손으로 넣은 납품서 번호는 라벨이 아니라는 것을 말한다 — 제품코드 대조도 자동 고르기도
           * 하지 않는 번호라, 헤더의 번호만 보고는 라벨을 읽은 것과 가리지 못한다.
           */}
          {draft.supplierLotLabelAttached || draft.supplierLotNo === '' ? null : (
            <p className="receipt__note">{t.scan.externalTaken(draft.supplierLotNo)}</p>
          )}
          {/*
           * ⛔ **「공급사 LOT 번호가 없습니다」 띠를 세우지 않는다**(사용자 지시 2026-09-19).
           *    고른 사람이 방금 누른 것을 되풀이해 말할 뿐이다 — 되돌리기 단추만 둔다.
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
        </section>
      )}

      {step === 'line' ? lineStep : null}

      {step === 'unordered' ? (
        <StepSection title={t.steps.unordered} index={2} total={STEP_COUNT}>
          {unorderedFields}
          {showQty ? qtyFields : null}
        </StepSection>
      ) : null}

      {step === 'qty' ? (
        <StepSection title={t.steps.qty} index={3} total={STEP_COUNT}>
          {qtyFields}
          {/* 다른 라인으로 받을 것이면 돌아간다. 적은 값은 같은 라인을 다시 고를 때까지 남는다. */}
          <Button
            variant="text"
            size="xl"
            onClick={() => {
              setKeypadFor(null);
              setChangingLine(true);
            }}
          >
            {t.header.changeLine}
          </Button>
        </StepSection>
      ) : null}

      {!SHOW_DELIVERY_NOTE || !started ? null : (
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

      {showQty ? <section className="receipt__section">{beforeSubmit}</section> : null}

      {bar}

      <ScanReplaceDialog field={scanField} />

      {keypadFor === null ? null : (
        <DockedNumberPad
          head={keypadFor === 'received' ? t.qty.received : t.qty.packageCount}
          fieldId={keypadFor === 'received' ? 'receipt-received-qty' : 'receipt-package-count'}
          value={keypadFor === 'received' ? draft.receivedQty : draft.packageCount}
          onChange={(value) => {
            if (keypadFor === 'received') {
              editReceivedQty(value);
            } else {
              patch({ packageCount: value });
            }
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
