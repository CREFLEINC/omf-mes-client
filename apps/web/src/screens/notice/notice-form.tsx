import { Checkbox, DatePicker, TextArea, TextField } from '@crefle/web-ui';
import type { ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import { SaveErrorBanner } from '../../patterns/master';
import { needsWorkOrder, SCOPE_CODES, isSupportedScope, scopeLabel } from './codes';
import { FieldLabel } from './field-label';
import { lookupNote, type LookupResult } from './lookups';
import type { DraftErrors, NoticeDraft } from './notice-draft';
import { SelectField } from './select-field';
import type { SelectOption } from './types';

const t = messages.notice;

export interface NoticeFormProps {
  draft: NoticeDraft;
  errors: DraftErrors;
  saveError: ApiError | null;
  fieldErrors: Record<string, string>;
  workOrders: LookupResult;
  onChange: (patch: Partial<NoticeDraft>) => void;
}

/**
 * ⚠ **쓸 수 없는 범위를 감추지 않는다.** 다섯 중 셋은 1차에서 서버가 거부하는데, 목록에서
 * 빼 버리면 「왜 없는가」를 물을 자리가 사라지고 나중에 열렸을 때 무엇이 열렸는지도 모른다.
 * 고를 수는 있게 두되 고르면 저장 전에 막고 사유를 낸다.
 */
const scopeOptions = (): SelectOption[] =>
  SCOPE_CODES.map((code) => ({
    value: code,
    label: isSupportedScope(code)
      ? scopeLabel(code)
      : `${scopeLabel(code)}${t.scope.unsupportedSuffix}`,
  }));

export const NoticeForm = ({
  draft,
  errors,
  saveError,
  fieldErrors,
  workOrders,
  onChange,
}: NoticeFormProps) => {
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const bodyId = `${baseId}-body`;
  const startId = `${baseId}-start`;
  const endId = `${baseId}-end`;

  const wantsWorkOrder = needsWorkOrder(draft.scopeCode);

  /** 필수인데 비어 있는 칸 — 빨간 테두리로 알리고, 값이 들어오면 걷는다(#361 · 긴급 작업지시와 같은 방식). */
  const emptyRequired = (value: string): string | undefined =>
    value.trim() === '' ? 'notice-required-empty' : undefined;

  return (
    <>
      <SaveErrorBanner error={saveError} />

      <div className="form-grid">
        <div className="field-cell form-grid-full">
          <FieldLabel htmlFor={titleId} label={t.form.title} required />
          <TextField
            id={titleId}
            aria-required="true"
            containerClassName={emptyRequired(draft.title)}
            value={draft.title}
            placeholder={t.form.titlePlaceholder}
            maxLength={200}
            error={errors.title ?? fieldErrors.title}
            onChange={(event) => {
              onChange({ title: event.target.value });
            }}
          />
        </div>

        <div className="field-cell form-grid-full">
          <FieldLabel htmlFor={bodyId} label={t.form.body} required />
          <TextArea
            id={bodyId}
            aria-required="true"
            containerClassName={emptyRequired(draft.body)}
            value={draft.body}
            placeholder={t.form.bodyPlaceholder}
            rows={6}
            fullWidth
            error={errors.body ?? fieldErrors.body}
            onChange={(event) => {
              onChange({ body: event.target.value });
            }}
          />
        </div>

        <div className="field-cell">
          <FieldLabel htmlFor={startId} label={t.form.startDate} required />
          <DatePicker
            id={startId}
            mode="single"
            clearable
            placeholder={t.filters.datePlaceholder}
            invalid={
              draft.startDate === '' || (errors.startDate ?? fieldErrors.startDate) !== undefined
            }
            value={draft.startDate === '' ? null : draft.startDate}
            onChange={(value) => {
              onChange({ startDate: value ?? '' });
            }}
          />
          {(errors.startDate ?? fieldErrors.startDate) !== undefined && (
            <span className="field-error">{errors.startDate ?? fieldErrors.startDate}</span>
          )}
        </div>

        <div className="field-cell">
          {/* 종료일은 선택 입력이다(#361) — 지나면 게시가 끝난다는 사실은 라벨 옆 ⓘ 로(관리웹 정리 시안 A). */}
          <FieldLabel htmlFor={endId} label={t.form.endDate} info={t.form.endDateNote} />
          <DatePicker
            id={endId}
            mode="single"
            clearable
            placeholder={t.filters.datePlaceholder}
            invalid={(errors.endDate ?? fieldErrors.endDate) !== undefined}
            value={draft.endDate === '' ? null : draft.endDate}
            onChange={(value) => {
              onChange({ endDate: value ?? '' });
            }}
          />
          {(errors.endDate ?? fieldErrors.endDate) !== undefined && (
            <span className="field-error">{errors.endDate ?? fieldErrors.endDate}</span>
          )}
        </div>

        <SelectField
          required
          label={t.form.scope}
          options={scopeOptions()}
          value={draft.scopeCode}
          /*
           * 전사의 뜻(새 계정도 대상)은 전사를 골랐을 때 라벨 옆 ⓘ 로. 1차 미지원 범위는 선택지 꼬리와
           * 저장 전 오류가 알린다 — 늘 펼친 「서버가 거부」 문장은 걷는다(관리웹 정리 시안 A).
           */
          info={draft.scopeCode === 'COMPANY' ? t.scope.companyNote : undefined}
          error={errors.scopeCode ?? fieldErrors.scopeCode}
          placeholder={t.form.scopePlaceholder}
          wide
          onChange={(value) => {
            /* 범위를 바꾸면 짝인 작업지시를 함께 정리한다 — 어긋난 짝은 서버가 거부한다. */
            onChange({ scopeCode: value, workOrder: needsWorkOrder(value) ? draft.workOrder : '' });
          }}
        />

        {/* 대상 작업지시는 대상 범위가 작업지시일 때만 보인다(#361). */}
        {wantsWorkOrder && (
          <SelectField
            required
            label={t.form.workOrder}
            options={workOrders.entries.map((entry) => ({
              value: entry.value,
              label: entry.label,
            }))}
            value={draft.workOrder}
            note={lookupNote(workOrders, t.form.workOrderLookupFailed)}
            error={errors.workOrder ?? fieldErrors.targetWorkOrderId}
            placeholder={t.form.workOrderPlaceholder}
            wide
            onChange={(value) => {
              onChange({ workOrder: value });
            }}
          />
        )}

        <div className="field-cell field-cell-unlabeled check-group">
          <Checkbox
            checked={draft.acknowledgeRequired}
            onChange={(event) => {
              onChange({ acknowledgeRequired: event.target.checked });
            }}
          >
            {t.form.acknowledgeRequired}
          </Checkbox>
        </div>
      </div>
    </>
  );
};
