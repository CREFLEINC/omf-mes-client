/**
 * W-01-10 정상품 입하 처리 — 처리 화면
 * 유형: T-W-C 처리형 (작업함: GoodsReceiptWorklist, 처리 화면: GoodsReceiptProcess)
 * 이탈:
 * - T-W-C 「업무 규칙에서 정해지는 값은 읽기 전용」: 입고 유형·품질 상태·재고 상태·입고 일시는 스펙 §4가
 *   「자동」이지만 자동값 규칙이 미결(§8-3·§8-8)이라 입력 칸으로 유지했다(확인 필요, 설계 요청서).
 *   원천 문서 유형·공장·입고 수량·영업일은 읽기 전용으로 출처와 함께 보인다.
 * - T-W-C 확인 단계의 「조건에 따라 빠지는 반영 사항」: 한도승인 여부를 처리 전에 알 값이 없어 제외 표시를
 *   넘기지 않는다(확인 필요). 처리 뒤 결과 요약이 ERP 적재 여부를 응답 값으로 말한다.
 * - T-W-C 「추천 적용」: 스펙에 적치 위치 추천 규칙이 없어 두지 않았다.
 */
import { AlertBanner, Button, EmptyState, SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router';

import { LoadErrorBanner } from '../../patterns/load-error-banner';
import { SaveErrorBanner } from '../../patterns/master';
import { EffectList, ProcessPage, type EffectItem } from '../../patterns/process-page';
import { CodeFields } from './code-fields';
import {
  GOODS_RECEIPT_CODE_GROUPS,
  isRequiredCodeListPending,
  PLACEHOLDER_GOODS_RECEIPT_CODES,
  toCodeOptionSets,
  withRuntimeGoodsReceiptCodes,
} from './code-options';
import { ConfirmSummary } from './confirm-summary';
import { DiscardConfirmDialog } from './discard-confirm-dialog';
import { readSelectedLineId, SELECTION_KEYS } from './filters';
import { toBusinessDate, toGoodsReceiptRequest, toReceiptLines } from './gr-request';
import { IrLineTable, lotCell, uomCodeOf } from './ir-line-table';
import { findSelectedLine, nextSelectedLineId } from './line-select';
import {
  describeReference,
  toReference,
  useItemNames,
  useLotOptions,
  usePlantOptions,
  useSupplierOptions,
  useUomOptions,
} from './lookups';
import {
  currentPostStep,
  isOptionalPostFieldOpen,
  isPostStepOpen,
  POST_STEPS,
  postStepClass,
  type PostStep,
} from './post-steps';
import {
  useGoodsReceiptCodeValues,
  useGoodsReceiptPost,
  useInboundReceiptLines,
  useInboundReceipts,
  useLocationOptions,
  useLotStatus,
  useWarehouseOptions,
} from './queries';
import { ReceiptDatetimeField, RemarksField } from './receipt-header-form';
import { ResultPane, type LotStatusState } from './result-pane';
import { WORKLIST_PATH } from './screen';
import {
  EMPTY_RECEIPT_DRAFT,
  formatDateTime,
  hasAnyDraftValue,
  toGoodsReceiptResultView,
  type GoodsReceiptCodeKey,
  type GoodsReceiptResultView,
  type IrLineView,
  type IrView,
  type ReceiptDraft,
} from './types';
import { CODE_FIELD_NAMES, postBlockReason, validateDraft } from './validation';
import { WarehouseLocationFields } from './warehouse-location-fields';

const t = messages.goodsReceipt;

const EMPTY_LINES: IrLineView[] = [];
const NO_FIELD_ERRORS: Record<string, string> = {};

/** 처리 단계(T-W-C). 차례가 곧 단계 표시의 차례다. `DONE`은 모든 단계를 마친 완료 화면이다. */
const STEP = { line: 0, post: 1, confirm: 2, done: 3 } as const;

type StepIndex = (typeof STEP)[keyof typeof STEP];

const STEPS = [
  { key: 'line', label: t.process.steps.line },
  { key: 'post', label: t.process.steps.post },
  { key: 'confirm', label: t.process.steps.confirm },
] as const;

/**
 * 원천 문서 유형 — **이 화면의 원천은 늘 입하 전표다.** 값 목록(`code-options.ts`)이 이 하나뿐이라
 * 사람이 고를 것이 없다. 입력 칸이 아니라 읽기 전용 값으로 보이고(T-W-C) 초안에 채워 싣는다.
 */
const SOURCE_DOCUMENT_TYPE = PLACEHOLDER_GOODS_RECEIPT_CODES.sourceDocumentType[0] ?? '';

/** 처리 화면 본문에 그리는 필수 코드 셋과 「추가 입력(선택)」의 사유. */
const REQUIRED_CODE_FIELDS: readonly GoodsReceiptCodeKey[] = [
  'receiptType',
  'qualityStatus',
  'inventoryStatus',
];
const OPTIONAL_CODE_FIELDS: readonly GoodsReceiptCodeKey[] = ['reason'];

/**
 * 초안을 버리게 되는 조작. 버리기 전에 확인을 받으려면 「무엇을 하려 했는지」를 붙들어야 한다.
 */
type DiscardIntent = { kind: 'back' } | { kind: 'selectLine'; inboundReceiptLineId: number };

/** 원천 문서 유형을 채운 초안 — 활성 조건·검증·요청 조립은 이 값을 본다. */
const withDerived = (draft: ReceiptDraft): ReceiptDraft => ({
  ...draft,
  codes: { ...draft.codes, sourceDocumentType: SOURCE_DOCUMENT_TYPE },
});

/**
 * W-01-10 처리 화면 — 한 입하 전표의 라인 하나를 입고 처리한다.
 *
 * 단계: 라인 선택 → 입고 정보 → 확정 확인 → (완료). 단계 표시·지난 단계 요약·하단 동작 바는
 * 공용 `ProcessPage`가 그린다. 대상 전표는 주소의 입하번호로 찾고, 고른 라인은 주소의 `line`에
 * 남긴다(새로고침·공유). 단계와 초안은 주소에 싣지 않는다 — 브라우저 뒤로가기는 작업함으로 간다.
 *
 * **무엇이 바뀔 때 무엇을 비우는가**(기존 수명 표를 처리 화면에 옮긴 것)
 *
 * | 조작 | `line` | 초안 | 결과 | 단계 |
 * | --- | :-: | :-: | :-: | :-: |
 * | 라인 고르기·해제 | 넣고 뺀다 | **비운다**(있으면 확인) | 비운다 | 라인 선택 |
 * | 라인 응답 도착 | 유지 | **비운다** | 유지 | 고른 줄이 없어지면 라인 선택 |
 * | 확정 입력 | 유지 | 바뀐다 | 유지 | 유지 |
 * | 창고 바꾸기 | 유지 | **위치만 비운다** | 유지 | 유지 |
 * | 단계 표시로 앞 단계 | 유지 | **유지** | 유지 | 고른 단계 |
 * | 입고 처리 성공 | 유지 | **비운다** | **채운다** | 완료 |
 * | 입고 처리 실패 | 유지 | 유지(입력을 잃지 않는다) | 비운다 | 확정 확인 |
 * | [다음 라인 처리] | **비운다** | 비운다 | 비운다 | 라인 선택 |
 * | [← 작업함] | — | 있으면 확인 후 버린다 | — | — |
 *
 * **되돌릴 수 없는 쓰기다.** 보내기 전에 세 겹으로 막는다 —
 * ① 활성 조건과 사유(`postBlockReason`) ② 길이 검증(`validateDraft`) ③ **확정 확인 단계.**
 * 보내는 중에는 단계 이동·라인 선택·작업함 복귀를 모두 닫는다.
 */
export const GoodsReceiptProcess = () => {
  const { inboundReceiptNo = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const remainingId = `${useId()}-remaining`;

  const [step, setStep] = useState<StepIndex>(STEP.line);

  /*
   * 대상 전표는 **기존 목록 조회를 입하번호로 걸러** 찾는다. 계약에 상세 경로가 있지만 이 화면은
   * 목록 응답의 값으로 머리를 그려 왔고(`queries.ts`), 요청 방식을 바꾸지 않는다.
   */
  const list = useInboundReceipts({ q: inboundReceiptNo });
  const inboundReceipt: IrView | null =
    list.data?.items.find((row) => row.inboundReceiptNo === inboundReceiptNo) ?? null;
  const inboundReceiptId = inboundReceipt?.inboundReceiptId ?? null;

  const suppliers = useSupplierOptions();
  const plants = usePlantOptions();
  const receiptTypes = useGoodsReceiptCodeValues(GOODS_RECEIPT_CODE_GROUPS.receiptType);
  const qualityStatuses = useGoodsReceiptCodeValues(GOODS_RECEIPT_CODE_GROUPS.qualityStatus);
  const inventoryStatuses = useGoodsReceiptCodeValues(GOODS_RECEIPT_CODE_GROUPS.inventoryStatus);
  const codeLookupError = [receiptTypes, qualityStatuses, inventoryStatuses].find(
    (lookup) => lookup.isError,
  );

  const lines = useInboundReceiptLines(inboundReceiptId);
  const lineData = lines.data;
  const lineRows = lineData ?? EMPTY_LINES;
  const uoms = useUomOptions(inboundReceiptId !== null);
  const items = useItemNames(
    lineRows.map((line) => line.itemId),
    inboundReceiptId !== null,
  );
  const lots = useLotOptions(
    lineRows.map((line) => line.itemId),
    inboundReceiptId !== null,
  );

  const selectedLineId = readSelectedLineId(searchParams);
  /** 판정은 `line-select.ts` 한 곳이 한다 — 표와 여기가 어긋나지 않는다. */
  const selectedLine = findSelectedLine(lineRows, selectedLineId);

  const [draft, setDraft] = useState<ReceiptDraft>(EMPTY_RECEIPT_DRAFT);
  const derivedDraft = withDerived(draft);
  const [result, setResult] = useState<GoodsReceiptResultView | null>(null);
  /** 보내기 전에 화면이 잡은 오류. 다음 단계로 가려 할 때만 세운다 — 치는 도중에 붉은 글씨를 띄우지 않는다(C-7). */
  const [localFieldErrors, setLocalFieldErrors] = useState<Record<string, string>>(NO_FIELD_ERRORS);
  const [pendingDiscard, setPendingDiscard] = useState<DiscardIntent | null>(null);

  /*
   * 입고 정보는 순서대로 입력한다(`post-steps.ts`). 한 칸을 채워 다음 칸이 열리면 포커스를 그 칸으로
   * 옮긴다(사용자 지시 2026-09-19). **앞으로 나아갔을 때만** 옮긴다.
   */
  const nextPostStep = currentPostStep(derivedDraft);
  const previousPostStep = useRef<PostStep | null | undefined>(undefined);

  useEffect(() => {
    const previous = previousPostStep.current;
    previousPostStep.current = nextPostStep;

    if (previous === undefined || nextPostStep === null) return;

    const order = (value: PostStep | null): number =>
      value === null ? POST_STEPS.length : POST_STEPS.indexOf(value);

    if (order(nextPostStep) <= order(previous)) return;

    document
      .querySelector<HTMLElement>(
        `.${postStepClass(nextPostStep)} :is(button, input):not(:disabled)`,
      )
      ?.focus();
  }, [nextPostStep]);

  /*
   * **초안 되돌림은 고른 줄과 라인 응답 두 개에만 반응한다**(#43). 목록 재조회·참조 도착·부모
   * 리렌더에 반응하면 코드를 고르는 도중에 값이 사라진다.
   */
  useEffect(() => {
    setDraft(EMPTY_RECEIPT_DRAFT);
  }, [selectedLineId, lineData]);

  /*
   * 대상이 바뀌면 결과·오류·파기 확인을 비우고 **라인 선택 단계로 돌아간다.** 뒤 단계는 고른 줄에 묶인
   * 값이라 대상이 바뀌면 다시 진행한다(T-W-C). 주소 직접 편집·앞으로가기도 이 길로 온다 — 확정 확인에
   * 머물면 사용자가 확인한 줄과 나갈 줄이 갈린다. 라인 응답은 넣지 않는다 — 성공 뒤 재조회가 결과를 지운다.
   */
  useEffect(() => {
    setResult(null);
    setLocalFieldErrors(NO_FIELD_ERRORS);
    setPendingDiscard(null);
    setStep(STEP.line);
  }, [selectedLineId]);

  /*
   * 갱신된 라인에 고른 줄이 없거나 **고를 수 없게 됐으면** 주소에서 뗀다. 라인 응답이 있을 때만 판정한다 —
   * 기다리는 동안 정리하면 새로고침 직후 고른 줄이 사라진다.
   */
  useEffect(() => {
    if (selectedLineId === null) return;
    if (lineData === undefined) return;
    if (findSelectedLine(lineData, selectedLineId) !== null) return;

    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete(SELECTION_KEYS.line);

        return next;
      },
      { replace: true },
    );
  }, [selectedLineId, lineData, setSearchParams]);

  /* 고른 줄이 없으면 뒤 단계는 뜻을 잃는다 — 라인 선택으로 돌아간다(완료 화면은 결과가 있는 동안 유지). */
  useEffect(() => {
    if (selectedLine === null && step !== STEP.line && result === null) setStep(STEP.line);
  }, [selectedLine, step, result]);

  const warehouses = useWarehouseOptions(inboundReceiptId !== null);
  const selectedWarehouseId = draft.warehouse === '' ? null : Number(draft.warehouse);
  const locations = useLocationOptions(selectedWarehouseId);

  /* 입고 처리에 **성공한 뒤에만** 자재 LOT을 다시 읽는다 — 응답에 LOT 상태가 없다(실측). */
  const lotStatus = useLotStatus(result === null ? null : (selectedLine?.lotId ?? null));

  const post = useGoodsReceiptPost({
    inboundReceiptId,
    onSuccess: (data) => {
      setResult(toGoodsReceiptResultView(data.goodsReceipt, data.lines));
      /* 초안을 비운다 — 중복 전송 완화의 한 층. */
      setDraft(EMPTY_RECEIPT_DRAFT);
      setLocalFieldErrors(NO_FIELD_ERRORS);
      setStep(STEP.done);
    },
  });

  const isLocked = post.isSaving;
  const hasDraft = hasAnyDraftValue(draft);

  /*
   * 서버가 입력 칸의 오류를 돌려주면 그 칸이 있는 「입고 정보」로 돌아간다 — 확정 확인 단계에는
   * 칸이 없어 오류가 어디에도 보이지 않는다. 입력은 그대로 남는다(실패 시 입력을 잃지 않는다).
   */
  const serverFieldErrorCount = Object.keys(post.fieldErrors).length;

  useEffect(() => {
    if (serverFieldErrorCount > 0)
      setStep((current) => (current === STEP.confirm ? STEP.post : current));
  }, [serverFieldErrorCount]);

  const goWorklist = (): void => {
    /* 작업함에서 왔으면 브라우저 뒤로가기와 같은 결과(조건·쪽이 그대로인 작업함)를 낸다. */
    if ((location.state as { fromWorklist?: boolean } | null)?.fromWorklist === true) {
      void navigate(-1);

      return;
    }

    void navigate(WORKLIST_PATH);
  };

  const selectLine = (inboundReceiptLineId: number): void => {
    const nextLineId = nextSelectedLineId(selectedLineId, inboundReceiptLineId);

    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);

        if (nextLineId === null) next.delete(SELECTION_KEYS.line);
        else next.set(SELECTION_KEYS.line, String(nextLineId));

        return next;
      },
      /* 줄 고르기는 뒤로가기 기록을 늘리지 않는다 — 뒤로가기는 작업함으로 가야 한다(T-W-C). */
      { replace: true },
    );
  };

  const runIntent = (intent: DiscardIntent): void => {
    post.reset();

    switch (intent.kind) {
      case 'back':
        goWorklist();
        break;
      case 'selectLine':
        selectLine(intent.inboundReceiptLineId);
        break;
    }
  };

  /** 초안을 버리게 되는 조작은 버리기 전에 확인을 받는다(계획 결정 15). 버릴 것이 없으면 곧바로 한다. */
  const requestIntent = (intent: DiscardIntent): void => {
    if (isLocked) return;

    if (hasDraft) {
      setPendingDiscard(intent);

      return;
    }

    runIntent(intent);
  };

  const clearFieldError = (field: string): void => {
    post.clearFieldError(field);
    setLocalFieldErrors((prev) => {
      if (!(field in prev)) return prev;

      const next = { ...prev };
      delete next[field];

      return next;
    });
  };

  /** 창고를 바꾸면 위치만 비운다 — 위치는 창고에 속한다. */
  const changeWarehouse = (value: string): void => {
    setDraft((prev) => ({ ...prev, warehouse: value, location: '' }));
    clearFieldError('warehouseId');
    clearFieldError('destinationLocationId');
  };

  const codeOptions = toCodeOptionSets(
    withRuntimeGoodsReceiptCodes({
      receiptType: receiptTypes.data,
      qualityStatus: qualityStatuses.data,
      inventoryStatus: inventoryStatuses.data,
    }),
  );
  const blockReason = postBlockReason({
    isCodeListPending: isRequiredCodeListPending(codeOptions),
    draft: derivedDraft,
  });
  const fieldErrors = { ...post.fieldErrors, ...localFieldErrors };

  /**
   * 보낼 수 있는 상태인가 — 활성 조건과 길이를 함께 본다. 확정 확인으로 넘어갈 때와 보낼 때
   * **둘 다** 부른다: 확인 단계에서 단계 표시로 돌아가 값을 바꿀 수 있다.
   */
  const findBlocked = (): Record<string, string> | null => {
    const errors = validateDraft(derivedDraft);

    if (Object.keys(errors).length > 0) return errors;

    return blockReason === null ? null : {};
  };

  const selectedWarehouse =
    warehouses.items.find((warehouse) => warehouse.warehouseId === selectedWarehouseId) ?? null;
  const locationLabel = (locationId: string): string => {
    const found = locations.items.find((item) => String(item.locationId) === locationId);

    return found === undefined ? '' : `${found.locationCode} · ${found.locationName}`;
  };
  const warehouseLabel =
    selectedWarehouse === null
      ? ''
      : `${selectedWarehouse.warehouseCode} · ${selectedWarehouse.warehouseName}`;

  const codeLabel = (key: GoodsReceiptCodeKey, code: string): string => {
    const values =
      key === 'receiptType'
        ? receiptTypes.data
        : key === 'qualityStatus'
          ? qualityStatuses.data
          : key === 'inventoryStatus'
            ? inventoryStatuses.data
            : undefined;
    const found = values?.find((value) => value.code === code);

    return found?.nameKo ?? found?.codeName ?? code;
  };

  const submit = (inboundReceiptRow: IrView, line: IrLineView): void => {
    const blocked = findBlocked();

    if (blocked !== null) {
      setLocalFieldErrors(blocked);
      setStep(STEP.post);

      return;
    }

    setResult(null);

    const body = toGoodsReceiptRequest({
      inboundReceipt: inboundReceiptRow,
      lines: toReceiptLines([line]),
      draft: derivedDraft,
      /* 발생 시각은 **제출 순간**이다. */
      now: new Date(),
    });

    /* 계약 enum 밖의 값이면 요청을 내보내지 않는 마지막 방어선이다. */
    if (body === null) return;

    post.write(body);
  };

  /* ── 대상 전표를 아직 못 찾았다 ─────────────────────────────────────────── */
  if (inboundReceipt === null) {
    return (
      <>
        {list.isError && (
          <LoadErrorBanner
            error={list.error}
            onRetry={() => {
              void list.refetch();
            }}
          />
        )}
        {list.isPending ? (
          <div role="status" aria-label={t.loading.inboundReceipts}>
            <SkeletonText lines={3} />
          </div>
        ) : (
          !list.isError && (
            <EmptyState
              live
              title={t.process.notFoundTitle}
              description={t.process.notFoundDescription}
              action={
                <Button variant="outlined" onClick={goWorklist}>
                  {t.actions.toWorklist}
                </Button>
              }
            />
          )
        )}
      </>
    );
  }

  const itemName = (line: IrLineView): string => describeReference(items.of(line.itemId));
  const qtyText = (line: IrLineView): string =>
    t.lineTable.receivedQtyPair(line.receivedQty, uomCodeOf(uoms, line.uomId));

  const summary = [
    describeReference(toReference(suppliers, inboundReceipt.supplierId)),
    formatDateTime(inboundReceipt.receiptDatetime),
    inboundReceipt.deliveryNoteNo ?? t.values.empty,
  ].join(' · ');

  /* 지난 단계 요약 — 지난 단계에서 정한 값만(T-W-C). */
  const previousSummary = (): ReactNode => {
    if (selectedLine === null || step === STEP.line) return undefined;

    const linePart = t.process.previousLine(
      selectedLine.lineNo,
      itemName(selectedLine),
      lotCell(lots, selectedLine.lotId),
      qtyText(selectedLine),
    );

    if (step === STEP.post) return linePart;

    if (step === STEP.done) return undefined;

    return `${linePart} / ${t.process.previousWhere(warehouseLabel, locationLabel(draft.location))}`;
  };

  /* ── 단계별 본문·남은 일·동작 ──────────────────────────────────────────── */
  let body: ReactNode;
  let remaining: string | undefined;
  let actions: ReactNode;

  const prevButton = (
    <Button
      variant="outlined"
      disabled={isLocked}
      onClick={() => {
        setStep((current) => (current > STEP.line ? ((current - 1) as StepIndex) : current));
      }}
    >
      {messages.common.processPage.prev}
    </Button>
  );

  if (step === STEP.line || selectedLine === null) {
    remaining = selectedLine === null ? t.process.remaining.pickLine : t.process.remaining.next;
    body = lines.isError ? (
      <LoadErrorBanner
        error={lines.error}
        onRetry={() => {
          void lines.refetch();
        }}
      />
    ) : (
      <IrLineTable
        rows={lineRows}
        isLoading={lines.isPending}
        itemNames={items}
        uomLookup={uoms}
        lotLookup={lots}
        selectedLineId={selectedLineId}
        onSelect={(inboundReceiptLineId) => {
          requestIntent({ kind: 'selectLine', inboundReceiptLineId });
        }}
        onRetryReferences={() => {
          items.refetch();
          uoms.refetch();
          lots.refetch();
        }}
      />
    );
    actions = (
      <Button
        disabled={selectedLine === null}
        aria-describedby={selectedLine === null ? remainingId : undefined}
        onClick={() => {
          setStep(STEP.post);
        }}
      >
        {messages.common.processPage.next(t.process.steps.post)}
      </Button>
    );
  } else if (step === STEP.post) {
    remaining = blockReason ?? t.process.remaining.next;
    body = (
      <>
        <h2 className="goods-receipt-section-title goods-receipt-section-title-first">
          {t.postTitle}
        </h2>

        {/* 업무 규칙에서 정해지는 값 — 입력 칸이 아니라 출처와 함께 읽기 전용으로(T-W-C). */}
        <dl className="goods-receipt-derived" aria-label={t.process.derived.title}>
          {[
            {
              key: 'plant',
              label: t.process.derived.plant,
              value: describeReference(toReference(plants, inboundReceipt.plantId)),
              source: t.process.derived.fromInboundReceipt,
            },
            {
              key: 'qty',
              label: t.process.derived.receiptQty,
              value: qtyText(selectedLine),
              source: t.process.derived.fromInboundLine,
            },
            {
              key: 'sourceDocumentType',
              label: t.process.derived.sourceDocumentType,
              value: SOURCE_DOCUMENT_TYPE,
              source: t.process.derived.fromInboundReceipt,
            },
            {
              key: 'businessDate',
              label: t.process.derived.businessDate,
              value:
                draft.receiptDatetime === ''
                  ? t.values.empty
                  : toBusinessDate(draft.receiptDatetime),
              source: t.process.derived.fromReceiptDatetime,
            },
          ].map((item) => (
            <div className="goods-receipt-derived-item" key={item.key}>
              <dt>{item.label}</dt>
              <dd>
                {item.value}
                <span className="goods-receipt-derived-source">{item.source}</span>
              </dd>
            </div>
          ))}
        </dl>

        {plants.isError && (
          <div className="field-cell">
            <span className="field-note">{t.reasons.plantFailed}</span>
            <Button
              variant="outlined"
              size="sm"
              onClick={() => {
                plants.refetch();
              }}
            >
              {messages.common.retry}
            </Button>
          </div>
        )}

        <div className="goods-receipt-post-form" data-current-step={nextPostStep ?? 'done'}>
          <WarehouseLocationFields
            warehouses={warehouses}
            locations={locations}
            warehouseValue={draft.warehouse}
            locationValue={draft.location}
            fieldErrors={fieldErrors}
            isLocked={isLocked}
            warehousePlantName={
              selectedWarehouse === null
                ? null
                : describeReference(toReference(plants, selectedWarehouse.plantId))
            }
            inboundPlantName={describeReference(toReference(plants, inboundReceipt.plantId))}
            isPlantMismatch={
              selectedWarehouse !== null && selectedWarehouse.plantId !== inboundReceipt.plantId
            }
            onChangeWarehouse={changeWarehouse}
            onChangeLocation={(value) => {
              setDraft((prev) => ({ ...prev, location: value }));
              clearFieldError('destinationLocationId');
            }}
            onRetryOptions={() => {
              warehouses.refetch();
              locations.refetch();
            }}
          />

          <CodeFields
            keys={REQUIRED_CODE_FIELDS}
            options={codeOptions}
            values={draft.codes}
            fieldErrors={fieldErrors}
            isLocked={isLocked}
            isOpen={(key) => key !== 'reason' && isPostStepOpen(derivedDraft, key)}
            onChange={(key, value) => {
              setDraft((prev) => ({ ...prev, codes: { ...prev.codes, [key]: value } }));
              clearFieldError(CODE_FIELD_NAMES[key]);
            }}
          />

          <div className="form-grid goods-receipt-post-grid">
            <ReceiptDatetimeField
              className={postStepClass('receiptDatetime')}
              value={draft.receiptDatetime}
              error={fieldErrors.receiptDatetime}
              disabled={isLocked || !isPostStepOpen(derivedDraft, 'receiptDatetime')}
              onChange={(value) => {
                setDraft((prev) => ({ ...prev, receiptDatetime: value }));
                clearFieldError('receiptDatetime');
              }}
            />
          </div>
        </div>

        {/* 선택 입력은 「추가 입력(선택)」으로 접는다(T-W-C). */}
        <details
          className="goods-receipt-optional"
          /* 접힌 칸에 오류가 붙으면 펼쳐 보인다 — 접힌 채면 무엇을 고쳐야 하는지 보이지 않는다. */
          open={
            fieldErrors.remarks !== undefined || fieldErrors[CODE_FIELD_NAMES.reason] !== undefined
              ? true
              : undefined
          }
        >
          <summary>{messages.common.processPage.optionalInput}</summary>
          <div className="goods-receipt-post-form">
            <CodeFields
              keys={OPTIONAL_CODE_FIELDS}
              options={codeOptions}
              values={draft.codes}
              fieldErrors={fieldErrors}
              isLocked={isLocked || !isOptionalPostFieldOpen(derivedDraft)}
              onChange={(key, value) => {
                setDraft((prev) => ({ ...prev, codes: { ...prev.codes, [key]: value } }));
                clearFieldError(CODE_FIELD_NAMES[key]);
              }}
            />
            <div className="form-grid goods-receipt-post-grid">
              <RemarksField
                value={draft.remarks}
                error={fieldErrors.remarks}
                disabled={isLocked || !isOptionalPostFieldOpen(derivedDraft)}
                onChange={(value) => {
                  setDraft((prev) => ({ ...prev, remarks: value }));
                  clearFieldError('remarks');
                }}
              />
            </div>
          </div>
        </details>

        {codeLookupError !== undefined && (
          <LoadErrorBanner
            error={codeLookupError.error}
            onRetry={() => {
              void receiptTypes.refetch();
              void qualityStatuses.refetch();
              void inventoryStatuses.refetch();
            }}
          />
        )}
      </>
    );
    actions = (
      <>
        {prevButton}
        <Button
          disabled={blockReason !== null}
          aria-describedby={blockReason === null ? undefined : remainingId}
          onClick={() => {
            const blocked = findBlocked();

            setLocalFieldErrors(blocked ?? NO_FIELD_ERRORS);

            if (blocked === null) setStep(STEP.confirm);
          }}
        >
          {messages.common.processPage.next(t.process.steps.confirm)}
        </Button>
      </>
    );
  } else if (step === STEP.confirm) {
    remaining = t.process.remaining.confirm;

    const effects: EffectItem[] = [
      { key: 'createReceipt', label: t.process.effects.createReceipt },
      { key: 'lotStatus', label: t.process.effects.lotStatus },
      { key: 'ledger', label: t.process.effects.ledger },
      { key: 'balance', label: t.process.effects.balance },
      { key: 'erp', label: t.process.effects.erp, note: t.process.effects.erpNote },
    ];

    body = (
      <>
        <h2 className="goods-receipt-section-title goods-receipt-section-title-first">
          {t.process.steps.confirm}
        </h2>
        <ConfirmSummary
          summary={{
            inboundReceiptNo: inboundReceipt.inboundReceiptNo,
            lineNo: selectedLine.lineNo,
            itemName: itemName(selectedLine),
            lotName: lotCell(lots, selectedLine.lotId),
            receiptQty: qtyText(selectedLine),
            warehouseName: warehouseLabel,
            locationName: locationLabel(draft.location),
            receiptTypeCode: draft.codes.receiptType,
            sourceDocumentTypeCode: SOURCE_DOCUMENT_TYPE,
            qualityStatusCode: draft.codes.qualityStatus,
            inventoryStatusCode: draft.codes.inventoryStatus,
            reasonCode: draft.codes.reason,
            receiptDatetime: formatDateTime(draft.receiptDatetime),
            remarks: draft.remarks,
          }}
          codeLabel={codeLabel}
        />
        <EffectList
          title={t.process.effectsTitle}
          items={effects}
          irreversibleNote={t.dialog.submitIrreversible}
        />
        {/* 저장 실패는 세 갈래다(검증 400·권한 403·응답 없음). */}
        <SaveErrorBanner error={post.error} />
        {/* 응답을 받지 못한 실패에만 한 줄을 더한다 — 확인 없이 다시 보내면 두 번 입고될 수 있다. */}
        {post.error?.kind === 'network' && <p className="field-error">{t.notes.postRecheck}</p>}
      </>
    );
    actions = (
      <>
        {prevButton}
        <Button
          loading={isLocked}
          onClick={() => {
            submit(inboundReceipt, selectedLine);
          }}
        >
          {t.actions.post}
        </Button>
      </>
    );
  } else {
    remaining = t.process.remaining.done;

    const lotStatusState: LotStatusState = lotStatus.isError
      ? { kind: 'failed' }
      : lotStatus.statusCode === null
        ? { kind: 'loading' }
        : { kind: 'known', statusCode: lotStatus.statusCode };

    body =
      result === null ? null : (
        <>
          <div className="banner-slot">
            <AlertBanner variant="success" title={t.process.doneTitle}>
              {t.process.doneReceiptNo(result.goodsReceiptNo)}
            </AlertBanner>
          </div>
          <ResultPane
            result={result}
            sourceInboundReceiptNo={inboundReceipt.inboundReceiptNo}
            lotStatus={lotStatusState}
          />
        </>
      );
    actions = (
      <>
        <Button variant="outlined" onClick={goWorklist}>
          {t.actions.toWorklist}
        </Button>
        <Button
          onClick={() => {
            setResult(null);
            post.reset();
            setStep(STEP.line);
            setSearchParams(
              (prev) => {
                const next = new URLSearchParams(prev);
                next.delete(SELECTION_KEYS.line);

                return next;
              },
              { replace: true },
            );
          }}
        >
          {t.actions.nextLine}
        </Button>
      </>
    );
  }

  return (
    <>
      <ProcessPage
        backLabel={t.title}
        onBack={() => {
          requestIntent({ kind: 'back' });
        }}
        isLocked={isLocked}
        title={inboundReceipt.inboundReceiptNo}
        summary={summary}
        steps={STEPS}
        currentStep={step}
        onStepSelect={
          step === STEP.done
            ? undefined
            : (index) => {
                setStep(index as StepIndex);
              }
        }
        previousSummary={previousSummary()}
        remaining={remaining}
        remainingId={remainingId}
        actions={actions}
      >
        {body}
      </ProcessPage>

      {pendingDiscard !== null && (
        <DiscardConfirmDialog
          onConfirm={() => {
            runIntent(pendingDiscard);
            setPendingDiscard(null);
          }}
          onClose={() => {
            setPendingDiscard(null);
          }}
        />
      )}
    </>
  );
};
