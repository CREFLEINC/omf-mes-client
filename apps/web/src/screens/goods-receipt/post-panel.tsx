import {
  AlertBanner,
  Button,
  Dialog,
  SkeletonText,
  Stepper,
  type StepperItem,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useState, type ReactNode } from 'react';

import { SaveErrorBanner } from '../../patterns/master';
import { plantNowLocal } from '../../patterns/plant-time';
import { CodeFields } from './code-fields';
import {
  GOODS_RECEIPT_CODE_GROUPS,
  isRequiredCodeListPending,
  toCodeOptionSets,
  withRuntimeGoodsReceiptCodes,
} from './code-options';
import { DiscardConfirmDialog } from './discard-confirm-dialog';
import { toGoodsReceiptRequest, toReceiptLines } from './gr-request';
import { LoadErrorBanner } from './load-error-banner';
import { describeReference, toReference, usePlantOptions } from './lookups';
import { isOptionalPostFieldOpen, isPostStepOpen, currentPostStep } from './post-steps';
import {
  irKeys,
  useGoodsReceiptCodeValues,
  useGoodsReceiptPost,
  useInboundReceiptDetail,
  useLocationOptions,
  useLotStatus,
  useWarehouseOptions,
} from './queries';
import { ReceiptHeaderForm } from './receipt-header-form';
import { chooseReceiptTarget, receiptTargetsOf } from './receipt-target';
import { ResultPane, type LotStatusState } from './result-pane';
import { SubmitConfirmDialog } from './submit-confirm-dialog';
import {
  EMPTY_RECEIPT_DRAFT,
  formatDateTime,
  toGoodsReceiptResultView,
  type GoodsReceiptCodeKey,
  type GoodsReceiptResultView,
  type ReceiptDraft,
} from './types';
import { CODE_FIELD_NAMES, postBlockReason, validateDraft } from './validation';
import { WarehouseLocationFields } from './warehouse-location-fields';

const t = messages.goodsReceipt;

const NO_FIELD_ERRORS: Record<string, string> = {};

/** 창을 세우는 LOT — 입하 전표·라인·LOT 번호(내부). 나머지는 전표 상세가 준다. */
export interface GoodsReceiptPostTarget {
  inboundReceiptId: number;
  inboundReceiptLineId: number;
  lotId: number;
}

/** LOT 머리 카드에 보이는 값 — 창을 연 화면이 이미 들고 있는 것(발주·공급사·품목)이라 다시 부르지 않는다. */
export interface GoodsReceiptPostContext {
  purchaseOrderNo: string;
  supplierName: string;
  itemCode: string;
  itemName: string;
  /** 저장된 번호 그대로. */
  lotNo: string;
  uomCode: string;
  /** 검사 결과 한 줄(「검사 합격 2026.10.21」). 없으면 칸을 두지 않는다. */
  inspectionNote: string | null;
}

export interface GoodsReceiptPostPanelProps {
  target: GoodsReceiptPostTarget;
  context: GoodsReceiptPostContext;
  /** 처리 뒤 함께 다시 읽을 것 — 창을 연 화면의 표(입고 관리의 LOT 줄·진행). */
  refreshKeys?: readonly (readonly unknown[])[];
  onClose: () => void;
}

type GuideStep = 'loading' | 'info' | 'ready' | 'gated' | 'done';

const isSameDraft = (left: ReceiptDraft, right: ReceiptDraft): boolean =>
  left.warehouse === right.warehouse &&
  left.location === right.location &&
  left.receiptDatetime === right.receiptDatetime &&
  left.remarks === right.remarks &&
  (Object.keys(left.codes) as GoodsReceiptCodeKey[]).every(
    (key) => left.codes[key] === right.codes[key],
  );

/**
 * 창이 채우는 기본값 — 원천 문서 유형은 계약이 하나(입하 전표)로 닫아 두어 고를 것이 없고, 입고 일시는 **공장 현지 지금**이다
 * (대개 처리하는 그 자리에서 입고하고, 아니면 고친다 — 입하 등록 창과 같은 판단). 「버릴 것이 있는가」는 이 값과 다른지로 잰다.
 */
