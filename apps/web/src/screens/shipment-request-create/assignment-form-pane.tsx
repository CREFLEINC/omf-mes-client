import { AlertBanner, Button, DatePicker, type SelectItems } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, type ReactNode } from 'react';

import { FieldLabel } from './field-label';
import { HeaderActions } from './header-actions';
import { LineTable } from './line-table';
import {
  describeReference,
  toReference,
  type AvailableQtyLookup,
  type ItemNameLookup,
  type ReferenceSource,
} from './lookups';
import { SelectField } from './select-field';
import { ShortageBanner, countShortageLines } from './shortage-banner';
import type { SplitGroup } from './validation';
import type {
  AssignmentMode,
  CreatedShipmentRequestView,
  SelectOption,
  ShipmentRequestLineDraft,
} from './types';

const t = messages.shipmentRequestCreate;

export interface HeaderFieldPatch {
  businessUnitId?: string;
  customerId?: string;
  shipToPartnerId?: string;
  requestedShipDate?: string;
}

export interface AssignmentFormPaneProps {
  mode: AssignmentMode;
  customerId: string;
  /** 지시서 사업부(피처 012 FR-002) — 「출하 담당 공장」 자리. */
  businessUnitId: string;
  shipToPartnerId: string;
  requestedShipDate: string;
  customerOptions: SelectOption[];
  businessUnitOptions: SelectOption[];
  /** 계정 범위의 사업부가 하나라 자동으로 채웠는가 — 칸 아래에 그 사실을 적는다. */
  businessUnitAutoFilled: boolean;
  shipToPartnerOptions: SelectOption[];
  customerLookup: ReferenceSource;
  businessUnitNote?: string;
  shipToPartnerLookup: ReferenceSource;
  customerNote?: string;
  shipToPartnerNote?: string;
  /** 화면이 잡은 로컬 오류와 서버가 준 필드 오류를 합친 것. */
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
  /** 출고 창고(피처 012). */
  warehouseOptions: SelectItems;
  onChangeWarehouse: (key: string, warehouseId: string) => void;
  onSplit: (key: string) => void;
  salesOrderNo: string | null;
  /** 나눈 줄 묶음 합계(FR-005) — 표 아래 묶음마다 한 줄. */
  splitGroups: SplitGroup[];
  /** 창고 이름 풀이 — 묶음 합계의 「창고 수량」 조각. */
  warehouseNameOf: (warehouseId: string) => string | undefined;
  /** 사업부를 바꿔 창고를 비운 줄 수와 지금 사업부 이름 — 띠(FR-004 · US1-7). */
  clearedWarehouseCount: number;
  businessUnitName: string;

  /** 나가는 중과 이미 편성한 뒤가 같은 잠금을 쓴다 — 사유는 `submitBlockReason`이 한 번 낸다. */
  isLocked: boolean;
  submitBlockReason: string | null;
  banner: ReactNode;
  created: CreatedShipmentRequestView | null;
  onSubmit: () => void;
}

