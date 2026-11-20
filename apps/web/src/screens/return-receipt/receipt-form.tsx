import { AlertBanner, Button, Chip, EmptyState, SkeletonText, TextArea } from '@crefle/web-ui';
import type { ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useId, type ReactNode } from 'react';

import { InfoLabel, InfoTip } from '../../patterns/info-tip';
import { lookupDisplayLabel, type LookupSource } from '../../patterns/lookup-display';
import { SaveErrorBanner } from '../../patterns/master';
import { DirectLotEntry } from './direct-lot-entry';
import type { Selection } from './filters';
import { totalQty, type ActiveLine, type LineDraft } from './line-draft';
import { LineTable } from './line-table';
import { LoadErrorBanner } from './load-error';
import type { Lock } from './lock';
import { toLocationOptions } from './location-options';
import type { CodeOptionSource, ItemNameLookup, OptionListResult } from './lookups';
import type { ReceiptDraft } from './receipt-body';
import { SelectField } from './select-field';
import { formatQty, type LocationView, type WarehouseView } from './types';

const t = messages.returnReceipt;

export interface TargetState {
  selection: Selection;
  shipmentNo: string | null;
  isDetailPending: boolean;
  detailError: unknown;
  onRetryDetail: () => void;
}

export interface LotFindState {
  isSearching: boolean;
  message: string | undefined;
  onFind: (lotNo: string) => void;
}

export interface ReceiptFormProps {
  target: TargetState;
  lotFind: LotFindState;
  lines: LineDraft[];
  lineErrors: Record<string, string>;
  activeLines: ActiveLine[];
  draft: ReceiptDraft;
  draftErrors: Record<string, string>;
  reasons: CodeOptionSource;
  warehouses: OptionListResult<WarehouseView>;
  locations: OptionListResult<LocationView>;
  uoms: LookupSource;
  /** 품목은 번호마다 하나씩 푼다 — 목록 원천이 아니라 풀이 함수를 받는다. */
  items: ItemNameLookup;
  lock: Lock;
  writeError: ApiError | null;
  isSaving: boolean;
  canCancel: boolean;
  onChangeQty: (key: string, qtyText: string) => void;
  onRemoveLine: (key: string) => void;
  onChangeDraft: (next: ReceiptDraft) => void;
  onSubmit: () => void;
  onCancel: () => void;
  onCheckOutcome: () => void;
}

const optionNote = (source: CodeOptionSource): string | undefined => {
  if (source.isError) return t.lookupFailed;
  if (source.isLoading) return t.lookupLoading;
  if (source.options.length === 0) return t.codePending;

  return undefined;
};

/** 목록의 한계 — 실패 → 아직 안 옴 → 잘림 차례로 말한다. 겹치면 앞선 것이 이긴다. */
const listNote = (list: OptionListResult<unknown>, emptyText?: string): string | undefined => {
  if (list.isError) return t.lookupFailed;
  if (list.isLoading) return t.lookupLoading;
  if (list.truncated) return t.lookupTruncated;
  if (emptyText !== undefined && list.items.length === 0) return emptyText;

  return undefined;
};

const warehouseLabel = (warehouse: WarehouseView): string =>
  `${warehouse.warehouseCode} · ${warehouse.warehouseName}`;

/**
 * ② 반품 입고 — 사유 · 비고 · 라인 · 입고 창고·위치 · 고정된 품질 상태 · 이 등록이 하는 일(J-7).
 *
 * 원천은 묻지 않는다 — 출하가 끝난 뒤 돌아오는 입고는 전부 고객 클레임이다(§5-2). 고를 것이 없으니
 * 그 사실도 적지 않는다(관리웹 정리 시안 A). 칸마다의 규칙은 칸 아래가 아니라 라벨 옆 ⓘ 로 둔다.
 */
