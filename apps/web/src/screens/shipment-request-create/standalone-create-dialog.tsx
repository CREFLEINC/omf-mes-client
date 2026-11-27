import { AlertBanner, Button, DatePicker, Dialog, Icon, type SelectItems } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, type ReactNode } from 'react';

import { FieldLabel } from './field-label';
import type { HeaderFieldPatch } from './assignment-form-pane';
import { LineTable } from './line-table';
import type { AvailableQtyLookup, ItemNameLookup, ReferenceSource } from './lookups';
import { SelectField } from './select-field';
import { ShortageBanner, countShortageLines } from './shortage-banner';
import type { SelectOption, ShipmentRequestLineDraft } from './types';

const t = messages.shipmentRequestCreate;

export interface StandaloneCreateDialogProps {
  businessUnitId: string;
  customerId: string;
  shipToPartnerId: string;
  requestedShipDate: string;
  businessUnitOptions: SelectOption[];
  customerOptions: SelectOption[];
  shipToPartnerOptions: SelectOption[];
  /** 선택지의 한계(잘림 · 불러오기 실패) — 있을 때만 칸 아래에 선다. */
  businessUnitNote?: string;
  customerNote?: string;
  shipToPartnerNote?: string;
  /** 서버가 준 필드 오류만 — 아직 안 채운 칸은 빨간 * 와 잠긴 단추로만 알린다(바탕은 기본 · #360). */
  headerErrors: Record<string, string>;
  onChangeHeader: (patch: HeaderFieldPatch) => void;

  lines: ShipmentRequestLineDraft[];
  lineErrors: Record<string, string>;
  itemNames: ItemNameLookup;
  onPickItem: (key: string) => void;
  uomLookup: ReferenceSource;
  uomOptions: SelectOption[];
  availableQty: AvailableQtyLookup;
  onPatchLine: (key: string, patch: Partial<Omit<ShipmentRequestLineDraft, 'key'>>) => void;
  onRemoveLine: (key: string) => void;
  onAddLine: () => void;
  warehouseOptions: SelectItems;
  onChangeWarehouse: (key: string, warehouseId: string) => void;
  clearedWarehouseCount: number;
  businessUnitName: string;

  /** 나가는 중 · 편성 뒤 잠금. */
  isLocked: boolean;
  /** [출하작업지시 생성] 단추를 잠글까 — 사유 글은 적지 않는다(#360). 잠그는 조건은 종전 그대로다. */
  isSubmitBlocked: boolean;
  isSaving: boolean;
  /** 저장 실패 배너 — 실제로 보낸 뒤의 오류만 선다. */
  banner: ReactNode;
  onSubmit: () => void;
  /** [취소] · Esc — 입력이 있으면 화면이 먼저 묻는다. */
  onCancel: () => void;
}

/**
 * ERP S/O 없이 생성 — 본문 상세 자리에 펼치던 입력을 팝업으로 연다(사용자 지시 2026-11-27 · omf-all-around#360).
 *
 * 칸 · 표 · 검증 · 자동 채움 · 보내는 본문은 종전 단독 생성 폼(`AssignmentFormPane` 의 `standalone`)과 같다 —
 * 자리와 모양만 팝업 시안(2026-11-26 · 1·2장 · 「표가 있을 때」)을 따른다:
 * 회색 제목 줄 · 단추 줄, 필수 칸 빨간 *, 흐린 문구, 표 제목 + 「N건」.
 * 빈 필수 칸은 연한 빨간 바탕을 쓰지 않는다(앱 공통 규칙에서 이 팝업만 뺐다 · 2026-11-27) — 오류 글은 실제 검증 오류만 칸 아래.
 * 단추는 곧바로 출하작업지시를 만든다(편성 단계 없음) — 제목 · 단추 · 성공 알림을 「생성」으로 적는다.
 * 「사업부 자동 채움」 안내 · 칸 아래 「~선택하세요.」 오류 글 · 단추 아래 잠긴 사유는 적지 않는다(사용자 방침).
 *
 * S/O 를 골라 편성하는 흐름은 그대로 본문 상세 자리(`AssignmentFormPane`)를 쓴다.
 */
