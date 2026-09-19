import { AlertBanner, Button, Card, Chip, Select, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { isMaterialLotNo, itemCodeOf } from '../../patterns/material-lot-no';
import { useItem, useItemLabels, useSuppliers, useUomCodes } from '../../patterns/masters';
import { useOutbox } from '../../patterns/outbox';
import { currentPlantId } from '../../patterns/plant';
import { ScanReplaceDialog } from '../../patterns/scan-replace-dialog';
import { useScanField } from '../../patterns/use-scan-field';
import { useScreenTitle } from '../../patterns/screen-title';
import { useWorkerSession } from '../../patterns/worker-session';
import { useCodeValues } from '../../patterns/code-values';
import { useAdvanceTo } from '../../patterns/advance-to';
import { useBackStep } from '../../patterns/back-step';
import { DockedNumberPad } from '../../patterns/docked-number-pad';
import { playErrorTone } from '../../patterns/error-tone';
import { FailureBanner } from '../../patterns/failure-banner';
import { useLoadFailure } from '../../patterns/load-failure';
import {
  SUBSTITUTE_LOT_REASON,
  receiptKeys,
  useOpenPurchaseOrders,
  usePurchaseOrderLines,
  useScannedItem,
} from './queries';
import {
  NORMAL,
  OVER,
  UNDER,
  canSubmit,
  hasScannedLabel,
  isExpiryBeforeManufactured,
  labelMismatchOf,
  openLinesFirst,
  packageProblem,
  qtyProblem,
  queuedQtyOf,
  remainingAfterOf,
  remainingQtyOf,
  sourceOf,
  splitQuantitiesOf,
  toOutboxDraft,
  toSplitOutboxDraft,
  verdictOf,
  type PurchaseOrder,
  type PurchaseOrderLine,
  type ReceiptDraft,
  type SplitMode,
} from './receipt';
import { ItemPicker } from '../../patterns/item-picker';
import './screen.css';

const t = messages.inboundReceipt;
/* 필수 표시는 화면마다 짓지 않는다. 같은 뜻이 여러 모양으로 갈린다. */
const required = messages.common.required;
const INBOUND_RECEIPT_EXCEPTION_TYPE = 'INBOUND_RECEIPT_EXCEPTION_TYPE';
/** 계약 InboundReceiptLineUpsert.supplierLotNo의 varchar(100) 상한. 붙여넣기를 자르지 않는다. */
const SUPPLIER_LOT_NO_MAX_LENGTH = 100;

type Outcome = 'queued' | 'sent' | 'rejected';

const emptyDraft: ReceiptDraft = {
  supplierLotNo: '',
  supplierLotMissing: false,
  supplierLotLabelAttached: true,
  substituteLotReasonCode: '',
  unordered: false,
  supplierId: null,
  itemId: null,
  uomId: null,
  exceptionTypeCode: '',
  exceptionReason: '',
  purchaseOrder: null,
  purchaseOrderLine: null,
  deliveryNoteNo: '',
  vehicleNo: '',
  receivedQty: '',
  packageCount: '',
  manufacturedDate: '',
  expiryDate: '',
};

export const InboundReceiptScreen = () => {
  useScreenTitle(t.title);
  const failureText = useLoadFailure();

  const navigate = useNavigate();
  const { enqueue, flush, isRejected, loaded, pendingOf } = useOutbox();
  const queryClient = useQueryClient();
  const { worker } = useWorkerSession();

  const [draft, setDraft] = useState<ReceiptDraft>(emptyDraft);
  const [malformed, setMalformed] = useState<string | null>(null);
  const [externalLotInput, setExternalLotInput] = useState(false);
  const [externalLotNo, setExternalLotNo] = useState('');
  const [externalLotError, setExternalLotError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  /* 부족한데도 그대로 등록하겠다는 사람의 답. 화면은 더 올 것인지 알지 못한다. */
  const [continueUnder, setContinueUnder] = useState(false);
  /*
   * 부족을 오류로 적기로 했는가. 등록하지 않고 떠나면 스캔한 것이 사라지고, 오류를 붙일
   * 입하 라인도 생기지 않는다 - 설계가 정한 것은 받아는 두되 쓰지는 못한다이고 받아 두는
   * 것이 먼저다.
   */
  const [varianceNext, setVarianceNext] = useState(false);
  const [splitExceptionType, setSplitExceptionType] = useState('');
  const [splitExceptionReason, setSplitExceptionReason] = useState('');
  const [saveFailed, setSaveFailed] = useState(false);
  const [keypadFor, setKeypadFor] = useState<'received' | 'package' | null>(null);
  /* 담당자가 후보 밖에서 고르겠다고 한 상태. 한 번 넓히면 되돌리지 않는다. */
  const [showAllOrders, setShowAllOrders] = useState(false);
  const poSection = useRef<HTMLElement | null>(null);
  const qtySection = useRef<HTMLElement | null>(null);
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
      setSplitExceptionType('');
      setSplitExceptionReason('');
    }

    setDraft((current) => ({ ...current, ...next }));
  };

  const take = (value: string) => {
    const code = value.trim();

    if (!isMaterialLotNo(code)) {
      /* 화면을 보고 있지 않을 수 있다. 소리로도 알린다(공유계약 D-2). */
      playErrorTone();
      setMalformed(code);
      return;
    }

    setMalformed(null);

    /*
     * 라벨이 바뀌면 그 아래 고른 것을 비운다.
     *
     * 라벨의 앞자리가 어느 발주 라인이 후보인지를 가른다. 다른 품목의 라벨로 바꿨는데 앞서
     * 고른 라인이 남으면 그 라인에 남의 라벨이 붙은 채 등록되고, 화면은 아무 말도 하지 않는다.
     *
     * 같은 라벨을 다시 댄 것은 바꾸는 것이 아니므로 그대로 둔다 - 비우면 잘못 읽어 다시 댄
     * 사람이 적어 둔 것을 잃는다.
     */
    if (code !== draft.supplierLotNo) {
      setContinueUnder(false);
      setVarianceNext(false);
      setSplitExceptionType('');
      setSplitExceptionReason('');
      setShowAllOrders(false);
      setKeypadFor(null);
      setDraft({
        ...emptyDraft,
        supplierLotNo: code,
        supplierLotLabelAttached: true,
      });
      return;
    }

    patch({
      supplierLotNo: code,
      supplierLotMissing: false,
      supplierLotLabelAttached: true,
      substituteLotReasonCode: '',
    });
  };

  const takeExternalLot = () => {
    const lotNo = externalLotNo.trim();

    if (lotNo === '') {
      setExternalLotError(t.scan.externalRequired);
      return;
    }

    if (lotNo.length > SUPPLIER_LOT_NO_MAX_LENGTH) {
      setExternalLotError(t.scan.externalTooLong(SUPPLIER_LOT_NO_MAX_LENGTH, lotNo.length));
      return;
    }

    setMalformed(null);
    setExternalLotError(null);
    patch({
      supplierLotNo: lotNo,
      supplierLotMissing: false,
      supplierLotLabelAttached: false,
      substituteLotReasonCode: '',
    });
    setExternalLotInput(false);
    setExternalLotNo('');
    setExternalLotError(null);
  };

  const scanField = useScanField({ onScan: take, applied: draft.supplierLotNo });

  /* 세로 화면이라 채운 구획이 화면을 차지한 채 남으면 다음에 할 일이 접힌 자리에 있다. */
  useAdvanceTo(draft.supplierLotNo !== '' || draft.supplierLotMissing, poSection);
  useAdvanceTo(draft.purchaseOrderLine !== null || draft.unordered, qtySection);

  /*
   * 스캔한 번호가 양식대로 읽혀 제품코드가 나오면 그 품목이 있는 미마감 자재 P/O 만 후보로 낸다
   * (화면 스펙 §5 「사전부착이면 후보만 표시」). 전체 목록으로 스스로 넘어가는 것은 양식이 달라
   * 제품코드를 못 읽었을 때뿐이다(§6).
   *
   * ⛔ 품목을 확인하는 중·못 찾았을 때·후보가 0건일 때 전체 목록을 대신 내지 않는다. 그 목록의
   *    발주는 라벨 제품코드와 품목이 달라 어느 것을 골라도 등록 전에 막히고(`labelMismatchOf`)
   *    서버도 거부한다 - 고를 수 있어 보이는 막다른 길이다(omf-all-around#25).
   */
  const scannedCode = itemCodeOf(draft.supplierLotNo);
  const scannedItem = useScannedItem(draft.supplierLotNo);
  const narrowing = scannedCode !== null && !showAllOrders;
  const narrowTo = narrowing ? (scannedItem.data ?? null) : null;
  const orders = useOpenPurchaseOrders(narrowTo);
  const itemCheck: 'none' | 'pending' | 'failed' | 'unknown' | 'found' = !narrowing
    ? 'none'
    : scannedItem.isPending
      ? 'pending'
      : scannedItem.isError
        ? 'failed'
        : scannedItem.data === null
          ? 'unknown'
          : 'found';
  /*
   * 막다른 길은 «스캔한 라벨»에만 생긴다 - 라벨 제품코드 대조는 부착 라벨만 한다. 납품서 번호를
   * 손으로 넣은 건(라벨 미부착)은 대조가 없어, 품목을 못 찾거나 후보가 없으면 전에처럼 넓힌다.
   */
  const strictLabel = draft.supplierLotLabelAttached && !draft.supplierLotMissing;
  /* 품목을 확인해 좁힌 조회이거나, 좁히지 않는 경우의 전체 조회만 목록으로 낸다. */
  const candidates =
    itemCheck === 'none' ||
    itemCheck === 'found' ||
    (!strictLabel && (itemCheck === 'unknown' || itemCheck === 'failed'))
      ? orders
      : null;
  const narrowed = itemCheck === 'found';
  /* 좁힌 후보가 실제로 도착했는가. 안내와 「전체 보기」는 고를 것이 있을 때만 선다. */
  const narrowedWithCandidates = narrowed && orders.isSuccess && orders.data.length > 0;
  const narrowedEmptyUnlabelled =
    !strictLabel && narrowed && orders.isSuccess && orders.data.length === 0;

  useEffect(() => {
    if (narrowedEmptyUnlabelled) {
      setShowAllOrders(true);
    }
  }, [narrowedEmptyUnlabelled]);

  const lines = usePurchaseOrderLines(draft.purchaseOrder?.purchaseOrderId ?? null);
  const reasons = useCodeValues(SUBSTITUTE_LOT_REASON);
  const exceptionTypes = useCodeValues(INBOUND_RECEIPT_EXCEPTION_TYPE);
  const item = useItem((draft.unordered ? draft.itemId : draft.purchaseOrderLine?.itemId) ?? null);
  const uoms = useUomCodes(true);
  /* 목록의 발주 라인은 품목 식별자만 준다. 그 번호로는 실물 라벨과 대조할 수 없다. */
  const itemLabels = useItemLabels((lines.data ?? []).map((each) => each.itemId));
  const suppliers = useSuppliers(draft.unordered);
  /* 무발주는 작업자가 품목을 직접 고른다. 마스터가 커서 찾는 일에 화면을 통째로 내준다. */
  const [pickingItem, setPickingItem] = useState(false);
  /*
   * 찾는 화면에서 뒤로가기는 폼으로 되돌린다. 라우터 이력에는 이 화면 하나뿐이라, 두지
   * 않으면 품목을 고르러 들어간 사람이 한 번에 작업 목록까지 나가고 적어 둔 것을 잃는다.
   */
  useBackStep(pickingItem, () => {
    setPickingItem(false);
  });
  /* 공장은 단말 토큰이 싣고 온다. 발주가 없으면 승계할 곳이 여기뿐이다. */
  const plantId = draft.unordered ? currentPlantId() : (draft.purchaseOrder?.plantId ?? null);

  const started = draft.supplierLotNo !== '' || draft.supplierLotMissing;
  const received = Number(draft.receivedQty.trim());
  /*
   * 서버의 누적 입하에는 큐에 있는 것이 없다. 셈에 넣지 않으면 초과가 초과로 보이지 않는다.
   *
   * 라인마다 따로 센다. 카드와 판정이 다른 수를 세면 담아 둔 것이 있는 라인에서 카드는
   * 남은 예정 500, 그 카드를 누른 뒤 수량 칸은 0 이 된다 - 고치려던 어긋남이 그대로 남는다.
   */
  const queuedFor = (purchaseOrderLineId: number): number =>
    queuedQtyOf(pendingOf(t.record), purchaseOrderLineId);
  const queuedQty = queuedFor(draft.purchaseOrderLine?.purchaseOrderLineId ?? -1);
  const verdict =
    draft.purchaseOrderLine === null || qtyProblem(draft.receivedQty) !== null
      ? null
      : verdictOf(draft.purchaseOrderLine, received, queuedQty);
  const splitQuantities =
    verdict === OVER && draft.purchaseOrderLine !== null
      ? splitQuantitiesOf(draft.purchaseOrderLine, received, queuedQty)
      : null;
  /*
   * 스캔한 라벨의 제품코드를 이 건의 품목과 견준다. 다르면 서버가 거부할 라벨이라 등록 전에
   * 막는다. 공급사 칸은 서버가 등록할 때 본다.
   *
   * 확인하는 동안은 기다린다. 확인하지 못했으면(연결이 없을 때 등) 막지 않는다 - 입하 등록은
   * 오프라인에서도 담겨야 하고, 서버가 등록할 때 같은 대조를 한다.
   */
  const source = sourceOf(draft);
  const labelChecked = hasScannedLabel(draft) && source !== null;
  const labelCodes = item.data === undefined ? null : { itemCode: item.data.itemCode };
  const labelMismatch = labelMismatchOf(draft, labelCodes);
  const labelUnverified = labelChecked && labelCodes === null && item.isError;
  const labelChecking = labelChecked && labelCodes === null && !labelUnverified;
  const labelOk = labelMismatch === null && !labelChecking;
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
    labelOk &&
    verdict !== OVER &&
    (verdict !== UNDER || continueUnder);
  const splitReady =
    loaded &&
    plantId !== null &&
    canSubmit(draft, worker !== null) &&
    labelOk &&
    splitQuantities !== null;
  /*
   * 오류로 적는 길도 같은 조건을 지난다. 부족 물음에 답한 것이 continueUnder 를 대신할 뿐,
   * 큐를 읽었는지와 필수 입력이 찼는지는 그대로 본다 - 이 길만 열어 두면 확정 단추가 막힌
   * 상태에서 저장이 여기로 새어 나간다.
   */
  const varianceReady = loaded && plantId !== null && canSubmit(draft, worker !== null) && labelOk;
  /*
   * 단위는 따로 조회한다. 못 찾았을 때 빈 글자를 끼우면 수량 뒤가 그냥 비어, 무엇을 세는
   * 단위인지 없는 것인지 화면만 보고는 가릴 수 없다.
   */
  const uomOf = (uomId: number | null | undefined): string =>
    uoms.data?.get(uomId ?? -1) ?? t.po.uomUnknown;
  const uom = uomOf(draft.unordered ? draft.uomId : draft.purchaseOrderLine?.uomId);

  /* 코드와 이름을 함께 보인다. 라벨에는 코드가 찍혀 있고 사람은 이름으로 고른다. */
  const itemLabelOf = (itemId: number): string => {
    const found = itemLabels.get(itemId);

    return found === undefined ? t.po.itemUnknown : `${found.itemCode} ${found.itemName}`;
  };

  const qtyMessage = (): string | undefined => {
    const problem = qtyProblem(draft.receivedQty);

    return problem === null || draft.receivedQty === '' ? undefined : t.qty[problem];
  };

  const restart = () => {
    setDraft(emptyDraft);
    setMalformed(null);
    setExternalLotInput(false);
    setExternalLotNo('');
    setOutcome(null);
    setContinueUnder(false);
    setVarianceNext(false);
    setSplitExceptionType('');
    setSplitExceptionReason('');
    setSaveFailed(false);
    setShowAllOrders(false);
    scanField.focus();
  };

  const submit = async (splitMode?: SplitMode) => {
    if (worker === null || source === null || plantId === null || inFlight.current) {
      return;
    }

    inFlight.current = true;
    setSaveFailed(false);

    try {
      const now = new Date();
      const entry =
        splitMode === undefined
          ? toOutboxDraft(
              draft,
              source.itemId,
              source.uomId,
              plantId,
              source.supplierId,
              now,
              worker.workerNo,
            )
          : toSplitOutboxDraft(
              draft,
              source.itemId,
              source.uomId,
              plantId,
              source.supplierId,
              now,
              worker.workerNo,
              splitMode,
              splitExceptionType,
              splitExceptionReason,
              queuedQty,
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

      const queued = result === null || result.remaining.some(mine);

      /*
       * 보낸 뒤에는 발주가 달라져 있다 - 다 받은 라인은 닫히고 그 라인뿐이던 발주는 후보에서
       * 빠진다. 목록 조회는 키가 바뀌지 않아 스스로 다시 돌지 않으므로, 지우지 않으면 다음
       * 입하에서 받을 것이 없는 발주를 고르게 된다.
       */
      if (!queued) {
        const purchaseOrderId = draft.purchaseOrder?.purchaseOrderId ?? null;

        /*
         * 기다리지 않는다. 무효화는 부르는 즉시 낡음으로 표시하고, 기다리면 성공 배너가 조회
         * 두 번 뒤에야 뜬다 - 그 사이 단추도 흐려지지 않아 화면이 아무 말도 하지 않는다.
         */
        void queryClient.invalidateQueries({ queryKey: receiptKeys.allOrders });

        if (purchaseOrderId !== null) {
          void queryClient.invalidateQueries({ queryKey: receiptKeys.detail(purchaseOrderId) });
        }
      }

      setOutcome(queued ? 'queued' : 'sent');
    } finally {
      inFlight.current = false;
    }
  };

  /*
   * 찾는 동안에는 폼을 접고 화면을 내준다. 스캔한 번호와 고른 자재 P/O 는 이 화면의 상태라
   * 그대로 남는다 - 다른 주소로 나갔다 오면 그것들이 사라진다.
   */
  if (pickingItem) {
    return (
      <ItemPicker
        onPick={(picked) => {
          patch({ itemId: picked.itemId });
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
          error={malformed === null ? undefined : t.scan.malformed(malformed)}
        />
        {/*
         * 스캔 칸 하나로 받는다. 스캐너를 기다리는 동안에는 키보드를 열지 않고, 직접
         * 입력을 누르면 그 칸이 열린다. 치는 도중 스캔이 오면 스캔값이 이긴다.
         */}
        {scanField.manual ? (
          <Button
            className="receipt__wide"
            variant="outlined"
            size="xl"
            onClick={scanField.submitManual}
          >
            {t.scan.manualSubmit}
          </Button>
        ) : (
          <Button className="receipt__wide" variant="text" size="xl" onClick={scanField.openManual}>
            {t.scan.manualLabel}
          </Button>
        )}

        {draft.supplierLotMissing ? (
          <>
            <AlertBanner variant="info" title={t.scan.missingChosen} />
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
            <Button
              variant="text"
              size="lg"
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
          </>
        ) : draft.supplierLotNo === '' ? (
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
                  patch({ purchaseOrder: null, purchaseOrderLine: null });
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
                            patch({ purchaseOrderLine: line });
                          }}
                        >
                          <Card.Body className="card-body receipt__line">
                            <strong>
                              {t.po.lineLabel(
                                itemLabelOf(line.itemId),
                                String(line.orderedQty),
                                uomOf(line.uomId),
                              )}
                            </strong>
                            <p>{t.po.received(String(line.receivedQty))}</p>
                            {/*
                             * 후보 목록은 발주 단위라 그 품목의 라인이 다 찬 발주도 선다.
                             * 견주는 수를 카드가 직접 말하지 않으면 발주량대로 적게 된다.
                             */}
                            <p>
                              {t.po.lineRemaining(String(lineRemaining))}
                              {lineRemaining > 0 ? null : (
                                <>
                                  {' · '}
                                  <strong>{t.po.lineClosed}</strong>
                                </>
                              )}
                            </p>
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
                    exceptionTypeCode: '',
                    exceptionReason: '',
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

          {draft.purchaseOrderLine === null &&
          !(draft.unordered && draft.itemId !== null) ? null : (
            <section className="receipt__section" ref={qtySection}>
              <h2>{t.qty.legend}</h2>
              <Card bordered>
                <Card.Body className="card-body receipt__card">
                  <strong>
                    {item.data === undefined
                      ? t.po.itemUnknown
                      : `${item.data.itemCode} ${item.data.itemName}`}
                  </strong>
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
                      <p>
                        <strong>
                          {t.qty.remaining(
                            String(remainingQtyOf(draft.purchaseOrderLine, queuedQty)),
                            uom,
                          )}
                        </strong>
                      </p>
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
          {verdict === OVER ? null : (
            <Button
              className="receipt__wide"
              variant="filled"
              size="2xl"
              disabled={!ready}
              onClick={() => void submit()}
            >
              {t.submit}
            </Button>
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
