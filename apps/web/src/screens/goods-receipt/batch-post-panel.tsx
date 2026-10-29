import { AlertBanner, Button, Chip, Dialog, SkeletonText } from '@crefle/web-ui';
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
import { toGoodsReceiptRequest, toReceiptLines, type ReceiptLineInput } from './gr-request';
import { describeReference, toReference, usePlantOptions } from './lookups';
import { isOptionalPostFieldOpen, isPostStepOpen, currentPostStep } from './post-steps';
import {
  useGoodsReceiptBatchPost,
  useGoodsReceiptCodeValues,
  useInboundReceiptDetails,
  useLocationOptions,
  useLotStatuses,
  useWarehouseOptions,
  type BatchPostJob,
} from './queries';
import { ReceiptHeaderForm } from './receipt-header-form';
import { chooseReceiptTarget, receiptTargetsOf } from './receipt-target';
import {
  EMPTY_RECEIPT_DRAFT,
  formatDateTime,
  type GoodsReceiptCodeKey,
  type IrLineView,
  type IrView,
  type ReceiptDraft,
} from './types';
import { CODE_FIELD_NAMES, postBlockReason, validateDraft } from './validation';
import { WarehouseLocationFields } from './warehouse-location-fields';

const t = messages.goodsReceipt;
const tb = messages.goodsReceipt.batch;

const NO_FIELD_ERRORS: Record<string, string> = {};

/** 일괄 입고할 LOT 하나 — 입고 관리의 LOT 줄이 들고 있는 값. 전표 · 라인 값은 창이 전표 상세로 받는다. */
export interface BatchPostLot {
  inboundReceiptId: number;
  inboundReceiptLineId: number;
  lotId: number;
  lotNo: string;
  itemCode: string;
  itemName: string;
  uomCode: string;
}

export interface GoodsReceiptBatchPostPanelProps {
  lots: readonly BatchPostLot[];
  /** 처리 뒤 함께 다시 읽을 것 — 창을 연 화면의 표(입고 관리의 LOT 줄·진행). */
  refreshKeys: readonly (readonly unknown[])[];
  onClose: () => void;
}

/** 한 LOT 의 입고 대상 — 전표 상세에서 찾은 라인과 수량. 상세를 받기 전이면 `null`. */
interface ResolvedLot {
  lot: BatchPostLot;
  receipt: IrView;
  line: IrLineView;
  input: ReceiptLineInput;
}

const freshDraft = (): ReceiptDraft => ({
  ...EMPTY_RECEIPT_DRAFT,
  codes: { ...EMPTY_RECEIPT_DRAFT.codes, sourceDocumentType: 'INBOUND_RECEIPT' },
  receiptDatetime: plantNowLocal(),
});

const isSameDraft = (left: ReceiptDraft, right: ReceiptDraft): boolean =>
  left.warehouse === right.warehouse &&
  left.location === right.location &&
  left.receiptDatetime === right.receiptDatetime &&
  left.remarks === right.remarks &&
  (Object.keys(left.codes) as GoodsReceiptCodeKey[]).every(
    (key) => left.codes[key] === right.codes[key],
  );

const unique = (values: readonly number[]): number[] => [...new Set(values)];

/**
 * 「입고 일괄 처리」 **오른쪽 창** — 입고 관리의 「입고 대기」 LOT 줄을 체크해 한 번에 입고한다(사용자 지시 2026-10-28
 * 「입고 요청 일괄 처리」). 입력 칸(창고·위치·코드·일시·비고) · 입력 차례 · 검증 · 요청 조립은 한 건 창(`post-panel.tsx`)과
 * **같은 부품을 쓰고**, 입력은 한 벌로 모든 LOT 에 같게 싣는다.
 *
 * 보내기 전에 막는 것:
 * - LOT 상태가 정상(NORMAL)·불량(DEFECTIVE)이 아닌 것이 섞였다 — 한 건 창과 같은 문턱(판정 전 · 보류).
 * - 불량 LOT 과 다른 LOT 이 섞였다 — 불량은 불량창고로만 입고되어(omf-all-around#84) 창고 하나로 함께 보낼 수 없다.
 * - 공장이 둘 이상이다 — 입고의 공장은 입하 전표의 값이고 창고는 그 공장 것이다.
 *
 * 품질 상태는 LOT 상태가 모두 같으면 그 값으로 채운다(한 건 창의 승계와 같다). 보내기는 전표마다 한 건씩이고(`useGoodsReceiptBatchPost`),
 * 결과는 LOT 표의 칸에 건마다 선다. 실패한 건만 다시 보낼 수 있다.
 */
