import {
  Button,
  Checkbox,
  Chip,
  type Column,
  EmptyState,
  SearchInput,
  SkeletonText,
  Table,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useEffect, useState } from 'react';

import { defaultCalendarFilters } from './filters';
import type { CalendarFilters, WorkCalendar } from './types';

export interface CalendarListPaneProps {
  items: WorkCalendar[];
  isLoading: boolean;
  appliedFilters: CalendarFilters;
  onApplyFilters: (next: CalendarFilters) => void;
  onAdd: () => void;
  /**
   * 캘린더를 고른다. **여는 것이 아니라 고르는 것이다** — 이 화면의 본론은 고른 캘린더의
   * 일자 설정이고, 이름·코드 수정은 그 옆에 붙는 일이다.
   */
  onSelect: (calendar: WorkCalendar) => void;
  /** 지금 고른 캘린더. 없으면 `null` */
  selectedId: number | null;
  loadError: ReactNode;
}

const t = messages.workCalendar;

/**
 * 「조회」를 눌러야 나가는 조건. **체크칸은 여기 없다** — 바꾸는 즉시 나간다.
 *
 * ⛔ **한 벌을 나눠 갖지 않는다.** 초안이 즉시 적용되는 조건까지 품으면, 체크칸을 켠 뒤
 * 「조회」를 누를 때 초안에 남아 있던 옛 값이 방금 켠 것을 조용히 되돌린다(client#314).
 */
interface DraftFilters {
  q: string;
}

const draftOf = (filters: CalendarFilters): DraftFilters => ({ q: filters.q });

const hasAnyFilter = (filters: CalendarFilters): boolean =>
  filters.q !== '' || filters.includeInactive;

export const CalendarListPane = ({
  items,
  isLoading,
  appliedFilters,
  onApplyFilters,
  onAdd,
  onSelect,
  selectedId,
  loadError,
}: CalendarListPaneProps) => {
  // 트리거 모델: 편집은 모아서 적용, 해제는 즉시.
  const [draft, setDraft] = useState<DraftFilters>(draftOf(appliedFilters));
  const { q: appliedQ } = appliedFilters;

  /* 밖에서 조건이 되돌려지면(초기화·칩 제거) 초안도 그것을 따라간다. */
  useEffect(() => {
    setDraft({ q: appliedQ });
  }, [appliedQ]);

  /** 초안을 지금 적용된 조건 «위에» 얹는다 — 즉시 적용된 체크칸을 건드리지 않는다. */
  const applyDraft = (overrides: Partial<DraftFilters> = {}): void => {
    onApplyFilters({ ...appliedFilters, ...draft, ...overrides });
  };

  /*
   * ⛔ **초안을 손으로 거둔다 — 위 효과에 맡기지 않는다.**
   * 효과는 «적용된 값이 달라졌을 때»만 돈다. 적용된 검색어가 이미 비어 있는데 칸에만 낱말이
   * 남아 있으면 달라지는 값이 없어 효과가 돌지 않고, 그 상태로 「조회」를 누르면 초기화한
   * 줄 알았던 조건이 되살아난다.
   */
  const resetAll = (): void => {
    setDraft(draftOf(defaultCalendarFilters));
    onApplyFilters(defaultCalendarFilters);
  };

  const columns: Column<WorkCalendar>[] = [
    {
      key: 'calendarCode',
      header: t.fields.calendarCode,
      /*
       * 코드는 식별자라 접히면 읽기 어렵다 — 240px 은 27자 ASCII(203px)에 셀 여백을 더한 값이다.
       * 열이 셋뿐이라 이 폭을 줘도 이름 칸이 좁아지지 않는다(브라우저 실측).
       */
      width: '240px',
      /*
       * 코드가 곧 고르는 손잡이다 — 줄마다 단추를 세우면 표가 조작으로 덮인다.
       * ⭐ **지금 고른 줄을 `aria-current` 로 밝힌다** — 색만으로 표시하면 색을 보지 못하는
       * 사용자가 어느 캘린더의 일자를 보고 있는지 알 수 없다.
       */
      render: (row) => (
        <button
          type="button"
          className="link-cell"
          aria-current={row.workCalendarId === selectedId ? 'true' : undefined}
          onClick={() => onSelect(row)}
        >
          {row.calendarCode}
        </button>
      ),
    },
    { key: 'calendarName', header: t.fields.calendarName },
    {
      key: 'isActive',
      header: t.fields.isActive,
      width: '96px',
      render: (row) => (row.isActive ? t.values.active : t.values.inactive),
    },
  ];

  const emptySlot = hasAnyFilter(appliedFilters) ? (
    <EmptyState
      size="sm"
      live
      title={t.empty.noMatchTitle}
      description={t.empty.noMatchDescription}
      action={
        <Button variant="outlined" onClick={resetAll}>
          {messages.common.reset}
        </Button>
      }
    />
  ) : (
    <EmptyState size="sm" live title={t.empty.noneTitle} description={t.empty.noneDescription} />
  );

  const listSlot = (): ReactNode => {
    if (loadError !== null && loadError !== undefined) return loadError;

    if (isLoading) {
      return (
        <div role="status" aria-label={t.loading.calendars}>
          <SkeletonText lines={3} />
        </div>
      );
    }

    return (
      <Table
        density="compact"
        columns={columns}
        rows={items}
        getRowId={(row) => String(row.workCalendarId)}
        empty={emptySlot}
      />
    );
  };

  return (
    <section className="pane" aria-label={t.title}>
      <div className="filter-bar">
        <SearchInput
          label={t.filters.searchLabel}
          placeholder={t.filters.searchPlaceholder}
          value={draft.q}
          onChange={(event) => setDraft({ q: event.target.value })}
          onSearch={(value) => applyDraft({ q: value })}
        />
        {/* 해제 축이라 변경 즉시 적용한다. */}
        <div className="field-cell field-cell-unlabeled">
          <Checkbox
            checked={appliedFilters.includeInactive}
            onChange={(event) =>
              onApplyFilters({ ...appliedFilters, includeInactive: event.target.checked })
            }
          >
            {messages.common.includeInactive}
          </Checkbox>
        </div>
        {/* 규범 2-1 — 뜻이 짝인 액션이 줄바꿈으로 갈라지지 않게 한 덩어리로 묶는다. */}
        <div className="field-cell field-cell-unlabeled">
          <div className="filter-actions">
            <Button onClick={() => applyDraft()}>{messages.common.search}</Button>
            <Button variant="outlined" onClick={resetAll}>
              {messages.common.reset}
            </Button>
            <Button variant="outlined" onClick={onAdd}>
              {t.actions.addCalendar}
            </Button>
          </div>
        </div>
      </div>

      <div className="filter-bar">
        {appliedFilters.q !== '' && (
          <Chip
            variant="status"
            removeLabel={t.filters.chipRemoveKeyword}
            onRemove={() => onApplyFilters({ ...appliedFilters, q: '' })}
          >
            {t.filters.chipKeyword(appliedFilters.q)}
          </Chip>
        )}
        {appliedFilters.includeInactive && (
          <Chip
            variant="status"
            removeLabel={t.filters.chipRemoveIncludeInactive}
            onRemove={() => onApplyFilters({ ...appliedFilters, includeInactive: false })}
          >
            {messages.common.includeInactive}
          </Chip>
        )}
      </div>

      {listSlot()}
    </section>
  );
};
