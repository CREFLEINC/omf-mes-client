import { Button, SearchInput } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { type FormEvent, useEffect, useId, useState } from 'react';

import { DateRangeFields } from '../../patterns/date-range-fields';
import {
  FilterMoreButton,
  HiddenFilterChips,
  hasChangedFilters,
  useFilterMore,
} from '../../patterns/filter-more';
import { FilterSelect } from './filter-select';
import type { ProgressFilters } from './filters';
import { LOOKUP_SIZE, type NameLookup } from './lookups';
import { resolvePeriod } from './period';

const t = messages.workOrderProgress.filters;

export interface ProgressFilterBarProps {
  /** 지금 조회에 걸려 있는 조건. 주소에서 읽은 값이다. */
  appliedFilters: ProgressFilters;
  /** 「초기화」가 되돌리는 처음 값(오늘 앞뒤 14일, 나머지 비움). 이와 다를 때만 「초기화」가 보인다. */
  initialFilters: ProgressFilters;
  lineLookup: NameLookup;
  processLookup: NameLookup;
  onSearch: (filters: ProgressFilters) => void;
  onReset: () => void;
}

/**
 * 선택지를 못 받았을 때의 사유. **못 받았을 때만** 끈다.
 *
 * ⛔ **받는 중에는 끄지 않는다.** 끄면 사유로 적을 것이 없는데(잠깐 뒤면 채워진다) G-2 는
 * 「비활성에는 사유를 함께」를 요구한다 — 사유 없는 비활성이 그래서 생긴다. 받는 중에는
 * 「전체」만 있는 채로 열어 두고, 값이 오면 늘어난다.
 */
const lookupReason = (lookup: NameLookup): string | null =>
  lookup.isError ? t.lookupFailed : null;

/** ⛔ 「여기 없으면 없는 것」으로 읽히지 않게 한다 — 앞의 몇 건만 받아 둔 목록이다. */
const truncationNote = (lookup: NameLookup): string | null =>
  lookup.isTruncated ? t.optionsTruncated(LOOKUP_SIZE) : null;

/**
 * 조회 조건 바.
 *
 * ⭐ **초안과 걸린 조건을 나눈다.** 사용자가 고르는 즉시 조회가 나가면, 세 칸을 채우는 동안
 * 세 번 조회된다 — 「조회」를 눌러야 걸린다. 주소가 바뀌면(뒤로 가기·딥링크) 초안을 그 값으로
 * 되돌린다. 그렇게 하지 않으면 뒤로 갔는데 입력칸만 옛 값으로 남는다.
 *
 * ⛔ **기간을 비운 채로는 조회할 수 없다**(L-3). 무제한 조회를 허용하면 실적이 쌓인 뒤
 * 목록이 멎는다. 다만 **넓은 기간은 막지 않고 경고만 한다** — 넓게 봐야 하는 일이 실제로 있다.
 *
 * **보이는 조건은 셋이다**(C-6) — 기간 · 라인 · W/O 번호. 공정은 「조건 더보기」에 접고,
 * 접힌 칸에 걸린 조건은 칩으로만 알린다. 「초기화」는 처음 값과 다를 때만 보인다.
 * 조건 칸과 [조회] [초기화] [조건 더보기]는 한 줄에 놓인다 — 단추는 줄 오른쪽 끝이다.
 * 펼친 칸도 줄을 바꾸지 않고 W/O 번호 바로 뒤에 이어진다.
 *
 * 라인은 선택지 수와 관계없이 검색창이 있는 선택 칸이고, W/O 번호는 돋보기가 있는 검색 칸이다.
 * 칸 바탕은 조회 묶음 공용 바탕(`filter-field-surface`)이다 — 카드의 회색이 칸에 비치지 않는다.
 *
 * ⛔ **P/O 칸을 두지 않는다**(사용자 지시 2026-11-28). P/O 번호는 상세 창에서 본다.
 *
 * ⛔ **상태 칸을 두지 않는다.** 상태는 표 위 조건 칩이 맡는다(C-17 — 조회 조건 영역에 같은 칸을 두지 않는다).
 * 이 줄의 [조회]는 걸려 있는 상태를 그대로 싣고, [초기화]는 상태까지 푼다.
 */
