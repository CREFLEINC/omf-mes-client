import { Button, DatePicker, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState } from 'react';

import { isUsable, type SearchFilters } from './filters';
import type { CodeOptionSource } from './lookups';
import { SelectField } from './select-field';

const t = messages.returnReceipt;

export interface SearchPaneProps {
  applied: SearchFilters;
  customers: CodeOptionSource;
  isDirect: boolean;
  onApply: (filters: SearchFilters) => void;
  onReset: () => void;
  /** 원 출하 없이 등록 — 못 찾는 것이 정상이라 항상 열려 있다(§5-3). */
  onDirect: () => void;
}

const optionNote = (source: CodeOptionSource): string | undefined => {
  if (source.isError) return t.lookupFailed;
  if (source.isLoading) return t.lookupLoading;
  if (source.options.length === 0) return t.codePending;

  return undefined;
};

/**
 * ① 원 출하 찾기의 조건 — 고객 · 출하일 기간 · 검색어. **기간은 비울 수 없다**(L-3).
 * 조건은 주소가 정본이라 여기서는 초안만 들고 「조회」때 올린다.
 */
export const SearchPane = ({
  applied,
  customers,
  isDirect,
  onApply,
  onReset,
  onDirect,
}: SearchPaneProps) => {
  const periodId = useId();
  const periodNoteId = `${periodId}-note`;
  const [draft, setDraft] = useState<SearchFilters>(applied);
  const { customerId, from, to, q } = applied;

  useEffect(() => {
    setDraft({ customerId, from, to, q });
  }, [customerId, from, to, q]);

  return (
    <>
      <div className="filter-bar return-receipt-filters">
        <SelectField
          label={t.fields.customer}
          options={[{ value: '', label: t.all }, ...customers.options]}
          value={draft.customerId}
          placeholder={t.all}
          note={optionNote(customers)}
          onChange={(value) => setDraft((current) => ({ ...current, customerId: value }))}
          wide
        />
        <div className="field-cell">
          <label className="field-label" htmlFor={periodId}>
            {t.fields.shipDate}
          </label>
          <DatePicker
            id={periodId}
            mode="range"
            value={[draft.from === '' ? null : draft.from, draft.to === '' ? null : draft.to]}
            placeholder={messages.common.selectDate}
            aria-describedby={periodNoteId}
            onChange={([nextFrom, nextTo]) =>
              setDraft((current) => ({ ...current, from: nextFrom ?? '', to: nextTo ?? '' }))
            }
          />
          <span id={periodNoteId} className="field-note">
            {isUsable(draft) || draft.from === '' || draft.to === ''
              ? t.search.periodRequired
              : t.search.periodReversed}
          </span>
        </div>
        <TextField
          label={t.fields.keyword}
          value={draft.q}
          placeholder={t.keywordPlaceholder}
          fullWidth
          onChange={(event) => setDraft((current) => ({ ...current, q: event.target.value }))}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && isUsable(draft)) onApply(draft);
          }}
        />
        <div className="field-cell field-cell-unlabeled">
          <div className="filter-actions">
            <Button disabled={!isUsable(draft)} onClick={() => onApply(draft)}>
              {t.actions.search}
            </Button>
            <Button variant="outlined" onClick={onReset}>
              {t.actions.reset}
            </Button>
          </div>
        </div>
      </div>
      <div className="form-actions return-receipt-direct">
        <p className="field-note form-actions-secondary">{t.search.notFoundHint}</p>
        <Button variant="outlined" size="sm" aria-pressed={isDirect} onClick={onDirect}>
          {t.actions.withoutShipment}
        </Button>
      </div>
    </>
  );
};