const freshDraft = (): ReceiptDraft => ({
  ...EMPTY_RECEIPT_DRAFT,
  codes: { ...EMPTY_RECEIPT_DRAFT.codes, sourceDocumentType: 'INBOUND_RECEIPT' },
  receiptDatetime: plantNowLocal(),
});

/**
 * 「입고 처리」 **오른쪽 창** — 입고 관리(입하 예정 조회)의 LOT 줄에서 열린다(사용자 지시 2026-10-22 · 입하·입고 일을 그 화면으로
 * 모은다). W-01-10 화면의 입력 칸(창고·위치·코드 넷·일시·비고) · 입력 차례(`post-steps.ts`) · 검증(`validation.ts`) ·
 * 요청 조립(`gr-request.ts`) · 확인 창 · 결과 구획을 **그대로 쓴다** — 규칙이 두 자리에 복사되지 않는다.
 *
 * 창은 **LOT 하나**로 선다. 입하 전표 상세를 받아 그 LOT 의 라인을 찾고, 선별로 LOT 이 갈렸으면 고른 LOT 이 대상이다
 * (`receipt-target.ts`). 입고 담당이 창에서 LOT 을 고르는 일은 없다 — 고르는 것은 표의 LOT 줄이다.
 *
 * **IQC 판정 전 LOT 은 막는다**(W-01-10 과 같은 문턱). 다만 검사 화면으로 가는 길은 두지 않는다 — 검사는 품질팀의 일이고
 * 입고 담당이 하는 것은 의뢰 요청이며 그 단추는 LOT 줄에 있다(사용자 지시 2026-10-22).
 *
 * **되돌릴 수 없는 쓰기다.** 보내기 전에 세 겹으로 막는다 — ① 입력 차례의 빈 칸 ② 길이 검증 ③ 무엇이 나가는지 보이는 확인 창.
 * 보내는 중에는 창을 닫지 못한다. 초안은 주소에 싣지 않는다 — 다른 LOT 을 열면 창을 새로 세운다(부르는 쪽이 `key` 로 LOT 번호를 준다).
 */