/**
 * 출하작업지시 편성 폼 — 헤더 3항목(고객·납품처·출하요청일) + 라인 편집 그리드 + 결과안내 + 버튼.
 *
 * **지시서 경유는 고객·납품처가 잠긴다**(완료 조건 C2). 값을 보여 주기만 하면 되는 자리는 폼
 * 컨트롤을 잠그지 말고 **값 표기**로 낸다 — 디자인 시스템 `docs/patterns.md`의 「읽기 전용 구획
 * 배치」를 따른 것이다. **단독 생성은 선택칸으로 직접 고른다**(완료 조건 C3).
 *
 * **출하요청일은 두 모드 모두 편집한다** — 계약에 승계 원천이 없는 값이라 사용자가 늘 정한다.
 *
 * 두 `<section className="pane">`를 반환한다 — 두 칸 배치의 우 칸(`.pane-stack`)이 그대로
 * 쌓는다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const AssignmentFormPane = ({
  mode,
  customerId,
  businessUnitId,
  shipToPartnerId,
  requestedShipDate,
  customerOptions,
  businessUnitOptions,
  businessUnitAutoFilled,
  shipToPartnerOptions,
  customerLookup,
  businessUnitNote,
  shipToPartnerLookup,
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
  onSplit,
  salesOrderNo,
  splitGroups,
  warehouseNameOf,
  clearedWarehouseCount,
  businessUnitName,
  isLocked,
  submitBlockReason,
  banner,
  created,
  onSubmit,
}: AssignmentFormPaneProps) => {
  const isFromOrder = mode === 'fromOrder';
  const dateId = useId();
  const dateErrorId = `${dateId}-error`;
  const dateError = headerErrors.requestedShipDate;
  const customerValueId = useId();
  const shipToPartnerValueId = useId();

  return (
    <>
      <section className="pane" aria-label={t.panes.header}>
        {isFromOrder && <p className="field-note">{t.notes.fromOrderLocked}</p>}

        <div className="form-grid">
          {/*
           * ⭐ 「출하 담당 공장」 자리에 「사업부」(피처 012 FR-002). 계정 범위의 사업부가 하나면 채워서 연다.
           */}
          <SelectField
            wide
            required
            label={t.fields.businessUnit}
            options={businessUnitOptions}
            value={businessUnitId}
            note={businessUnitNote ?? (businessUnitAutoFilled ? t.notes.businessUnitAutoFilled : undefined)}
            error={headerErrors.businessUnitId}
            disabled={isLocked}
            onChange={(value) => {
              onChangeHeader({ businessUnitId: value });
            }}
          />

          {isFromOrder ? (
            <div className="field-cell">
              <span id={customerValueId} className="field-label">
                {t.fields.customer}
              </span>
              <p aria-labelledby={customerValueId}>
                {describeReference(toReference(customerLookup, Number(customerId)))}
              </p>
            </div>
          ) : (
            <SelectField
              wide
              required
              label={t.fields.customer}
              options={customerOptions}
              value={customerId}
              note={customerNote}
              error={headerErrors.customerId}
              onChange={(value) => {
                onChangeHeader({ customerId: value });
              }}
            />
          )}

          {isFromOrder ? (
            <div className="field-cell">
              <span id={shipToPartnerValueId} className="field-label">
                {t.fields.shipToPartner}
              </span>
              <p aria-labelledby={shipToPartnerValueId}>
                {describeReference(toReference(shipToPartnerLookup, Number(shipToPartnerId)))}
              </p>
            </div>
          ) : (
            <SelectField
              wide
              required
              label={t.fields.shipToPartner}
              options={shipToPartnerOptions}
              value={shipToPartnerId}
              note={shipToPartnerNote}
              error={headerErrors.shipToPartnerId}
              onChange={(value) => {
                onChangeHeader({ shipToPartnerId: value });
              }}
            />
          )}

          {/*
           * `DatePicker`에는 `label`·`error` prop이 없다(설치본 실측) — 라벨을 직접 만들고
           * 오류는 항상 보이는 DOM 텍스트로 렌더해 `aria-describedby`로 잇는다(배치 규범 3).
           */}
          <div className="field-cell">
            <FieldLabel htmlFor={dateId} label={t.fields.requestedShipDate} required />
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

      <section className="pane" aria-label={t.panes.lines}>
        {clearedWarehouseCount > 0 && (
          <div className="banner-slot">
            <AlertBanner variant="warning" title={t.warehouseCleared.title(clearedWarehouseCount)}>
              {t.warehouseCleared.description(businessUnitName)}
            </AlertBanner>
          </div>
        )}

        <LineTable
          mode={mode}
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
          onSplit={onSplit}
          salesOrderNo={salesOrderNo}
        />

        {splitGroups.length > 0 && (
          <ul className="sr-split-totals" aria-label={t.actions.splitLine}>
            {splitGroups.map((group) => {
              const source =
                salesOrderNo === null || group.salesOrderLineNo === null
                  ? t.values.empty
                  : t.lineTable.salesOrderLineRef(salesOrderNo, group.salesOrderLineNo);
              const parts = group.lines
                .map((line) =>
                  t.lineTable.splitPart(
                    warehouseNameOf(line.warehouseId) ?? t.values.empty,
                    Number(line.allocatedQty) || 0,
                  ),
                )
                .join(', ');

              return (
                <li key={group.originKey} className={group.isOver ? 'field-error' : 'field-note'}>
                  {group.isOver
                    ? t.errors.splitOverRemaining(group.total, group.remaining, parts)
                    : t.lineTable.splitTotal(source, group.remaining, group.total, parts)}
                </li>
              );
            })}
          </ul>
        )}

        <p className="field-note">{t.notes.lineNoAssignedByServer}</p>

        {!isFromOrder && (
          <div className="filter-bar">
            <div className="field-cell">
              <Button variant="outlined" disabled={isLocked} onClick={onAddLine}>
                {t.actions.addLine}
              </Button>
              <span className="field-note">{t.notes.addLineWarehouse}</span>
            </div>
          </div>
        )}

        <ShortageBanner count={countShortageLines(lines, availableQty)} />

        <HeaderActions
          submitBlockReason={submitBlockReason}
          banner={banner}
          created={created}
          onSubmit={onSubmit}
        />
      </section>
    </>
  );
};
