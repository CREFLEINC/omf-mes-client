import { Chip, DatePicker, SearchInput, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import { lookupDisplayLabel } from '../../patterns/lookup-display';
import { FieldLabel } from './field-label';
import type { LookupResult } from './lookups';
import { SelectField } from './select-field';
import type { SelectOption, WorkOrderView } from './types';

const t = messages.materialIssueRequest;

export interface TargetPaneProps {
  /** 치고 있는 검색어. 확정(Enter·버튼)해야 요청이 나간다 */
  searchDraft: string;
  onChangeSearchDraft: (value: string) => void;
  onSearch: (value: string) => void;
  isSearching: boolean;
  workOrderOptions: SelectOption[];
  workOrderNote?: string;
  workOrderId: string;
  onSelectWorkOrder: (value: string) => void;
  /** 고른 W/O 의 요약. 선택칸 라벨에 담기지 않는 값(지시수량·유형)을 아래에 편다 */
  selectedWorkOrder: WorkOrderView | null;
  uomLookup: LookupResult;
  warehouseOptions: SelectOption[];
  warehouseNote?: string;
  warehouseId: string;
  onChangeWarehouse: (value: string) => void;
  locationOptions: SelectOption[];
  locationNote?: string;
  destinationLocationId: string;
  onChangeDestination: (value: string) => void;
  requiredDate: string;
  requiredTime: string;
  onChangeRequiredDate: (value: string) => void;
  onChangeRequiredTime: (value: string) => void;
  /** 화면이 잡은 것과 서버가 준 것을 합친 머리 오류 */
  headerErrors: Record<string, string>;
  isLocked: boolean;
}

/**
 * 구획 ① — 대상 W/O 와 도착 위치.
 *
 * ⭐ **창고칸이 스펙 §3 에 없는 칸이다.** `GET /mdm/locations` 가 `warehouseId` 를 필수로
 * 요구해(계약 실측) 위치 목록을 창고 없이 받을 수 없다. W/O 를 고르면 기본 재공 위치를 거쳐
 * 자동으로 채워지므로 대개 사용자가 만지지 않는다.
 *
 * **주소가 이 화면의 상태를 소유하지 않는다.** 목록 화면이 아니라 폼이고, 되돌릴 수 없는 쓰기가
 * 걸린 초안을 주소로 되살리면 「무엇을 발행하려던 것인가」가 흐려진다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const TargetPane = ({
  searchDraft,
  onChangeSearchDraft,
  onSearch,
  isSearching,
  workOrderOptions,
  workOrderNote,
  workOrderId,
  onSelectWorkOrder,
  selectedWorkOrder,
  uomLookup,
  warehouseOptions,
  warehouseNote,
  warehouseId,
  onChangeWarehouse,
  locationOptions,
  locationNote,
  destinationLocationId,
  onChangeDestination,
  requiredDate,
  requiredTime,
  onChangeRequiredDate,
  onChangeRequiredTime,
  headerErrors,
  isLocked,
}: TargetPaneProps) => {
  const dateId = useId();
  const requiredAtErrorId = useId();
  const requiredAtError = headerErrors.requiredAt;

  return (
    <section className="pane material-issue-request-pane" aria-label={t.panes.target}>
      <h2 className="pane-title">{t.panes.target}</h2>

      <div className="filter-bar material-issue-request-target-search">
        <div className="field-cell">
          <SearchInput
            label={t.formFields.workOrderSearch}
            placeholder={t.placeholders.workOrderSearch}
            value={searchDraft}
            loading={isSearching}
            disabled={isLocked}
            onChange={(event) => {
              onChangeSearchDraft(event.target.value);
            }}
            onSearch={onSearch}
          />
        </div>
      </div>

      <div className="form-grid">
        <SelectField
          wide
          required
          label={t.formFields.workOrder}
          options={workOrderOptions}
          value={workOrderId}
          placeholder={t.placeholders.select}
          note={workOrderNote}
          error={headerErrors.workOrderId}
          disabled={isLocked}
          onChange={onSelectWorkOrder}
        />

        {selectedWorkOrder !== null && (
          <div className="field-cell field-cell-unlabeled">
            {/*
             * ⚠ **래퍼를 두는 이유가 있다.** `.form-grid .field-cell` 은 `align-items: stretch` 다
             * (배치 규범 3-1 — 선택칸이 칸 폭을 받게 하려는 규칙). 그 밑에 `Chip` 을 바로 놓으면
             * **칩이 칸 폭 전체로 늘어나 파란 띠가 된다**(브라우저에서 851px 로 실측). 블록 래퍼
             * 안에서는 칩이 인라인 상자라 제 내용 폭을 갖는다.
             */}
            <div>
              <span>
                {t.values.orderQty(
                  String(selectedWorkOrder.orderQty),
                  lookupDisplayLabel(uomLookup, selectedWorkOrder.uomId),
                )}
              </span>{' '}
              {/* 유형 글자를 서버가 준 그대로 보인다 — 값으로 분기하지 않는다(공유계약 G-2). */}
              <Chip variant="status" status="info" size="sm">
                {t.values.workOrderType(selectedWorkOrder.workOrderTypeCode)}
              </Chip>
            </div>
          </div>
        )}

        <SelectField
          wide
          label={t.formFields.warehouse}
          options={warehouseOptions}
          value={warehouseId}
          placeholder={t.placeholders.select}
          note={warehouseNote}
          disabled={isLocked}
          onChange={onChangeWarehouse}
        />

        <SelectField
          wide
          required
          label={t.formFields.destinationLocation}
          options={locationOptions}
          value={destinationLocationId}
          placeholder={t.placeholders.select}
          note={locationNote}
          error={headerErrors.destinationLocationId}
          disabled={isLocked}
          onChange={onChangeDestination}
        />

        {/*
         * `DatePicker`에는 `label`·`error` prop이 없다(설치본 실측) — 라벨을 직접 만들고 오류는
         * 항상 보이는 DOM 텍스트로 렌더해 `aria-describedby`로 잇는다(배치 규범 3).
         *
         * 필요 시각은 **선택**이지만 반쪽으로 두지 않는다 — 오류 문구는 시각 칸 아래 한 자리에서만
         * 그린다. 두 칸이 각자 그리면 같은 문장이 두 번 서고 `id`가 갈린다.
         */}
        <div className="field-cell">
          <FieldLabel htmlFor={dateId} label={t.formFields.requiredDate} />
          <DatePicker
            id={dateId}
            mode="single"
            placeholder={messages.common.selectDate}
            value={requiredDate === '' ? null : requiredDate}
            disabled={isLocked}
            invalid={requiredAtError !== undefined}
            aria-describedby={requiredAtError === undefined ? undefined : requiredAtErrorId}
            onChange={onChangeRequiredDate}
          />
        </div>

        <div className="field-cell">
          <TextField
            type="time"
            label={t.formFields.requiredTime}
            value={requiredTime}
            disabled={isLocked}
            aria-invalid={requiredAtError !== undefined}
            aria-describedby={requiredAtError === undefined ? undefined : requiredAtErrorId}
            onChange={(event) => {
              onChangeRequiredTime(event.target.value);
            }}
          />
          {requiredAtError !== undefined && (
            <span id={requiredAtErrorId} className="field-error">
              {requiredAtError}
            </span>
          )}
        </div>
      </div>
    </section>
  );
};
