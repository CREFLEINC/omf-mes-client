import { Button, Chip, DatePicker, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, useState } from 'react';

import { FieldLabel } from './field-label';
import { derivedTypeLabel, usesBaseDate, type DraftErrors, type OrderDraft } from './order-draft';
import { SelectField } from './select-field';
import type { SelectOption, TriggerDraft } from './types';

const t = messages.maintenanceOrder;

export interface OrderFormProps {
  draft: OrderDraft;
  triggers: TriggerDraft[];
  errors: DraftErrors;
  equipmentOptions: SelectOption[];
  userOptions: SelectOption[];
  itemOptions: SelectOption[];
  equipmentNote?: string;
  userNote?: string;
  itemNote?: string;
  isSaving: boolean;
  onChange: (draft: OrderDraft) => void;
  onSubmit: () => void;
  onReset: () => void;
}

/**
 * 지시 발행 폼.
 *
 * ⭐ **보전 유형을 고르지 않는다** — 트리거 조합이 정한다(고장이 하나라도 섞이면 사후).
 * 화면은 **무엇이 될지 미리 보여 주기만** 한다: 발행한 뒤에 유형을 보고 놀라지 않게.
 * ⛔ 「예지」는 값을 두되 고를 수 없다 — 트리거가 아직 없다. 감추지 않고 사유를 붙인다.
 *
 * ⚠ **담당자 칸이 내부 사용자만 가리킨다.** 외주 인력을 담을 자리가 없어(설계가 「만들지
 * 않는다」로 정했다) 그 사실을 칸 아래에 적고 지시 내용으로 유도한다.
 *
 * ⭐ **주기 기준일은 예방보전에만** 적는다. 사후인데 실리면 다음 주기가 엉뚱한 날부터 시작한다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const OrderForm = ({
  draft,
  triggers,
  errors,
  equipmentOptions,
  userOptions,
  itemOptions,
  equipmentNote,
  userNote,
  itemNote,
  isSaving,
  onChange,
  onSubmit,
  onReset,
}: OrderFormProps) => {
  const plannedId = useId();
  const baseId = `${plannedId}-base`;
  const noteId = `${plannedId}-note`;
  const [itemToAdd, setItemToAdd] = useState('');

  const baseDateOpen = usesBaseDate(triggers);
  const set = (patch: Partial<OrderDraft>): void => {
    onChange({ ...draft, ...patch });
  };

  const itemLabel = (id: string): string =>
    itemOptions.find((option) => option.value === id)?.label ?? id;

  return (
    <div className="maintenance-order-form-content">
      <div className="form-grid maintenance-order-form-grid">
        <SelectField
          label={t.form.target}
          options={equipmentOptions}
          value={draft.target}
          note={equipmentNote}
          error={errors.target}
          placeholder={t.form.itemPlaceholder}
          wide
          onChange={(value) => {
            set({ target: value });
          }}
        />

        <div className="field-cell">
          <FieldLabel htmlFor={plannedId} label={t.form.plannedDate} />
          <DatePicker
            id={plannedId}
            mode="single"
            clearable
            placeholder={messages.common.selectDate}
            invalid={errors.plannedDate !== undefined}
            value={draft.plannedDate === '' ? null : draft.plannedDate}
            onChange={(value) => {
              set({ plannedDate: value ?? '' });
            }}
          />
          {errors.plannedDate !== undefined && (
            <span className="field-error">{errors.plannedDate}</span>
          )}
        </div>

        <SelectField
          label={t.form.assignee}
          options={userOptions}
          value={draft.assignee}
          /* ⚠ 외주는 이 칸에 담을 수 없다 — 그 사실을 칸 아래에 상시로 적는다. */
          note={userNote ?? t.form.assigneeExternalNote}
          error={errors.assignee}
          placeholder={t.form.itemPlaceholder}
          wide
          onChange={(value) => {
            set({ assignee: value });
          }}
        />

        <div className="field-cell">
          <FieldLabel htmlFor={baseId} label={t.form.baseDate} />
          <DatePicker
            id={baseId}
            mode="single"
            clearable
            placeholder={messages.common.selectDate}
            disabled={!baseDateOpen}
            invalid={errors.baseDate !== undefined}
            value={draft.baseDate === '' ? null : draft.baseDate}
            onChange={(value) => {
              set({ baseDate: value ?? '' });
            }}
          />
          <span className="field-note">
            {baseDateOpen ? t.form.baseDateNote : t.form.baseDateCorrective}
          </span>
          {errors.baseDate !== undefined && <span className="field-error">{errors.baseDate}</span>}
        </div>

        {/* ⭐ 유형은 고르는 칸이 아니라 보여 주는 값이다 — 트리거 조합이 정한다. */}
        <div className="field-cell">
          <span className="field-label">{t.form.maintenanceType}</span>
          <span>
            <Chip size="sm">{derivedTypeLabel(triggers)}</Chip>
            {/* ⛔ 예지는 값을 두되 고를 수 없다 — 감추면 「왜 없나」를 알 수 없다. */}
            <Chip size="sm" status="idle">
              {t.form.predictive}
            </Chip>
          </span>
          <span className="field-note">{t.form.maintenanceTypeDerived}</span>
          <span className="field-note">{t.form.predictiveLocked}</span>
        </div>

        <div className="field-cell form-grid-full">
          <FieldLabel htmlFor={noteId} label={t.form.orderNote} />
          <TextField
            id={noteId}
            value={draft.orderNote}
            helperText={t.form.orderNoteHint}
            onChange={(event) => {
              set({ orderNote: event.target.value });
            }}
          />
        </div>
      </div>

      <h3>{t.form.items}</h3>
      <p className="pane-lead">{t.form.itemsLead}</p>
      <div className="filter-bar maintenance-order-item-filter">
        <SelectField
          label={t.form.items}
          options={itemOptions.filter((option) => !draft.itemIds.includes(option.value))}
          value={itemToAdd}
          note={itemNote}
          error={errors.itemIds}
          placeholder={t.form.itemPlaceholder}
          wide
          onChange={setItemToAdd}
        />
        <div className="field-cell field-cell-unlabeled maintenance-order-item-actions">
          <div className="filter-actions">
            <Button
              variant="outlined"
              disabled={itemToAdd === ''}
              onClick={() => {
                set({ itemIds: [...draft.itemIds, itemToAdd] });
                setItemToAdd('');
              }}
            >
              {t.form.addItem}
            </Button>
          </div>
        </div>
      </div>

      {draft.itemIds.length > 0 && (
        <ul className="alert-list">
          {draft.itemIds.map((id) => (
            <li key={id}>
              <span className="notification-card-meta">
                <Chip size="sm">{itemLabel(id)}</Chip>
                <Button
                  size="sm"
                  variant="text"
                  onClick={() => {
                    set({ itemIds: draft.itemIds.filter((value) => value !== id) });
                  }}
                >
                  {t.form.removeItem}
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="form-actions">
        <Button variant="outlined" onClick={onReset} disabled={isSaving}>
          {t.form.reset}
        </Button>
        <Button onClick={onSubmit} disabled={isSaving}>
          {t.form.submit}
        </Button>
      </div>
      {errors.triggers !== undefined && <p className="pane-lead">{errors.triggers}</p>}
    </div>
  );
};