export const ReceiptForm = ({
  target,
  lotFind,
  lines,
  lineErrors,
  activeLines,
  draft,
  draftErrors,
  reasons,
  warehouses,
  locations,
  uoms,
  items,
  lock,
  writeError,
  isSaving,
  canCancel,
  onChangeQty,
  onRemoveLine,
  onChangeDraft,
  onSubmit,
  onCancel,
  onCheckOutcome,
}: ReceiptFormProps) => {
  const lockReasonId = useId();
  const remarksId = useId();
  const isLocked = lock.reason !== undefined;
  const fieldsLocked = isSaving || lock.isUncertain;
  const warehouse =
    warehouses.items.find((each) => String(each.warehouseId) === draft.warehouseId) ?? null;
  const total = totalQty(activeLines);

  if (target.selection.kind === 'none') {
    return <EmptyState size="sm" title={t.target.none} />;
  }

  let targetHeader: ReactNode;
  if (target.selection.kind === 'direct') {
    targetHeader = (
      <>
        {/* 원 출하 수량을 몰라 반품 수량에 상한이 없다는 사실은 머리 옆 ⓘ 로 둔다(관리웹 정리 시안 A). */}
        <p className="pane-lead">
          <span className="info-label">
            {t.target.direct}
            <InfoTip text={t.lot.help} />
          </span>
        </p>
        <DirectLotEntry
          isSearching={lotFind.isSearching}
          message={lotFind.message}
          isLocked={fieldsLocked}
          onFind={lotFind.onFind}
        />
      </>
    );
  } else if (target.detailError !== null && target.detailError !== undefined) {
    targetHeader = (
      <LoadErrorBanner error={target.detailError} isDetail onRetry={target.onRetryDetail} />
    );
  } else if (target.isDetailPending) {
    targetHeader = (
      <div role="status" aria-label={t.target.detailLoading}>
        <SkeletonText lines={2} />
      </div>
    );
  } else {
    targetHeader = (
      <p className="pane-lead">
        {t.target.shipment(target.shipmentNo ?? String(target.selection.shipmentId))}
        {lines.length === 0 && ` — ${t.target.noAllocations}`}
      </p>
    );
  }

  return (
    <div className="return-receipt-form">
      {targetHeader}

      <SaveErrorBanner error={writeError} onReload={onCheckOutcome} />

      <div className="filter-bar">
        <SelectField
          label={t.fields.reason}
          options={reasons.options}
          value={draft.reasonCode}
          placeholder={reasons.options.length === 0 ? t.codePlaceholder : t.form.reasonPlaceholder}
          note={optionNote(reasons)}
          info={t.form.reasonHelp}
          error={draftErrors.reasonCode}
          disabled={fieldsLocked || reasons.options.length === 0}
          onChange={(value) => onChangeDraft({ ...draft, reasonCode: value })}
          wide
        />
      </div>
      {/* 라벨과 칸을 한 덩어리로 — 폼의 줄 간격이 라벨과 칸 사이에 끼지 않게. */}
      <div>
        <InfoLabel htmlFor={remarksId} label={t.fields.remarks} info={t.form.remarksHelp} />
        <TextArea
          id={remarksId}
          value={draft.remarks}
          rows={2}
          fullWidth
          disabled={fieldsLocked}
          error={draftErrors.remarks}
          onChange={(event) => onChangeDraft({ ...draft, remarks: event.target.value })}
        />
      </div>

      <div className="return-receipt-lines" role="group" aria-label={t.panes.lines}>
        {/* 나눠 반품해도 되고 빈 줄은 보내지 않는다는 규칙은 제목 옆 ⓘ 로 둔다(관리웹 정리 시안 A). */}
        <h3 className="pane-subtitle">
          <span className="info-label">
            {t.panes.lines}
            <InfoTip text={t.lines.partialNote} />
          </span>
        </h3>
        <LineTable
          drafts={lines}
          errors={lineErrors}
          uoms={uoms}
          items={items}
          isLocked={fieldsLocked}
          onChangeQty={onChangeQty}
          onRemove={onRemoveLine}
        />
      </div>

      <div className="filter-bar">
        <SelectField
          label={t.fields.warehouse}
          required
          options={warehouses.items.map((each) => ({
            value: String(each.warehouseId),
            label: warehouseLabel(each),
          }))}
          value={draft.warehouseId}
          note={listNote(warehouses)}
          info={t.form.warehouseHelp}
          error={draftErrors.warehouseId}
          disabled={fieldsLocked}
          onChange={(value) => onChangeDraft({ ...draft, warehouseId: value, locationId: '' })}
          wide
        />
        <SelectField
          label={t.fields.location}
          required
          options={toLocationOptions(locations.items)}
          value={draft.locationId}
          note={draft.warehouseId === '' ? undefined : listNote(locations, t.form.locationEmpty)}
          error={draftErrors.destinationLocationId}
          disabled={fieldsLocked || draft.warehouseId === ''}
          disabledReason={draft.warehouseId === '' ? t.form.locationLocked : undefined}
          onChange={(value) => onChangeDraft({ ...draft, locationId: value })}
          wide
        />
      </div>
      {/* 불량창고 우선이지 강제가 아니다(§6) — 경고만 하고 막지 않는다. */}
      {warehouse !== null && !warehouse.isDefect && (
        <div className="banner-slot">
          <AlertBanner variant="warning">{t.form.warehouseNotDefect}</AlertBanner>
        </div>
      )}

      <div className="field-cell">
        <span className="info-label">
          <span className="field-label">{t.fields.qualityStatus}</span>
          <InfoTip text={t.form.qualityFixedNote} />
        </span>
        <span>
          <Chip variant="status" size="sm">
            {t.form.qualityFixed}
          </Chip>
        </span>
      </div>

      {/* J-7 — 이 등록이 무엇을 바꾸는지 누르기 전에 보인다(§5-6). */}
      <div className="banner-slot">
        <AlertBanner variant="info" title={t.form.effectTitle}>
          <ul className="return-receipt-effect">
            <li>
              {total === null || warehouse === null
                ? t.form.effectStockUnknown
                : t.form.effectStock(
                    formatQty(total.qty),
                    lookupDisplayLabel(uoms, total.uomId),
                    warehouse.warehouseName,
                  )}
            </li>
            <li>{t.form.effectHold}</li>
            <li>{t.form.effectDisposition}</li>
          </ul>
        </AlertBanner>
      </div>

      <div className="form-actions">
        <p className="field-note form-actions-secondary">{t.form.irreversible}</p>
        {lock.isUncertain && (
          <Button variant="outlined" onClick={onCheckOutcome}>
            {t.actions.checkOutcome}
          </Button>
        )}
        <Button variant="outlined" disabled={!canCancel || fieldsLocked} onClick={onCancel}>
          {t.actions.cancel}
        </Button>
        <Button
          disabled={isLocked}
          aria-describedby={isLocked ? lockReasonId : undefined}
          onClick={onSubmit}
        >
          {t.actions.submit}
        </Button>
      </div>
      {isLocked && (
        <p id={lockReasonId} className="field-note">
          {lock.reason}
        </p>
      )}
    </div>
  );
};
