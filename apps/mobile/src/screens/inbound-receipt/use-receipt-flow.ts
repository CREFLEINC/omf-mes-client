import { messages } from '@omf-mes/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import { isMaterialLotNo, itemCodeOf } from '../../patterns/material-lot-no';
import { useItem, useItemLabels, useSuppliers, useUomCodes } from '../../patterns/masters';
import { useOutbox } from '../../patterns/outbox';
import { currentPlantId } from '../../patterns/plant';
import { useScanField } from '../../patterns/use-scan-field';
import { useWorkerSession } from '../../patterns/worker-session';
import { useCodeValues } from '../../patterns/code-values';
import { useAdvanceTo } from '../../patterns/advance-to';
import { useBackStep } from '../../patterns/back-step';
import { playErrorTone } from '../../patterns/error-tone';
import { useScannedLot } from '../../patterns/lots';
import {
  SUBSTITUTE_LOT_REASON,
  receiptKeys,
  useOpenPurchaseOrders,
  usePurchaseOrderLines,
  useScannedItem,
} from './queries';
import {
  OVER,
  canSubmit,
  defaultSubstituteLotReason,
  hasScannedLabel,
  labelMismatchOf,
  LINE_SCOPED_BLANK,
  qtyProblem,
  queuedQtyOf,
  recordedOf,
  sourceOf,
  splitQuantitiesOf,
  submitLockOf,
  toOutboxDraft,
  toSplitOutboxDraft,
  verdictOf,
  type PurchaseOrderLine,
  type ReceiptDraft,
  type RecordedReceipt,
  type SplitMode,
} from './receipt';

const t = messages.inboundReceipt;
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

/**
 * 입하 등록의 상태와 판정, 제출.
 *
 * 화면(`screen.tsx`)은 이 값을 그리기만 한다. 입하 등록을 단계 화면으로 다시 짤 때 그리는 쪽만
 * 바꾸고 판정·제출은 그대로 두려고 화면에서 떼어 냈다 — 판정이 그리는 코드 사이에 흩어져 있으면
 * 배치를 바꾸다 판정이 함께 바뀐다.
 */