export const GoodsReceiptPostPanel = ({
  target,
  context,
  refreshKeys,
  onClose,
}: GoodsReceiptPostPanelProps) => {
  const detail = useInboundReceiptDetail(target.inboundReceiptId);
  const inboundReceipt = detail.data?.inboundReceipt ?? null;
  const line =
    detail.data?.lines.find((item) => item.inboundReceiptLineId === target.inboundReceiptLineId) ??
    null;

  /** 입고 대상 — 표에서 고른 LOT. 선별 전 원 LOT 이면 양품 수량, 선별 불량분이면 그 몫이다. */
  const receiptTargets = line === null ? [] : receiptTargetsOf(line);
  const receiptTarget = chooseReceiptTarget(receiptTargets, target.lotId);
  const receiptLotId = receiptTarget?.lotId ?? target.lotId;

  const [baseline, setBaseline] = useState<ReceiptDraft>(freshDraft);
  const [draft, setDraft] = useState<ReceiptDraft>(baseline);
  const [result, setResult] = useState<GoodsReceiptResultView | null>(null);
  const [localFieldErrors, setLocalFieldErrors] = useState<Record<string, string>>(NO_FIELD_ERRORS);
  const [isConfirmOpen, setConfirmOpen] = useState(false);
  const [isDiscardOpen, setDiscardOpen] = useState(false);

  const receiptTypes = useGoodsReceiptCodeValues(GOODS_RECEIPT_CODE_GROUPS.receiptType);
  const qualityStatuses = useGoodsReceiptCodeValues(GOODS_RECEIPT_CODE_GROUPS.qualityStatus);
  const inventoryStatuses = useGoodsReceiptCodeValues(GOODS_RECEIPT_CODE_GROUPS.inventoryStatus);
  const codeOptions = toCodeOptionSets(
    withRuntimeGoodsReceiptCodes({
      receiptType: receiptTypes.data,
      qualityStatus: qualityStatuses.data,
      inventoryStatus: inventoryStatuses.data,
    }),
  );

  /* 입고의 공장은 입하 전표의 값이다 — 창고 선택지도 그 공장 창고로 좁힌다(P-109). 전표를 받기 전에는 부르지 않는다. */
  const warehouses = useWarehouseOptions(inboundReceipt?.plantId ?? null);
  const selectedWarehouseId = draft.warehouse === '' ? null : Number(draft.warehouse);
  const locations = useLocationOptions(selectedWarehouseId);
  const plants = usePlantOptions();

  /* IQC 대상 줄만 LOT 상태를 읽는다 — 불합격(불량) LOT 은 불량창고로만 입고된다(omf-all-around#84). W-01-10 과 같다. */
  const selectedLotStatus = useLotStatus(
    line?.inspectionRequired === true ? receiptLotId : null,
    'select',
  );
  const isDefectiveLot = selectedLotStatus.statusCode === 'DEFECTIVE';
  const gatedLotStatus =
    selectedLotStatus.statusCode !== null &&
    selectedLotStatus.statusCode !== 'NORMAL' &&
    selectedLotStatus.statusCode !== 'DEFECTIVE'
      ? selectedLotStatus.statusCode
      : null;

  /*
   * 품질 상태는 **판정에서 승계된다**(규범 — 업무 규칙으로 정해지는 값은 기본값으로 채운다). LOT 상태가 오고 그 값이 선택지에
   * 있으면, 아직 비어 있는 품질 상태 칸을 그 값으로 채운다. 사용자가 이미 골랐으면 덮지 않는다.
   */
  const lotStatusCode = selectedLotStatus.statusCode;
  const qualityStatusKnown =
    lotStatusCode !== null &&
    codeOptions.qualityStatus.some((option) => option.value === lotStatusCode);

  useEffect(() => {
    if (lotStatusCode === null || !qualityStatusKnown) return;

    const withStatus = (prev: ReceiptDraft): ReceiptDraft =>
      prev.codes.qualityStatus === ''
        ? { ...prev, codes: { ...prev.codes, qualityStatus: lotStatusCode } }
        : prev;

    /* 승계된 값은 사용자가 고친 것이 아니다 — 기본값에도 넣어 「버릴 것이 있는가」가 그 값을 세지 않게 한다. */
    setBaseline(withStatus);
    setDraft(withStatus);
  }, [lotStatusCode, qualityStatusKnown]);

  const post = useGoodsReceiptPost({
    inboundReceiptId: target.inboundReceiptId,
    refreshKeys: [irKeys.detail(target.inboundReceiptId), ...(refreshKeys ?? [])],
    onSuccess: (data) => {
      setResult(toGoodsReceiptResultView(data.goodsReceipt, data.lines));
      /* **초안을 비운다**(이중 제출 완화의 한 층). */
      setDraft(baseline);
      setLocalFieldErrors(NO_FIELD_ERRORS);
    },
  });

  /* 처리 뒤 LOT 을 다시 읽어 결과 구획에 상태를 보인다(W-01-10 과 같다). */
  const recheck = useLotStatus(result === null ? null : receiptLotId);
  const lotStatusState: LotStatusState = recheck.isError
    ? { kind: 'failed' }
    : recheck.statusCode === null
      ? { kind: 'loading' }
      : { kind: 'known', statusCode: recheck.statusCode };

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

  const changeLocation = (value: string): void => {
    setDraft((prev) => ({ ...prev, location: value }));
    clearFieldError('destinationLocationId');
  };

  const changeCode = (key: GoodsReceiptCodeKey, value: string): void => {
    setDraft((prev) => ({ ...prev, codes: { ...prev.codes, [key]: value } }));
    clearFieldError(CODE_FIELD_NAMES[key]);
  };

  const changeReceiptDatetime = (value: string): void => {
    setDraft((prev) => ({ ...prev, receiptDatetime: value }));
    clearFieldError('receiptDatetime');
  };

  const changeRemarks = (value: string): void => {
    setDraft((prev) => ({ ...prev, remarks: value }));
    clearFieldError('remarks');
  };

  const fieldErrors = { ...post.fieldErrors, ...localFieldErrors };
  const blockReason = postBlockReason({
    isCodeListPending: isRequiredCodeListPending(codeOptions),
    draft,
  });
  const isLocked = post.isSaving;
  const isEntryLocked = isLocked || gatedLotStatus !== null;

  const hasDraft = !isSameDraft(draft, baseline);

  /** 닫기(머리 ×·Esc·「취소」) — 보내는 중에는 닫지 않고, 버릴 것이 있으면 묻는다. */
  const requestClose = (): void => {
    if (isLocked) return;
    if (hasDraft && result === null) {
      setDiscardOpen(true);

      return;
    }
    onClose();
  };

  /** 보낼 수 있는 상태인가 — 창을 여는 자리와 보내는 자리가 둘 다 본다(확인 창이 그 사이를 벌려 놓는다). */
  const findBlocked = (): Record<string, string> | null => {
    if (gatedLotStatus !== null) return {};

    const errors = validateDraft(draft);

    if (Object.keys(errors).length > 0) return errors;

    return blockReason === null ? null : {};
  };

  const openConfirm = (): void => {
    const blocked = findBlocked();

    setLocalFieldErrors(blocked ?? NO_FIELD_ERRORS);

    if (blocked !== null) return;

    setConfirmOpen(true);
  };

  const submit = (): void => {
    setConfirmOpen(false);

    if (inboundReceipt === null || line === null) return;

    const blocked = findBlocked();

    if (blocked !== null) {
      setLocalFieldErrors(blocked);

      return;
    }

    /* 실패하면 결과 구획이 비어 있어야 한다 — 앞 성공의 번호가 남으면 오해한다. */
    setResult(null);

    const body = toGoodsReceiptRequest({
      inboundReceipt,
      lines: toReceiptLines([
        { ...line, lotId: receiptLotId, receivableQty: receiptTarget?.qty ?? null },
      ]),
      draft,
      now: new Date(),
    });

    /* 조립이 마지막으로 거른다 — 계약 enum 밖의 값이면 요청을 내보내지 않는다. */
    if (body === null) return;

    post.write(body);
  };

  const selectedWarehouse =
    warehouses.items.find((warehouse) => warehouse.warehouseId === selectedWarehouseId) ?? null;
  const warehouseLabel =
    selectedWarehouse === null
      ? ''
      : `${selectedWarehouse.warehouseCode} · ${selectedWarehouse.warehouseName}`;
  const locationLabel = (locationId: string): string => {
    const found = locations.items.find((location) => String(location.locationId) === locationId);

    return found === undefined ? '' : `${found.locationCode} · ${found.locationName}`;
  };
  const warehousePlantName =
    selectedWarehouse === null
      ? null
      : describeReference(toReference(plants, selectedWarehouse.plantId));

  /** 확인 창의 코드 표시 이름 — 공통코드가 준 이름(`nameKo` → `codeName`), 없으면 코드 그대로. */
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

  const qty = receiptTarget?.qty ?? line?.receivedQty ?? null;
  const qtyText = qty === null ? t.values.empty : t.lineTable.receivedQtyPair(qty, context.uomCode);
  const destination =
    warehouseLabel === ''
      ? t.values.empty
      : draft.location === ''
        ? warehouseLabel
        : `${warehouseLabel} · ${locationLabel(draft.location)}`;

  /** 단계 안내 — 창 상태에서 지금 할 일을 정한다. 안내일 뿐 아무 단추도 잠그지 않는다. */
  const step: GuideStep = detail.isPending
    ? 'loading'
    : result !== null
      ? 'done'
      : gatedLotStatus !== null
        ? 'gated'
        : blockReason === null
          ? 'ready'
          : 'info';
  const guideItems: StepperItem[] = [
    { label: t.panel.guide.steps.lot, status: 'complete' },
    {
      label: t.panel.guide.steps.info,
      status:
        step === 'loading'
          ? 'pending'
          : step === 'info' || step === 'gated'
            ? 'current'
            : 'complete',
    },
    {
      label: t.panel.guide.steps.post,
      status: step === 'ready' ? 'current' : step === 'done' ? 'complete' : 'pending',
    },
  ];

  const nextPostStep = currentPostStep(draft);

  const formPane = (): ReactNode => {
    if (detail.isError) {
      return (
        <LoadErrorBanner
          error={detail.error}
          onRetry={() => {
            void detail.refetch();
          }}
        />
      );
    }
    if (detail.isPending || inboundReceipt === null) {
      return (
        <div role="status" aria-label={t.panel.loading}>
          <SkeletonText lines={3} />
        </div>
      );
    }
    if (line === null) {
      return (
        <div className="banner-slot">
          <AlertBanner variant="warning">{t.panel.lineMissing}</AlertBanner>
        </div>
      );
    }

    return (
      <>
        {gatedLotStatus !== null && (
          <div className="banner-slot">
            <AlertBanner
              variant="warning"
              title={
                gatedLotStatus === 'INSPECTION_PENDING'
                  ? t.notes.iqcGate.pendingTitle
                  : t.notes.iqcGate.otherTitle(gatedLotStatus)
              }
            >
              {gatedLotStatus === 'INSPECTION_PENDING'
                ? t.notes.iqcGate.pendingBody
                : t.notes.iqcGate.otherBody}
            </AlertBanner>
          </div>
        )}
        <h3 className="goods-receipt-section-title goods-receipt-section-title-first">
          {t.postTitle}
          <span className="goods-receipt-section-hint">{t.notes.autoApplied}</span>
        </h3>
        <div className="goods-receipt-post-form" data-current-step={nextPostStep ?? 'done'}>
          <WarehouseLocationFields
            warehouses={warehouses}
            locations={locations}
            warehouseValue={draft.warehouse}
            locationValue={draft.location}
            fieldErrors={fieldErrors}
            isLocked={isEntryLocked}
            warehousePlantName={warehousePlantName}
            inboundPlantName={describeReference(toReference(plants, inboundReceipt.plantId))}
            isPlantMismatch={
              selectedWarehouse !== null && selectedWarehouse.plantId !== inboundReceipt.plantId
            }
            defectOnly={isDefectiveLot}
            onChangeWarehouse={changeWarehouse}
            onChangeLocation={changeLocation}
            onRetryOptions={() => {
              warehouses.refetch();
              locations.refetch();
            }}
          />
          <CodeFields
            options={codeOptions}
            values={draft.codes}
            fieldErrors={fieldErrors}
            isLocked={isEntryLocked}
            isOpen={(key) =>
              key === 'reason' ? isOptionalPostFieldOpen(draft) : isPostStepOpen(draft, key)
            }
            listState={(key) => {
              const lookup =
                key === 'receiptType'
                  ? receiptTypes
                  : key === 'qualityStatus'
                    ? qualityStatuses
                    : key === 'inventoryStatus'
                      ? inventoryStatuses
                      : null;

              if (lookup === null) return 'ready';
              if (lookup.isError) return 'failed';

              return lookup.isPending ? 'loading' : 'ready';
            }}
            onChange={changeCode}
          />
          <ReceiptHeaderForm
            receiptDatetime={draft.receiptDatetime}
            remarks={draft.remarks}
            fieldErrors={fieldErrors}
            isLocked={isEntryLocked}
            isOpen={isOptionalPostFieldOpen(draft)}
            onChangeReceiptDatetime={changeReceiptDatetime}
            onChangeRemarks={changeRemarks}
          />
        </div>
      </>
    );
  };

  /** 아래 띠 — 오류 · 요약 · 단추. 창 몸이 길어도 늘 보인다. */
  const footer = (
    <div className="register-footer">
      <SaveErrorBanner error={post.error} />
      {post.error?.kind === 'network' && <p className="field-error">{t.notes.postRecheck}</p>}
      <div className="register-footer-row">
        <p className="ors-totals" aria-live="polite">
          <strong>{t.panel.summary(context.lotNo, qtyText, destination)}</strong>
          <span>{t.dialog.submitIrreversible}</span>
        </p>
        <div className="form-actions goods-receipt-post-actions">
          <Button variant="outlined" disabled={isLocked} onClick={requestClose}>
            {messages.common.cancel}
          </Button>
          <Button
            variant="filled"
            disabled={line === null || blockReason !== null || isEntryLocked || result !== null}
            loading={isLocked}
            onClick={openConfirm}
          >
            {t.actions.post}
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <Dialog
        open
        onClose={requestClose}
        placement="right"
        size="lg"
        className="post-dialog"
        title={t.panel.title}
        footer={footer}
      >
        <div className="register-panel">
          <nav className="ors-guide" aria-label={t.panel.guide.label}>
            <Stepper size="sm" steps={guideItems} />
            <p className="ors-guide-hint" aria-live="polite">
              {t.panel.guide.hint[step]}
            </p>
          </nav>

          {/* 결과는 **따로 선 자리**다 — 방금 만들어진 번호가 입력과 섞이지 않게. */}
          {result !== null && inboundReceipt !== null && (
            <section className="register-section po-board-register">
              <ResultPane
                result={result}
                sourceInboundReceiptNo={inboundReceipt.inboundReceiptNo}
                lotStatus={lotStatusState}
              />
            </section>
          )}

          <header className="po-board-order-head">
            <div className="po-board-order-title">
              <span className="po-board-order-eyebrow">{t.panel.head.lot}</span>
              <span className="po-board-order-no po-board-lot-no">{context.lotNo}</span>
            </div>
            <dl className="po-board-order-facts">
              <div>
                <dt>{t.panel.head.purchaseOrderNo}</dt>
                <dd>{context.purchaseOrderNo}</dd>
              </div>
              <div>
                <dt>{t.panel.head.supplier}</dt>
                <dd>{context.supplierName}</dd>
              </div>
              <div>
                <dt>{t.panel.head.item}</dt>
                <dd>{`${context.itemCode} · ${context.itemName}`}</dd>
              </div>
              <div>
                <dt>{t.panel.head.qty}</dt>
                <dd>{qtyText}</dd>
              </div>
              <div>
                <dt>{t.panel.head.inboundReceiptNo}</dt>
                <dd>{inboundReceipt?.inboundReceiptNo ?? t.values.empty}</dd>
              </div>
              {context.inspectionNote !== null && (
                <div>
                  <dt>{t.panel.head.inspection}</dt>
                  <dd>{context.inspectionNote}</dd>
                </div>
              )}
            </dl>
          </header>

          <section className="register-section" aria-label={t.panes.post}>
            {formPane()}
          </section>
        </div>
      </Dialog>

      {isConfirmOpen && inboundReceipt !== null && line !== null && (
        <SubmitConfirmDialog
          summary={{
            inboundReceiptNo: inboundReceipt.inboundReceiptNo,
            lineNo: line.lineNo,
            itemName: `${context.itemCode} · ${context.itemName}`,
            lotName: receiptTarget?.splitLotNo ?? context.lotNo,
            receiptQty: qtyText,
            warehouseName: warehouseLabel,
            locationName: locationLabel(draft.location),
            receiptTypeCode: draft.codes.receiptType,
            sourceDocumentTypeCode: draft.codes.sourceDocumentType,
            qualityStatusCode: draft.codes.qualityStatus,
            inventoryStatusCode: draft.codes.inventoryStatus,
            reasonCode: draft.codes.reason,
            receiptDatetime: formatDateTime(draft.receiptDatetime),
            remarks: draft.remarks,
          }}
          codeLabel={codeLabel}
          onConfirm={submit}
          onClose={() => {
            setConfirmOpen(false);
          }}
        />
      )}

      {isDiscardOpen && (
        <DiscardConfirmDialog
          onConfirm={() => {
            setDiscardOpen(false);
            onClose();
          }}
          onClose={() => {
            setDiscardOpen(false);
          }}
        />
      )}
    </>
  );
};