export const ProgressFilterBar = ({
  appliedFilters,
  initialFilters,
  lineLookup,
  processLookup,
  onSearch,
  onReset,
}: ProgressFilterBarProps) => {
  const [draft, setDraft] = useState(appliedFilters);
  const periodNoteId = useId();
  const more = useFilterMore();

  const { from, to, productionLineId, statusCode, processId, keyword } = appliedFilters;

  useEffect(() => {
    setDraft({ from, to, productionLineId, statusCode, processId, keyword });
  }, [from, to, productionLineId, statusCode, processId, keyword]);

  /* 오프셋은 「막을지」와 「경고할지」에 영향을 주지 않는다 — 경계 문자열을 만들 때만 쓴다. */
  const period = resolvePeriod(draft, 0);
  const blockedReason = period.kind === 'blocked' ? period.reason : null;
  const wideWarning = period.kind === 'ready' ? period.warning : null;

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (blockedReason === null) onSearch({ ...draft });
  };

  const isChanged = hasChangedFilters(initialFilters, draft, appliedFilters);
  /* 접힌 칸(공정)의 조건만 칩으로 — 보이는 칸의 값을 칩으로 겹쳐 적지 않는다. */
  const hiddenChips =
    processId === ''
      ? []
      : [{ key: 'processId' as const, label: t.chipProcess(processLookup.labelOf(processId)) }];

  return (
    <form
      aria-label={t.legend}
      className="filter-bar filter-field-surface work-order-progress-filter"
      onSubmit={submit}
    >
      {/* 기간은 관리웹 공용 두 칸(시작일 · 종료일) — 달력에서 시작 ≤ 종료를 막는다. 비울 수 없어 지우기 단추는 없다(L-3). */}
      <DateRangeFields
        required
        className="filter-field-sm"
        describedBy={blockedReason === null ? undefined : periodNoteId}
        endLabel={t.to}
        from={draft.from}
        invalid={blockedReason !== null}
        startLabel={t.from}
        to={draft.to}
        onChange={(nextFrom, nextTo) => {
          setDraft((current) => ({ ...current, from: nextFrom, to: nextTo }));
        }}
      />

      {/* 라인은 선택지가 몇 개든 검색창을 둔다(사용자 지시 2026-11-28) — 공장마다 라인 수가 달라도 쓰는 법이 같다. */}
      <FilterSelect
        searchable
        className="filter-field-md"
        label={t.productionLine}
        note={truncationNote(lineLookup)}
        options={lineLookup.options}
        unavailableReason={lookupReason(lineLookup)}
        value={draft.productionLineId}
        onChange={(productionLineId) => {
          setDraft((current) => ({ ...current, productionLineId }));
        }}
      />

      {/* 돋보기가 있는 검색 칸. Enter 는 폼의 [조회]와 같은 길로 나간다 — 칸이 따로 조회를 내지 않는다. */}
      <SearchInput
        clearLabel={messages.common.clear}
        containerClassName="filter-field-md work-order-progress-search"
        label={t.keyword}
        placeholder={t.keywordPlaceholder}
        value={draft.keyword}
        onChange={(event) => {
          setDraft((current) => ({ ...current, keyword: event.target.value }));
        }}
        onClear={() => {
          setDraft((current) => ({ ...current, keyword: '' }));
        }}
      />

      {/*
       * 「조건 더보기」로 펼친 칸은 줄을 바꾸지 않고 W/O 번호 바로 뒤에 잇는다(사용자 지시 2026-11-28).
       * `hidden` 은 감싸는 상자에 둔다 — `.filter-bar` 의 display 가 속성을 덮는다.
       */}
      <div id={more.id} className="work-order-progress-filter-more" hidden={!more.isOpen}>
        <div className="filter-bar work-order-progress-filter-more-row">
          <FilterSelect
            className="filter-field-md"
            label={t.process}
            note={truncationNote(processLookup)}
            options={processLookup.options}
            unavailableReason={lookupReason(processLookup)}
            value={draft.processId}
            onChange={(nextProcessId) => {
              setDraft((current) => ({ ...current, processId: nextProcessId }));
            }}
          />
        </div>
      </div>

      <div className="filter-actions work-order-progress-filter-buttons">
        <Button
          aria-describedby={blockedReason === null ? undefined : periodNoteId}
          disabled={blockedReason !== null}
          type="submit"
        >
          {t.search}
        </Button>
        {isChanged && (
          <Button type="button" variant="outlined" onClick={onReset}>
            {t.reset}
          </Button>
        )}
        <FilterMoreButton open={more.isOpen} controlsId={more.id} onToggle={more.toggle} />
      </div>

      <HiddenFilterChips
        open={more.isOpen}
        chips={hiddenChips}
        onRemove={(key) => {
          onSearch({ ...appliedFilters, [key]: '' });
        }}
      />

      {/* 막힌 사유와 넓은 기간 경고는 있을 때만 줄 아래 한 줄로 — 없으면 자리를 차지하지 않는다. */}
      {blockedReason === null ? null : (
        <p className="field-error work-order-progress-filter-note" id={periodNoteId}>
          {blockedReason}
        </p>
      )}

      {/* ⛔ 넓은 기간을 막지 않는다 — 느려질 수 있다는 사실만 미리 알린다. */}
      {wideWarning === null ? null : (
        <p className="field-note work-order-progress-filter-note">{wideWarning}</p>
      )}
    </form>
  );
};
