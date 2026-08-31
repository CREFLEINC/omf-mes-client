import { Button, Checkbox, DatePicker, TextField } from '@crefle/web-ui';
import type { ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { TextArea } from '@omf-mes/ui';
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
  isSaving: boolean;
  saveError: ApiError | null;
  fieldErrors: Record<string, string>;
  workOrders: LookupResult;
  onChange: (patch: Partial<NoticeDraft>) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

/**
 * ⚠ **쓸 수 없는 범위를 감추지 않는다.** 다섯 중 셋은 1차에서 서버가 거부하는데, 목록에서
 * 빼 버리면 「왜 없는가」를 물을 자리가 사라지고 나중에 열렸을 때 무엇이 열렸는지도 모른다.
 * 고를 수는 있게 두되 고르면 저장 전에 막고 사유를 낸다.
 */
const scopeOptions = (): SelectOption[] =>
  SCOPE_CODES.map((code) => ({
    value: code,
    label: isSupportedScope(code) ? scopeLabel(code) : `${scopeLabel(code)} (1차 미지원)`,
  }));

export const NoticeForm = ({
  draft,
  errors,
  isSaving,
  saveError,
  fieldErrors,
  workOrders,
  onChange,
  onSubmit,
  onCancel,
}: NoticeFormProps) => {
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const bodyId = `${baseId}-body`;
  const startId = `${baseId}-start`;
  const endId = `${baseId}-end`;

  const wantsWorkOrder = needsWorkOrder(draft.scopeCode);

  return (
    <>
      <SaveErrorBanner error={saveError} />

      <div className="form-grid">
        <div className="field-cell form-grid-full">
          <FieldLabel htmlFor={titleId} label={t.form.title} />
          <TextField
            id={titleId}
            value={draft.title}
            maxLength={200}
            error={errors.title ?? fieldErrors.title}
            onChange={(event) => {
              onChange({ title: event.target.value });
            }}
          />
        </div>

        <div className="field-cell form-grid-full">
          <FieldLabel htmlFor={bodyId} label={t.form.body} />
          <TextArea
            id={bodyId}
            value={draft.body}
            rows={6}
            fullWidth
            error={errors.body ?? fieldErrors.body}
            onChange={(event) => {
              onChange({ body: event.target.value });
            }}
          />
          {/* ⛔ 첨부는 아직 열 수 없다 — 감추지 않고 사유를 적는다. */}
          <span className="field-note">{t.form.attachmentLocked}</span>
        </div>

        <div className="field-cell">
          <FieldLabel htmlFor={startId} label={t.form.startDate} />
          <DatePicker
            id={startId}
            mode="single"
            clearable
            placeholder={messages.common.selectDate}
            invalid={(errors.startDate ?? fieldErrors.startDate) !== undefined}
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
          <FieldLabel htmlFor={endId} label={t.form.endDate} />
          <DatePicker
            id={endId}
            mode="single"
            clearable
            placeholder={messages.common.selectDate}
            invalid={(errors.endDate ?? fieldErrors.endDate) !== undefined}
            value={draft.endDate === '' ? null : draft.endDate}
            onChange={(value) => {
              onChange({ endDate: value ?? '' });
            }}
          />
          <span className="field-note">{t.form.endDateNote}</span>
          {(errors.endDate ?? fieldErrors.endDate) !== undefined && (
            <span className="field-error">{errors.endDate ?? fieldErrors.endDate}</span>
          )}
        </div>

        <SelectField
          label={t.form.scope}
          options={scopeOptions()}
          value={draft.scopeCode}
          note={draft.scopeCode === 'COMPANY' ? t.scope.companyNote : t.scope.unsupported}
          error={errors.scopeCode ?? fieldErrors.scopeCode}
          placeholder={t.form.selectPlaceholder}
          wide
          onChange={(value) => {
            /* 범위를 바꾸면 짝인 작업지시를 함께 정리한다 — 어긋난 짝은 서버가 거부한다. */
            onChange({ scopeCode: value, workOrder: needsWorkOrder(value) ? draft.workOrder : '' });
          }}
        />

        <SelectField
          label={t.form.workOrder}
          options={workOrders.entries.map((entry) => ({
            value: entry.value,
            label: entry.label,
          }))}
          value={draft.workOrder}
          note={lookupNote(workOrders, t.form.workOrderLookupFailed) ?? t.form.workOrderNote}
          error={errors.workOrder ?? fieldErrors.targetWorkOrderId}
          placeholder={t.form.selectPlaceholder}
          disabled={!wantsWorkOrder}
          wide
          onChange={(value) => {
            onChange({ workOrder: value });
          }}
        />

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

      <div className="form-actions">
        {isSaving && <p className="field-note form-actions-secondary">{t.form.saving}</p>}
        <Button variant="outlined" disabled={isSaving} onClick={onCancel}>
          {t.form.cancel}
        </Button>
        <Button disabled={isSaving} onClick={onSubmit}>
          {t.form.save}
        </Button>
      </div>
    </>
  );
};