export const StandaloneCreateDialog = ({
  businessUnitId,
  customerId,
  shipToPartnerId,
  requestedShipDate,
  businessUnitOptions,
  customerOptions,
  shipToPartnerOptions,
  businessUnitNote,
  customerNote,
  shipToPartnerNote,
  headerErrors,
  onChangeHeader,
  lines,
  lineErrors,
  itemNames,
  onPickItem,
  uomLookup,
  uomOptions,
  availableQty,
  onPatchLine,
  onRemoveLine,
  onAddLine,
  warehouseOptions,
  onChangeWarehouse,
  clearedWarehouseCount,
  businessUnitName,
  isLocked,
  isSubmitBlocked,
  isSaving,
  banner,
  onSubmit,
  onCancel,
}: StandaloneCreateDialogProps) => {
  const dateId = useId();
  const dateErrorId = `${dateId}-error`;
  const dateError = headerErrors.requestedShipDate;

  return (
    <Dialog
      open
      size="lg"
      className="sr-create-dialog"
      title={t.dialog.standaloneTitle}
      onClose={onCancel}
      footer={
        <>
          <Button variant="outlined" onClick={onCancel}>
            {t.actions.cancel}
          </Button>
          <Button disabled={isSubmitBlocked} loading={isSaving} onClick={onSubmit}>
            {t.dialog.submit}
          </Button>
        </>
      }
    >
      <p className="sr-create-dialog-intro">{t.dialog.intro}</p>

      <section aria-label={t.panes.header}>
        <div className="form-grid">
          <SelectField
            wide
            required
            label={t.fields.businessUnit}
            options={businessUnitOptions}
            value={businessUnitId}
            placeholder={t.fields.businessUnitPlaceholder}
            note={businessUnitNote}
            error={headerErrors.businessUnitId}
            disabled={isLocked}
            onChange={(value) => {
              onChangeHeader({ businessUnitId: value });
            }}
          />
          <SelectField
            wide
            required
            label={t.fields.customer}
            options={customerOptions}
            value={customerId}
            placeholder={t.fields.customerPlaceholder}
            note={customerNote}
            error={headerErrors.customerId}
            onChange={(value) => {
              onChangeHeader({ customerId: value });
            }}
          />
          <SelectField
            wide
            required
            label={t.fields.shipToPartner}
            options={shipToPartnerOptions}
            value={shipToPartnerId}
            placeholder={t.fields.shipToPartnerPlaceholder}
            note={shipToPartnerNote}
            error={headerErrors.shipToPartnerId}
            onChange={(value) => {
              onChangeHeader({ shipToPartnerId: value });
            }}
          />
          <div className="field-cell">
            <FieldLabel htmlFor={dateId} label={t.dialog.requestedShipDate} required />
            <DatePicker
              id={dateId}
              mode="single"
              placeholder={messages.common.selectDate}
              value={requestedShipDate === '' ? null : requestedShipDate}
              disabled={isLocked}
              invalid={dateError !== undefined}
              aria-required
              aria-describedby={dateError === undefined ? undefined : dateErrorId}
              onChange={(value) => {
                onChangeHeader({ requestedShipDate: value });
              }}
            />
            {dateError !== undefined && (
              <span id={dateErrorId} className="field-error">
                {dateError}
              </span>
            )}
          </div>
        </div>
      </section>

      <section className="sr-create-dialog-lines" aria-label={t.dialog.lines}>
        <div className="info-table-head">
          <h3 className="info-table-title">{t.dialog.lines}</h3>
          <span className="info-table-count">{messages.common.paneList.count(lines.length)}</span>
          <Button
            variant="outlined"
            size="sm"
            className="sr-create-add-line"
            leadingIcon={<Icon name="add" size={18} />}
            disabled={isLocked}
            onClick={onAddLine}
          >
            {t.dialog.addLine}
          </Button>
        </div>

        {clearedWarehouseCount > 0 && (
          <div className="banner-slot">
            <AlertBanner variant="warning" title={t.warehouseCleared.title(clearedWarehouseCount)}>
              {t.warehouseCleared.description(businessUnitName)}
            </AlertBanner>
          </div>
        )}

        <LineTable
          mode="standalone"
          rows={lines}
          errors={lineErrors}
          itemNames={itemNames}
          onPickItem={onPickItem}
          uomLookup={uomLookup}
          uomOptions={uomOptions}
          availableQty={availableQty}
          isLocked={isLocked}
          onPatch={onPatchLine}
          onRemove={onRemoveLine}
          warehouseOptions={warehouseOptions}
          hasBusinessUnit={businessUnitId !== ''}
          onChangeWarehouse={onChangeWarehouse}
          onSplit={() => undefined}
          salesOrderNo={null}
        />

        <ShortageBanner count={countShortageLines(lines, availableQty)} />
      </section>

      {banner}
    </Dialog>
  );
};
