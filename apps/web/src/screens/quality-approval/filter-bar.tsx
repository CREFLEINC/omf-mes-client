import { Button, Checkbox, DatePicker, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState } from 'react';

import { hasChangedFilters } from '../../patterns/filter-more';
import { EMPTY_FILTERS, type RequestFilters } from './filters';

export interface FilterBarProps {
  applied: RequestFilters;
  onApply: (filters: RequestFilters) => void;
  onReset: () => void;
}

/** 조건 줄이 고르는 값 — 승인 유형 · 상태는 탭 줄(#144 · #186)이 고르고 보인다. */
const rowValues = ({ from, to, q, myTurnOnly = false }: RequestFilters) => ({
  from,
  to,
  q,
  myTurnOnly,
});

/**
 * 조회 조건 줄. 보이는 조건이 셋(상신일 · 검색어 · 내 차례만)이라 「조건 더보기」가 없다(C-6).
 *
 * 「초기화」는 이 줄의 값이 처음 값과 다를 때만 보인다. 승인 유형 · 상태는 탭 줄에 걸린 것이 보이고
 * 그 자리에서 풀므로 견주지 않는다 — 누르면 종전대로 함께 처음으로 돌아간다.
 */
export const FilterBar = ({ applied, onApply, onReset }: FilterBarProps) => {
  const t = messages.qualityApproval;
  const fromId = useId();
  const toId = useId();
  const [draft, setDraft] = useState<RequestFilters>(applied);
  const { approvalTypeCode, from, to, q, myTurnOnly = false } = applied;
  /* 상태는 탭 줄 칩이 바꾼다 — 칩을 눌러도 치던 날짜·검색어가 지워지지 않게 되돌림에서 뺀다(#186 리뷰). */
  const apply = (next: RequestFilters): void =>
    onApply({ ...next, statusCode: applied.statusCode });

  useEffect(() => {
    setDraft((current) => ({ ...current, approvalTypeCode, from, to, q, myTurnOnly }));
  }, [approvalTypeCode, from, to, q, myTurnOnly]);

  const reset = (): void => {
    setDraft(EMPTY_FILTERS);
    onReset();
  };

  return (
    <div className="filter-bar quality-approval-filter">
      {/* 상태는 탭 줄 오른쪽 상태 칩으로 거른다(#186) — 조건 칸에는 두지 않는다. 고른 상태는 조회해도 그대로다. */}
      {/*
       * 상신일은 시작일·종료일 두 칸으로 나눠 고른다(#144) — 한 칸 범위 달력보다 어느 쪽을 정했는지가 바로 보인다.
       * 각각 따로 지울 수 있다. 보내는 값(`from`·`to`)은 그대로다.
       */}
      <div className="field-cell">
        <label className="field-label" htmlFor={fromId}>
          {t.fields.periodFrom}
        </label>
        {/* 시작일은 종료일보다 늦을 수 없다 — 범위 달력 하나일 때 저절로 지켜지던 순서다. */}
        <DatePicker
          id={fromId}
          placeholder={t.datePlaceholder}
          clearable
          max={draft.to === '' ? undefined : draft.to}
          value={draft.from === '' ? null : draft.from}
          onChange={(value) => setDraft((current) => ({ ...current, from: value ?? '' }))}
        />
      </div>
      <div className="field-cell">
        <label className="field-label" htmlFor={toId}>
          {t.fields.periodTo}
        </label>
        <DatePicker
          id={toId}
          placeholder={t.datePlaceholder}
          clearable
          min={draft.from === '' ? undefined : draft.from}
          value={draft.to === '' ? null : draft.to}
          onChange={(value) => setDraft((current) => ({ ...current, to: value ?? '' }))}
        />
      </div>
      {/* 돋보기 없는 글 칸(#144) — Enter 로 바로 조회하는 것은 종전 그대로다. */}
      <TextField
        label={t.fields.q}
        placeholder={t.qPlaceholder}
        value={draft.q}
        onChange={(event) => setDraft((current) => ({ ...current, q: event.target.value }))}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.nativeEvent.isComposing) apply(draft);
        }}
      />
      <div className="quality-approval-filter-footer">
        {/* 내 차례인 요청만 — 다른 조건처럼 [조회]로 적용한다(#193 · 검사실적 조회의 체크 칸과 같다). */}
        <Checkbox
          checked={draft.myTurnOnly === true}
          onChange={(event) =>
            setDraft((current) => ({ ...current, myTurnOnly: event.target.checked }))
          }
        >
          {t.fields.myTurnOnly}
        </Checkbox>
        <div className="filter-actions">
          <Button onClick={() => apply(draft)}>{messages.common.search}</Button>
          {hasChangedFilters(rowValues(EMPTY_FILTERS), rowValues(draft), rowValues(applied)) && (
            <Button variant="outlined" onClick={reset}>
              {messages.common.reset}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
