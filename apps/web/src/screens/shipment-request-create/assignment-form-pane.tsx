import { Button, DatePicker } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, type ReactNode } from 'react';

import { FieldLabel } from './field-label';
import { HeaderActions } from './header-actions';
import { LineTable } from './line-table';
import {
  describeReference,
  toReference,
  type AvailableQtyLookup,
  type ReferenceSource,
} from './lookups';
import { SelectField } from './select-field';
import { ShortageBanner, countShortageLines } from './shortage-banner';
import type {
  AssignmentMode,
  CreatedShipmentRequestView,
  SelectOption,
  ShipmentRequestLineDraft,
} from './types';

const t = messages.shipmentRequestCreate;

export interface HeaderFieldPatch {
  customerId?: string;
  shipToPartnerId?: string;
  requestedShipDate?: string;
}

export interface AssignmentFormPaneProps {
  mode: AssignmentMode;
  customerId: string;
  shipToPartnerId: string;
  requestedShipDate: string;
  customerOptions: SelectOption[];
  shipToPartnerOptions: SelectOption[];
  customerLookup: ReferenceSource;
  shipToPartnerLookup: ReferenceSource;
  customerNote?: string;
  shipToPartnerNote?: string;
  /** 화면이 잡은 로컬 오류와 서버가 준 필드 오류를 합친 것. */
  headerErrors: Record<string, string>;
  onChangeHeader: (patch: HeaderFieldPatch) => void;

  lines: ShipmentRequestLineDraft[];
  lineErrors: Record<string, string>;
  itemLookup: ReferenceSource;
  uomLookup: ReferenceSource;
  itemOptions: SelectOption[];
  uomOptions: SelectOption[];
  availableQty: AvailableQtyLookup;
  onPatchLine: (key: string, patch: Partial<Omit<ShipmentRequestLineDraft, 'key'>>) => void;
  onRemoveLine: (key: string) => void;
  onAddLine: () => void;

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
  shipToPartnerId,
  requestedShipDate,
  customerOptions,
  shipToPartnerOptions,
  customerLookup,
  shipToPartnerLookup,
  customerNote,
  shipToPartnerNote,
  headerErrors,
  onChangeHeader,
  lines,
  lineErrors,
  itemLookup,
  uomLookup,
  itemOptions,
  uomOptions,
  availableQty,
  onPatchLine,
  onRemoveLine,
  onAddLine,
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
        <LineTable
          mode={mode}
          rows={lines}
          errors={lineErrors}
          itemLookup={itemLookup}
          uomLookup={uomLookup}
          itemOptions={itemOptions}
          uomOptions={uomOptions}
          availableQty={availableQty}
          isLocked={isLocked}
          onPatch={onPatchLine}
          onRemove={onRemoveLine}
        />

        <p className="field-note">{t.notes.lineNoAssignedByServer}</p>

        {!isFromOrder && (
          <div className="filter-bar">
            <div className="field-cell">
              <Button variant="outlined" disabled={isLocked} onClick={onAddLine}>
                {t.actions.addLine}
              </Button>
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
