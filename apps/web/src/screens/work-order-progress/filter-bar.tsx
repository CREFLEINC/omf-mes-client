import { Button, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { type FormEvent, useEffect, useId, useState } from 'react';

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
import type { StatusOptions } from './status-options';

const t = messages.workOrderProgress.filters;

export interface ProgressFilterBarProps {
  /** 지금 조회에 걸려 있는 조건. 주소에서 읽은 값이다. */
  appliedFilters: ProgressFilters;
  /** 「초기화」가 되돌리는 처음 값(최근 한 달, 나머지 비움). 이와 다를 때만 「초기화」가 보인다. */
  initialFilters: ProgressFilters;
  lineLookup: NameLookup;
  productionOrderLookup: NameLookup;
  statusOptions: StatusOptions;
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
 * ⛔ **공정 칸을 만들지 않는다.** 계약에 공정으로 거를 파라미터가 없다. 자리만 만들어 두고
 * 늘 비활성이면 「고장 났나」로 읽힌다 — 대신 **한 문장으로 적는다**(A-11).
 *
 * **보이는 조건은 셋이다**(C-6) — 기간 · 라인 · W/O 번호. 상태와 P/O 는 「조건 더보기」에 접고,
 * 접힌 칸에 걸린 조건은 칩으로만 알린다. 「초기화」는 처음 값과 다를 때만 보인다.
 */
export const ProgressFilterBar = ({
  appliedFilters,
  initialFilters,
  lineLookup,
  productionOrderLookup,
  statusOptions,
  onSearch,
  onReset,
}: ProgressFilterBarProps) => {
  const [draft, setDraft] = useState(appliedFilters);
  const periodNoteId = useId();
  const more = useFilterMore();

  const { from, to, productionLineId, statusCode, productionOrderId, keyword } = appliedFilters;

  useEffect(() => {
    setDraft({ from, to, productionLineId, statusCode, productionOrderId, keyword });
  }, [from, to, productionLineId, statusCode, productionOrderId, keyword]);

  /* 오프셋은 「막을지」와 「경고할지」에 영향을 주지 않는다 — 경계 문자열을 만들 때만 쓴다. */
  const period = resolvePeriod(draft, 0);
  const blockedReason = period.kind === 'blocked' ? period.reason : null;
  const wideWarning = period.kind === 'ready' ? period.warning : null;

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (blockedReason === null) onSearch({ ...draft });
  };

  const isChanged = hasChangedFilters(initialFilters, draft, appliedFilters);
  /* 접힌 칸(상태 · P/O)의 조건만 칩으로 — 보이는 칸의 값을 칩으로 겹쳐 적지 않는다. */
  const hiddenChips = [
    ...(statusCode === ''
      ? []
      : [{ key: 'statusCode' as const, label: t.chipStatus(statusOptions.labelOf(statusCode)) }]),
    ...(productionOrderId === ''
      ? []
      : [
          {
            key: 'productionOrderId' as const,
            label: t.chipProductionOrder(productionOrderLookup.labelOf(productionOrderId)),
          },
        ]),
  ];

  return (
    <form aria-label={t.legend} className="filter-bar work-order-progress-filter" onSubmit={submit}>
      <div className="field-cell">
        <TextField
          aria-describedby={blockedReason === null ? undefined : periodNoteId}
          aria-required
          label={t.from}
          type="date"
          value={draft.from}
          onChange={(event) => {
            setDraft((current) => ({ ...current, from: event.target.value }));
          }}
        />
      </div>

      <div className="field-cell">
        <TextField
          aria-describedby={blockedReason === null ? undefined : periodNoteId}
          aria-required
          label={t.to}
          type="date"
          value={draft.to}
          onChange={(event) => {
            setDraft((current) => ({ ...current, to: event.target.value }));
          }}
        />
      </div>

      <FilterSelect
        label={t.productionLine}
        note={truncationNote(lineLookup)}
        options={lineLookup.options}
        unavailableReason={lookupReason(lineLookup)}
        value={draft.productionLineId}
        onChange={(productionLineId) => {
          setDraft((current) => ({ ...current, productionLineId }));
        }}
      />

      <div className="field-cell">
        <TextField
          label={t.keyword}
          placeholder={t.keywordPlaceholder}
          value={draft.keyword}
          onChange={(event) => {
            setDraft((current) => ({ ...current, keyword: event.target.value }));
          }}
        />
      </div>

      {/* `hidden` 은 감싸는 상자에 둔다 — `.filter-bar` 의 display 가 속성을 덮는다. */}
      <div id={more.id} className="work-order-progress-filter-more" hidden={!more.isOpen}>
        <div className="filter-bar work-order-progress-filter">
          <FilterSelect
            label={t.status}
            note={null}
            options={statusOptions.options}
            unavailableReason={statusOptions.isUnavailable ? t.statusUnavailable : null}
            value={draft.statusCode}
            onChange={(statusCode) => {
              setDraft((current) => ({ ...current, statusCode }));
            }}
          />

          <FilterSelect
            label={t.productionOrder}
            note={truncationNote(productionOrderLookup)}
            options={productionOrderLookup.options}
            unavailableReason={lookupReason(productionOrderLookup)}
            value={draft.productionOrderId}
            onChange={(productionOrderId) => {
              setDraft((current) => ({ ...current, productionOrderId }));
            }}
          />
        </div>
      </div>

      <HiddenFilterChips
        open={more.isOpen}
        chips={hiddenChips}
        onRemove={(key) => {
          onSearch({ ...appliedFilters, [key]: '' });
        }}
      />

      <div className="work-order-progress-filter-footer">
        {/* A-11 — 만들지 않은 조건을 한 문장으로 밝힌다. */}

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

        {blockedReason === null ? null : (
          <p className="field-error" id={periodNoteId}>
            {blockedReason}
          </p>
        )}

        {/* ⛔ 넓은 기간을 막지 않는다 — 느려질 수 있다는 사실만 미리 알린다. */}
        {wideWarning === null ? null : <p className="field-note">{wideWarning}</p>}
      </div>
    </form>
  );
};