export const GoodsReceiptBatchPostPanel = ({
  lots,
  refreshKeys,
  onClose,
}: GoodsReceiptBatchPostPanelProps) => {
  const receiptIds = unique(lots.map((lot) => lot.inboundReceiptId));
  const details = useInboundReceiptDetails(receiptIds);
  const detailOf = (inboundReceiptId: number) =>
    details[receiptIds.indexOf(inboundReceiptId)]?.data ?? null;
  const detailsPending = details.some((detail) => detail.isPending);
  const detailFailed = details.find((detail) => detail.isError);

  const resolved: (ResolvedLot | null)[] = lots.map((lot) => {
    const detail = detailOf(lot.inboundReceiptId);
    const line =
      detail?.lines.find((item) => item.inboundReceiptLineId === lot.inboundReceiptLineId) ?? null;
    if (detail === null || line === null) return null;
    const target = chooseReceiptTarget(receiptTargetsOf(line), lot.lotId);
    const [input] = toReceiptLines([
      { ...line, lotId: target?.lotId ?? lot.lotId, receivableQty: target?.qty ?? null },
    ]);

    return input === undefined ? null : { lot, receipt: detail.inboundReceipt, line, input };
  });
  const ready = resolved.filter((item): item is ResolvedLot => item !== null);
  const missingLine = !detailsPending && detailFailed === undefined && ready.length < lots.length;

  const plantIds = unique(ready.map((item) => item.receipt.plantId));
  const plantId = plantIds.length === 1 ? (plantIds[0] ?? null) : null;

  const statuses = useLotStatuses(lots.map((lot) => lot.lotId));
  const statusCodes = statuses.map((status) => status.statusCode);
  const statusesKnown = statusCodes.every((code) => code !== null);
  const gatedLots = lots.filter((_, index) => {
    const code = statusCodes[index];

    return code != null && code !== 'NORMAL' && code !== 'DEFECTIVE';
  });
  const defectiveCount = statusCodes.filter((code) => code === 'DEFECTIVE').length;
  const isMixedDefect = defectiveCount > 0 && defectiveCount < lots.length;
  const isAllDefective = defectiveCount === lots.length;
  const commonStatus =
    statusesKnown && new Set(statusCodes).size === 1 ? (statusCodes[0] ?? null) : null;

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

  const [baseline, setBaseline] = useState<ReceiptDraft>(freshDraft);
  const [draft, setDraft] = useState<ReceiptDraft>(baseline);
  const [localFieldErrors, setLocalFieldErrors] = useState<Record<string, string>>(NO_FIELD_ERRORS);
  const [isConfirmOpen, setConfirmOpen] = useState(false);
  const [isDiscardOpen, setDiscardOpen] = useState(false);

  const warehouses = useWarehouseOptions(plantId);
  const selectedWarehouseId = draft.warehouse === '' ? null : Number(draft.warehouse);
  const locations = useLocationOptions(selectedWarehouseId);
  const plants = usePlantOptions();

  /* 품질 상태는 LOT 상태가 모두 같을 때 그 값으로 채운다 — 사용자가 이미 골랐으면 덮지 않는다(한 건 창과 같다). */
  const qualityStatusKnown =
    commonStatus !== null &&
    codeOptions.qualityStatus.some((option) => option.value === commonStatus);
  useEffect(() => {
    if (commonStatus === null || !qualityStatusKnown) return;
    const withStatus = (prev: ReceiptDraft): ReceiptDraft =>
      prev.codes.qualityStatus === ''
        ? { ...prev, codes: { ...prev.codes, qualityStatus: commonStatus } }
        : prev;
    setBaseline(withStatus);
    setDraft(withStatus);
  }, [commonStatus, qualityStatusKnown]);

  const batch = useGoodsReceiptBatchPost({ refreshKeys });
  const outcomeOf = (lot: BatchPostLot) => batch.outcomes.get(lot.inboundReceiptId);
  const doneCount = lots.filter((lot) => outcomeOf(lot)?.kind === 'done').length;
  const isAllDone = doneCount === lots.length;
  const firstFailure = lots
    .map((lot) => ({ lot, outcome: outcomeOf(lot) }))
    .find(({ outcome }) => outcome?.kind === 'failed');

  const clearFieldError = (field: string): void => {
    setLocalFieldErrors((prev) => {
      if (!(field in prev)) return prev;
      const next = { ...prev };
      delete next[field];

      return next;
    });
  };

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

  /** 보낼 수 없게 막는 사유 — 입력 밖의 것(LOT · 전표). 입력 칸의 빈 곳은 `postBlockReason` 이 말한다. */
  const lotBlock: string | null =
    gatedLots.length > 0
      ? tb.blocked.gated(gatedLots.map((lot) => lot.lotNo).join(', '))
      : isMixedDefect
        ? tb.blocked.mixedDefect
        : plantIds.length > 1
          ? tb.blocked.mixedPlant
          : missingLine
            ? tb.blocked.missingLine
            : null;
  const blockReason = postBlockReason({
    isCodeListPending: isRequiredCodeListPending(codeOptions),
    draft,
  });
  const isLocked = batch.isSaving;
  const isEntryLocked = isLocked || lotBlock !== null || isAllDone;
  const hasDraft = !isSameDraft(draft, baseline);

  const requestClose = (): void => {
    if (isLocked) return;
    if (hasDraft && doneCount === 0) {
      setDiscardOpen(true);

      return;
    }
    onClose();
  };

  const findBlocked = (): Record<string, string> | null => {
    if (lotBlock !== null || detailsPending || !statusesKnown) return {};
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

  /** 전표마다 한 건 — 같은 전표의 LOT 은 한 요청의 줄이 된다. */
  const toJobs = (): BatchPostJob[] | null => {
    const now = new Date();
    const jobs: BatchPostJob[] = [];
    for (const receiptId of receiptIds) {
      const items = ready.filter((item) => item.lot.inboundReceiptId === receiptId);
      const first = items[0];
      if (first === undefined) continue;
      const body = toGoodsReceiptRequest({
        inboundReceipt: first.receipt,
        lines: items.map((item) => item.input),
        draft,
        now,
      });
      /* 조립이 마지막으로 거른다 — 계약 enum 밖의 값이면 하나도 보내지 않는다. */
      if (body === null) return null;
      jobs.push({ inboundReceiptId: receiptId, body });
    }

    return jobs;
  };

  const submit = (): void => {
    setConfirmOpen(false);
    const blocked = findBlocked();
    if (blocked !== null) {
      setLocalFieldErrors(blocked);

      return;
    }
    const jobs = toJobs();
    if (jobs === null) return;
    void batch.run(jobs);
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
  const destination =
    warehouseLabel === ''
      ? t.values.empty
      : draft.location === ''
        ? warehouseLabel
        : `${warehouseLabel} · ${locationLabel(draft.location)}`;

  const qtyOf = (index: number): string => {
    const item = resolved[index];
    const lot = lots[index];

    return item == null || lot === undefined
      ? t.values.empty
      : t.lineTable.receivedQtyPair(item.input.receiptQty, lot.uomCode);
  };

  /** LOT 칸의 결과 — 보내기 전 · 입고됨(입고번호) · 실패. */
  const outcomeCell = (lot: BatchPostLot): ReactNode => {
    const outcome = outcomeOf(lot);
    if (outcome === undefined) return null;

    return outcome.kind === 'done' ? (
      <Chip variant="status" status="success" size="sm">
        {tb.done(outcome.goodsReceiptNo)}
      </Chip>
    ) : (
      <Chip variant="status" status="error" size="sm">
        {tb.failed}
      </Chip>
    );
  };

  const lotList = (
    <table className="batch-post-lots">
      <thead>
        <tr>
          <th scope="col">{t.panel.head.lot}</th>
          <th scope="col">{t.panel.head.item}</th>
          <th scope="col" className="batch-post-qty">
            {t.panel.head.qty}
          </th>
          <th scope="col">{tb.result}</th>
        </tr>
      </thead>
      <tbody>
        {lots.map((lot, index) => (
          <tr key={lot.lotId}>
            <td className="po-board-lot-no">{lot.lotNo}</td>
            <td>{`${lot.itemCode} · ${lot.itemName}`}</td>
            <td className="batch-post-qty">{qtyOf(index)}</td>
            <td>{outcomeCell(lot)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const formPane = (): ReactNode => {
    if (detailFailed !== undefined) {
      return (
        <div className="banner-slot">
          <AlertBanner variant="error">{tb.loadFailed}</AlertBanner>
        </div>
      );
    }
    if (detailsPending || (plantId === null && lotBlock === null)) {
      return (
        <div role="status" aria-label={t.panel.loading}>
          <SkeletonText lines={3} />
        </div>
      );
    }

    return (
      <>
        {lotBlock !== null && (
          <div className="banner-slot">
            <AlertBanner variant="warning">{lotBlock}</AlertBanner>
          </div>
        )}
        <h3 className="goods-receipt-section-title goods-receipt-section-title-first">
          {t.postTitle}
          <span className="goods-receipt-section-hint">{tb.sameForAll}</span>
        </h3>
        <div
          className="goods-receipt-post-form"
          data-current-step={currentPostStep(draft) ?? 'done'}
        >
          <WarehouseLocationFields
            warehouses={warehouses}
            locations={locations}
            warehouseValue={draft.warehouse}
            locationValue={draft.location}
            fieldErrors={localFieldErrors}
            isLocked={isEntryLocked}
            warehousePlantName={
              selectedWarehouse === null
                ? null
                : describeReference(toReference(plants, selectedWarehouse.plantId))
            }
            inboundPlantName={describeReference(toReference(plants, plantId))}
            isPlantMismatch={selectedWarehouse !== null && selectedWarehouse.plantId !== plantId}
            defectOnly={isAllDefective}
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
            fieldErrors={localFieldErrors}
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
            fieldErrors={localFieldErrors}
            isLocked={isEntryLocked}
            isOpen={isOptionalPostFieldOpen(draft)}
            onChangeReceiptDatetime={changeReceiptDatetime}
            onChangeRemarks={changeRemarks}
          />
        </div>
      </>
    );
  };

  const hasFailure = firstFailure !== undefined;
  const footer = (
    <div className="register-footer">
      {firstFailure?.outcome?.kind === 'failed' && (
        <>
          <p className="field-error">{tb.failedLot(firstFailure.lot.lotNo)}</p>
          <SaveErrorBanner error={firstFailure.outcome.error} />
        </>
      )}
      <div className="register-footer-row">
        <p className="ors-totals" aria-live="polite">
          <strong>
            {isAllDone ? tb.allDone(lots.length) : tb.summary(lots.length, destination)}
          </strong>
          {!isAllDone && <span>{t.dialog.submitIrreversible}</span>}
        </p>
        <div className="form-actions goods-receipt-post-actions">
          <Button variant="outlined" disabled={isLocked} onClick={requestClose}>
            {isAllDone ? messages.common.close : messages.common.cancel}
          </Button>
          {!isAllDone && (
            <Button
              variant="filled"
              disabled={blockReason !== null || isEntryLocked || detailsPending || !statusesKnown}
              loading={isLocked}
              onClick={openConfirm}
            >
              {hasFailure ? tb.retry : tb.submit(lots.length - doneCount)}
            </Button>
          )}
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
        title={tb.title(lots.length)}
        footer={footer}
      >
        <div className="register-panel">
          <section className="register-section" aria-label={tb.lotsLabel}>
            {lotList}
          </section>
          <section className="register-section" aria-label={t.panes.post}>
            {formPane()}
          </section>
        </div>
      </Dialog>

      {isConfirmOpen && (
        <Dialog
          open
          onClose={() => {
            setConfirmOpen(false);
          }}
          size="sm"
          title={tb.confirm.title(lots.length - doneCount)}
          footer={
            <div className="form-actions">
              <Button
                variant="outlined"
                onClick={() => {
                  setConfirmOpen(false);
                }}
              >
                {messages.common.cancel}
              </Button>
              <Button variant="filled" onClick={submit}>
                {tb.confirm.ok}
              </Button>
            </div>
          }
        >
          <p>
            <strong>{tb.confirm.destination(destination)}</strong>
          </p>
          <p>{tb.confirm.when(formatDateTime(draft.receiptDatetime))}</p>
          <p className="field-error">{t.dialog.submitIrreversible}</p>
        </Dialog>
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