export const useReceiptFlow = () => {
  const { enqueue, flush, isRejected, loaded, pendingOf } = useOutbox();
  const queryClient = useQueryClient();
  const { worker } = useWorkerSession();

  const [draft, setDraft] = useState<ReceiptDraft>(emptyDraft);
  const [malformed, setMalformed] = useState<string | null>(null);
  /* 이미 등록된 LOT 이라 받지 않은 라벨(omf-all-around#28). 다음 스캔까지 사유를 남긴다. */
  const [registeredLotNo, setRegisteredLotNo] = useState<string | null>(null);
  const [externalLotInput, setExternalLotInput] = useState(false);
  const [externalLotNo, setExternalLotNo] = useState('');
  const [externalLotError, setExternalLotError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  /*
   * 방금 등록한 한 건의 요약. 「등록했습니다」 만으로는 무엇을 얼마나 넣었는지 되짚을 곳이
   * 없어, 같은 자재 P/O 의 자재를 여러 번 넣을 때 확인할 길이 없었다(현장 요청 2026-09-21).
   */
  const [recorded, setRecorded] = useState<RecordedReceipt | null>(null);
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

  /**
   * 자재 P/O 라인을 고른다.
   *
   * ⭐ **다른 자재로 옮기면 그 자재에 딸린 칸을 비운다**(`LINE_SCOPED_BLANK`). 남겨 두면
   *    앞 자재에 적은 수량이 다음 자재에 붙은 채 판정까지 다시 서서, 사람이 눈치채지 못하면
   *    앞 자재의 수량이 다른 자재로 등록된다.
   *
   * ⛔ 같은 자재를 다시 누른 것은 바꾸는 것이 아니다 - 적어 둔 것을 잃지 않는다. 스캔 칸도
   *    같은 번호를 다시 댔을 때 그대로 둔다.
   */
  const pickLine = (line: PurchaseOrderLine) => {
    if (draft.purchaseOrderLine?.purchaseOrderLineId === line.purchaseOrderLineId) {
      return;
    }

    /* 숫자판은 앞 자재의 칸에 열려 있다. 비운 칸 위에 그대로 두면 어디에 치는지 어긋난다. */
    setKeypadFor(null);
    patch({ purchaseOrderLine: line, ...LINE_SCOPED_BLANK });
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
    setRegisteredLotNo(null);

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

    /*
     * 손으로 넣은 같은 번호를 라벨로 다시 댄 자리다. 손 입력에서 넓혀 둔 목록을 그대로 두면
     * 라벨인데도 무관한 발주가 후보로 남는다 - 라벨 기준으로 다시 좁힌다(omf-all-around#25).
     */
    if (!draft.supplierLotLabelAttached) {
      setShowAllOrders(false);
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
    setRegisteredLotNo(null);
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

  /*
   * 라벨 번호의 LOT 이 이 공장에 이미 있으면 받지 않는다(omf-all-around#28 · 사용자 결정 2026-09-19).
   *
   * 사전부착 라벨이면 서버가 입하와 같은 트랜잭션에서 라벨 원문으로 LOT 을 만든다. 이미 있으면
   * 공장 단위 유일키에 걸려 전송 뒤에야 「이미 있는 값입니다」로 거부되고, 현장은 무엇이 잘못됐는지
   * 알 수 없다. 스캔 자리에서 막고 발주 선택으로 넘어가지 않는다.
   *
   * - 라벨(사전부착)만 본다. 미부착·「LOT 번호 없음」은 LOT 을 만들지 않는다.
   * - ⛔ 조회 실패는 막지 않는다 — 「확인하지 못함」은 「없음」이 아니다(#25 와 같은 원칙).
   *   연결 없이도 입하가 담겨야 하고, 그때는 전송 뒤 서버 거부로 남는다.
   * - 다른 공장의 LOT 은 막지 않는다 — 서버 유일키가 공장 단위다.
   */
  /*
   * ⛔ 결과 화면에서는 묻지 않는다. 방금 보낸 입하가 그 LOT 을 만들었으므로, 연결이 다시 잡혀
   *    재조회가 돌면 성공 화면에서 오류음이 울리고 결과가 지워진다(리뷰 지적).
   */
  const lotCheck = useScannedLot(
    outcome === null && strictLabel && draft.supplierLotNo !== '' ? draft.supplierLotNo : null,
    /* 앞선 입하가 방금 이 라벨로 LOT 을 만들었을 수 있다 — 캐시의 「없음」을 믿지 않는다. */
    { alwaysFresh: true },
  );
  const plantOfTerminal = currentPlantId();
  const registeredLot =
    lotCheck.data !== undefined &&
    lotCheck.data !== null &&
    plantOfTerminal !== null &&
    lotCheck.data.plantId === plantOfTerminal
      ? lotCheck.data.lotNo
      : null;

  useEffect(() => {
    if (registeredLot === null) return;

    /* 화면을 보고 있지 않을 수 있다. 소리로도 알린다(공유계약 D-2). */
    playErrorTone();
    setRegisteredLotNo(registeredLot);
    setContinueUnder(false);
    setVarianceNext(false);
    setSplitExceptionType('');
    setSplitExceptionReason('');
    setShowAllOrders(false);
    setKeypadFor(null);
    setPickingItem(false);
    setDraft(emptyDraft);
  }, [registeredLot]);
  /*
   * 품목을 확인해 좁힌 조회이거나, 좁히지 않는 경우의 전체 조회만 목록으로 낸다.
   *
   * 품목 조회가 «실패»한 것은 없다는 답이 아니다 - 확인하지 못했으면 알리되 막지 않는다(연결 없이도
   * 입하가 담겨야 한다). 그때는 전체 목록을 내고 라벨과 같은 품목을 고르라고 알린다.
   */
  const candidates =
    itemCheck === 'none' ||
    itemCheck === 'found' ||
    itemCheck === 'failed' ||
    (!strictLabel && itemCheck === 'unknown')
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

  /*
   * ⭐ **대체 LOT 사유의 기본값을 미리 골라 둔다** — 「라벨 미부착」(사용자 지시 2026-09-19 ·
   *    omf-all-around#34). 목록은 서버가 주므로 도착한 뒤에야 고를 수 있다.
   *
   * ⛔ **이미 고른 값을 덮지 않는다.** 판정은 `defaultSubstituteLotReason` 한 곳에 있다 —
   *    목록이 다시 와도 사람이 고른 사유가 기본값으로 되돌아가지 않는다.
   */
  useEffect(() => {
    if (!draft.supplierLotMissing) return;

    const picked = defaultSubstituteLotReason(reasons.data ?? [], draft.substituteLotReasonCode);

    if (picked === null) return;

    patch({ substituteLotReasonCode: picked });
  }, [draft.supplierLotMissing, draft.substituteLotReasonCode, reasons.data]);
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
  /*
   * ⭐ **잠근 단추는 왜 잠겼는지 함께 말한다**(공유계약 G-1). 판정과 그 이유가 한 곳
   *    (`submitLockOf`)에서 나온다 — 따로 적으면 한쪽만 고쳐져, 단추는 잠긴 채 화면은
   *    고칠 것이 없다고 말하게 된다.
   */
  const lock = submitLockOf(draft, {
    loaded,
    hasWorker: worker !== null,
    plantId,
    label: labelMismatch !== null ? 'mismatch' : labelChecking ? 'checking' : 'ok',
    verdict,
    continueUnder,
  });
  const ready = lock === null && verdict !== OVER;
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

  /**
   * 품목의 코드와 이름 — **각자의 줄에 선다**(사용자 지시 2026-09-19 · omf-all-around#34).
   *
   * 붙여 두면 어디까지가 코드인지 매번 가려 읽어야 하고, 실물 라벨과 대조하는 것은 코드 쪽이다.
   * 못 찾았으면 `null` 이고, 그때는 「품목 정보 없음」 한 줄만 선다 — 빈 글자를 끼우면 이름도
   * 코드도 없이 수량만 남아 무엇을 세는지 모르는 채 적는다.
   */
  const itemPartsOf = (itemId: number): { code: string; name: string } | null => {
    const found = itemLabels.get(itemId);

    return found === undefined ? null : { code: found.itemCode, name: found.itemName };
  };

  const qtyMessage = (): string | undefined => {
    const problem = qtyProblem(draft.receivedQty);

    return problem === null || draft.receivedQty === '' ? undefined : t.qty[problem];
  };

  const restart = () => {
    setDraft(emptyDraft);
    setMalformed(null);
    setRegisteredLotNo(null);
    setExternalLotInput(false);
    setExternalLotNo('');
    setOutcome(null);
    setRecorded(null);
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

      /*
       * 확인용 요약은 «담아 보낸 본문»에서 되읽는다. 화면이 따로 셈하면 보낸 것과 보이는 것이
       * 갈려, 확인하려고 보는 수가 도리어 틀린 수가 된다.
       */
      setRecorded(recordedOf(draft, source, entry.path, entry.body));

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

  return {
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
  };
};
