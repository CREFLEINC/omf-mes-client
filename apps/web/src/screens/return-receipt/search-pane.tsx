import { Button, DatePicker, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState } from 'react';

import { hasChangedFilters } from '../../patterns/filter-more';
import { InfoLabel } from '../../patterns/info-tip';
import { isUsable, type SearchFilters } from './filters';
import type { CodeOptionSource } from './lookups';
import { SelectField } from './select-field';

const t = messages.returnReceipt;

export interface SearchPaneProps {
  applied: SearchFilters;
  /** 처음 값(최근 한 달) — 「초기화」가 되돌리는 값이고, 이 값과 다를 때만 「초기화」가 보인다. */
  defaults: SearchFilters;
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
 *
 * 보이는 조건은 셋이라 「조건 더보기」가 없다(C-6). 「초기화」는 바뀐 것이 있을 때만 보인다.
 */
export const SearchPane = ({
  applied,
  defaults,
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

  /*
   * 초기화. **편집 중인 값도 함께 되돌린다** — 조회한 값이 이미 처음 값이면 주소가 바뀌지 않아
   * 되돌림 effect 가 깨어나지 않고, 치던 값이 그대로 남는다.
   */
  const reset = (): void => {
    setDraft(defaults);
    onReset();
  };

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
          {/* 기간을 비울 수 없다는 규칙은 라벨 옆 ⓘ 로, 칸 아래에는 막혔을 때만 이유를 적는다(관리웹 정리 시안 A). */}
          {/* 기간은 비우면 조회를 막는다 — 조회 필수 표시. */}
          <InfoLabel
            htmlFor={periodId}
            label={t.fields.shipDate}
            info={t.search.periodRequired}
            required
          />
          <DatePicker
            id={periodId}
            mode="range"
            value={[draft.from === '' ? null : draft.from, draft.to === '' ? null : draft.to]}
            placeholder={messages.common.selectDate}
            aria-describedby={isUsable(draft) ? undefined : periodNoteId}
            onChange={([nextFrom, nextTo]) =>
              setDraft((current) => ({ ...current, from: nextFrom ?? '', to: nextTo ?? '' }))
            }
          />
          {!isUsable(draft) && (
            <span id={periodNoteId} className="field-note">
              {draft.from === '' || draft.to === ''
                ? t.search.periodRequired
                : t.search.periodReversed}
            </span>
          )}
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
            {hasChangedFilters(defaults, draft, applied) && (
              <Button variant="outlined" onClick={reset}>
                {t.actions.reset}
              </Button>
            )}
          </div>
        </div>
      </div>
      {/* 「원 출하를 못 찾으면 직접 입력」 안내는 걷었다 — 단추 이름이 같은 말을 한다(관리웹 정리 시안 A). */}
      <div className="form-actions return-receipt-direct">
        <Button variant="outlined" size="sm" aria-pressed={isDirect} onClick={onDirect}>
          {t.actions.withoutShipment}
        </Button>
      </div>
    </>
  );
};
