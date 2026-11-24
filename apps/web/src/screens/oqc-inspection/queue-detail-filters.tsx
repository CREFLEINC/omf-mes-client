import { messages } from '@omf-mes/i18n';

import {
  FilterMoreButton,
  HiddenFilterChips,
  useFilterMore,
  type HiddenFilterChip,
} from '../../patterns/filter-more';
import { EMPTY_FILTERS, withDraft, type QueueFilters } from './filters';
import { QueueFilterBar } from './queue-filter-bar';
import { useItemNames } from './reference-lookup';

/* 칩 라벨은 대상 이름(표 머리글)이다 — 칸 라벨의 「검색」 같은 동작 낱말을 싣지 않는다. */
const t = messages.oqcInspection.queue.columns;
const more = messages.common.filterMore;

type ChipKey = 'itemId' | 'keyword';

/** 칩 한 개 — 「라벨: 값」 한 줄, × 의 접근명은 「〈라벨〉 조건 제거」. */
const chipOf = (key: ChipKey, label: string, value: string): HiddenFilterChip<ChipKey> => ({
  key,
  label: `${label}: ${value}`,
  removeLabel: more.remove(label),
});

export interface QueueDetailFiltersProps {
  /** 주소가 담은 조건 — 정본이다. */
  filters: QueueFilters;
  /** 조건을 바꿔 조회한다(첫 쪽 · 주소). */
  onApply: (next: QueueFilters) => void;
}

/**
 * 검사 조회·판정 OQC 의 「조건 더보기」(C-6) — 품목 · 의뢰번호를 접어 둔다(사용자 지시 2026-11-02 · #225). 늘 접힌 채로
 * 들어오고, 접힌 칸에 걸린 조건은 아래 칩으로 알린다. 칩의 × 는 그 조건만 풀어 바로 조회한다.
 *
 * 단추는 스캔 줄 오른쪽 끝 — 검색 묶음이 스캔 줄 · 접힌 칸 · 칩을 한 흐름으로 늘어놓고 자리는 app.css 의 `order` 가 정한다.
 */
export const QueueDetailFilters = ({ filters, onApply }: QueueDetailFiltersProps) => {
  const fold = useFilterMore();
  const items = useItemNames([filters.itemId]);

  const chips: HiddenFilterChip<ChipKey>[] = [
    /* 칩의 값은 펼친 칸이 보이는 글자와 같다(품목코드 · 품목명). */
    ...(filters.itemId === null ? [] : [chipOf('itemId', t.itemId, items.labelOf(filters.itemId))]),
    ...(filters.keyword === '' ? [] : [chipOf('keyword', t.inspectionRequestNo, filters.keyword)]),
  ];

  return (
    <>
      <div className="inspection-filter-more">
        <FilterMoreButton open={fold.isOpen} controlsId={fold.id} onToggle={fold.toggle} />
      </div>
      {/* `hidden` 은 감싸는 상자에 둔다 — `.filter-bar` 의 display 가 속성을 덮는다. */}
      <div id={fold.id} className="inspection-detail-filters" hidden={!fold.isOpen}>
        <QueueFilterBar
          appliedFilters={filters}
          showPendingOnly={false}
          /* 상태는 탭 줄 칩이 맡는다 — 조회는 걸린 칩을 그대로 두고, 초기화는 함께 푼다. */
          onSearch={(next) =>
            onApply(
              withDraft(filters, { ...next, overallJudgmentCode: filters.overallJudgmentCode }),
            )
          }
          onTogglePendingOnly={(next) =>
            onApply(withDraft(filters, { ...filters, pendingOnly: next }))
          }
          onReset={() => onApply(EMPTY_FILTERS)}
        />
      </div>
      <HiddenFilterChips
        open={fold.isOpen}
        chips={chips}
        onRemove={(key) =>
          onApply(key === 'itemId' ? { ...filters, itemId: null } : { ...filters, keyword: '' })
        }
      />
    </>
  );
};
