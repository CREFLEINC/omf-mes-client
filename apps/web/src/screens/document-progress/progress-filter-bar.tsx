import { Button, Checkbox, DatePicker, SearchInput } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState } from 'react';

import {
  FilterMoreButton,
  HiddenFilterChips,
  hasChangedFilters,
  useFilterMore,
  type HiddenFilterChip,
} from '../../patterns/filter-more';

import { FieldLabel } from './field-label';
import { DEFAULT_PROGRESS_FILTERS, type ProgressFilters } from './filters';
import { SelectField } from './select-field';
import type { SelectOption } from './types';

const t = messages.documentProgress;

export interface ProgressFilterBarProps {
  /** 주소에 반영된(= 조회에 쓰인) 조건. 편집 중인 값은 이 부품 안에만 있다. */
  appliedFilters: ProgressFilters;
  /**
   * 문서 유형 선택지. **화면이 넘긴다** — 자리표시 표를 부품이 직접 읽으면
   * 「값이 확정되면 표만 채운다」는 전환을 화면 수준에서 잴 수 없다.
   */
  documentTypeOptions: SelectOption[];
  /** 고를 수 없는 유형의 사유(외주 2문서). 없으면 넘기지 않는다. */
  disabledTypeNote?: string;
  /** 상태 선택지 — 공통코드에서 온다. 못 받았으면 비어 「전체」만 남는다. */
  statusOptions: SelectOption[];
  onSearch: (filters: ProgressFilters) => void;
  /** 접힌 조건 칩의 ×. 그 조건 하나만 풀고 곧바로 다시 조회한다. */
  onRemoveFilter: (key: HiddenFilterKey) => void;
  onReset: () => void;
}

/** 「조건 더보기」에 접힌 조건 — 칩으로 알리고 ×로 푼다. */
export type HiddenFilterKey = 'status' | 'cancellableOnly';

/**
 * 진행현황 조회 조건 줄 — **다섯 축**이다.
 *
 * 트리거 모델은 「모아서 적용」이다 — 조건을 고치는 동안 조회가 나가면 반쯤 지운 검색어로
 * 요청이 나간다. 「조회」를 누를 때만 주소가 바뀌고 그때 조회된다.
 *
 * ⭐ **문서 유형만 성질이 다르다.** 나머지 넷은 결과를 좁히는 조건이지만 유형은 **조회가
 * 성립하기 위한 전제**다(계약 필수 질의값). 그래서 유형이 비어 있으면 「조회」를 눌러도 요청이
 * 나가지 않고, 그 사실은 표 자리의 안내가 말한다 — 버튼을 잠그지 않는 이유는, 잠그면 사용자가
 * **무엇을 채워야 열리는지**를 화면에서 읽을 수 없기 때문이다.
 *
 * 품목 · 자재 LOT · 창고 번호 칸과 칸 아래 안내 두 줄은 걷었다(사용자 지시 2026-11-19).
 *
 * **보이는 칸은 셋이다**(C-6 · 관리웹 정리 시안 A, 2026-11-20) — 문서 유형 · 문서 일자 · 문서번호. 상태 · 지금 취소
 * 가능한 것만은 「조건 더보기」에 접는다. 칩은 접힌 칸에 걸린 조건에만 선다 — 보이는 칸의 값을 칩으로 겹쳐 적으면 같은
 * 사실을 두 번 말한다. 「초기화」는 바뀐 것이 있을 때만 보인다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const ProgressFilterBar = ({
  appliedFilters,
  documentTypeOptions,
  disabledTypeNote,
  statusOptions,
  onSearch,
  onRemoveFilter,
  onReset,
}: ProgressFilterBarProps) => {
  const periodId = useId();
  const more = useFilterMore();
  const [filters, setFilters] = useState<ProgressFilters>(appliedFilters);

  /*
   * 주소가 정본이다 — 뒤로가기·초기화로 주소가 **바뀌면** 편집 중인 값도 그 값으로 되돌아간다.
   *
   * **되돌림을 참조가 아니라 값으로 판정한다.** 부모는 렌더할 때마다 주소에서 값을 새로 읽으므로
   * 내용이 같아도 참조가 달라질 수 있고(조회 응답이 도착해 다시 그려질 때가 그렇다),
   * 참조로 판정하면 그때마다 사용자가 치던 값이 사라진다.
   */
  const {
    documentType: appliedDocumentType,
    status: appliedStatus,
    from: appliedFrom,
    to: appliedTo,
    cancellableOnly: appliedCancellableOnly,
    q: appliedQ,
  } = appliedFilters;

  useEffect(() => {
    setFilters({
      documentType: appliedDocumentType,
      status: appliedStatus,
      from: appliedFrom,
      to: appliedTo,
      cancellableOnly: appliedCancellableOnly,
      q: appliedQ,
    });
  }, [
    appliedDocumentType,
    appliedStatus,
    appliedFrom,
    appliedTo,
    appliedCancellableOnly,
    appliedQ,
  ]);

  const search = (): void => {
    onSearch(filters);
  };

  /**
   * 초기화. **자기 편집 상태를 함께 비운다.**
   *
   * 부모에게만 알리면 아직 조회하지 않은 값은 주소가 바뀌지 않아 되돌림 effect도 깨어나지
   * 않는다 — 그러면 **「초기화」를 눌렀는데 고른 기간이 그대로 남는다.**
   */
  const reset = (): void => {
    setFilters(DEFAULT_PROGRESS_FILTERS);
    onReset();
  };

  /* 접힌 칸의 조건만 칩으로. 상태는 이름으로 적는다(선택지에 없으면 코드 그대로). */
  const statusLabel =
    statusOptions.find((option) => option.value === appliedStatus)?.label ?? appliedStatus;
  const hiddenChips: HiddenFilterChip<HiddenFilterKey>[] = [
    ...(appliedStatus === ''
      ? []
      : [
          {
            key: 'status' as const,
            label: t.filters.chipStatus(statusLabel),
            removeLabel: t.filters.chipRemoveStatus,
          },
        ]),
    ...(appliedCancellableOnly
      ? [
          {
            key: 'cancellableOnly' as const,
            label: t.fields.cancellableOnly,
            removeLabel: t.filters.chipRemoveCancellableOnly,
          },
        ]
      : []),
  ];
  const isChanged = hasChangedFilters(DEFAULT_PROGRESS_FILTERS, filters, appliedFilters);

  return (
    <>
      <div className="filter-bar">
        {/* 유형은 「전체」로 조회할 수 없다 — 「전체」를 두지 않고 하나를 고르게 한다. */}
        <SelectField
          required
          label={t.fields.documentType}
          options={documentTypeOptions}
          value={filters.documentType}
          note={disabledTypeNote}
          placeholder={t.filters.choose}
          onChange={(value) => {
            setFilters((prev) => ({ ...prev, documentType: value }));
          }}
        />

        {/*
         * 기간은 **한 컨트롤**이다 — `mode="range"` 하나가 두 값을 준다. 컴포넌트가 완결된 쌍만
         * 방출하므로(`from <= to`도 컴포넌트가 보장한다) 화면에 순서 검증을 두지 않고,
         * 시작만 고른 중간 상태는 `value`가 반쪽으로 받아 그대로 보인다.
         */}
        <div className="field-cell">
          <FieldLabel htmlFor={periodId} label={t.fields.period} />
          <DatePicker
            id={periodId}
            mode="range"
            placeholder={messages.common.selectDate}
            value={[
              filters.from === '' ? null : filters.from,
              filters.to === '' ? null : filters.to,
            ]}
            onChange={([from, to]) => {
              setFilters((prev) => ({ ...prev, from, to }));
            }}
          />
        </div>

        <SearchInput
          label={t.fields.q}
          value={filters.q}
          onChange={(event) => {
            setFilters((prev) => ({ ...prev, q: event.target.value }));
          }}
          /* 엔터로도 조회된다 — 검색칸에서 엔터가 아무 일도 하지 않으면 멈춘 것으로 읽힌다. */
          onSearch={search}
          clearLabel={messages.common.clear}
        />

        {/* 조회와 초기화는 짝이라 함께 줄바꿈되게 묶는다. */}
        <div className="field-cell field-cell-unlabeled">
          <div className="filter-actions">
            <Button onClick={search}>{messages.common.search}</Button>
            {isChanged && (
              <Button variant="outlined" onClick={reset}>
                {messages.common.reset}
              </Button>
            )}
            <FilterMoreButton open={more.isOpen} controlsId={more.id} onToggle={more.toggle} />
          </div>
        </div>
      </div>

      {/* `hidden` 은 감싸는 상자에 둔다 — `.filter-bar` 의 display 가 속성을 덮는다. */}
      <div id={more.id} hidden={!more.isOpen}>
        <div className="filter-bar">
          <SelectField
            label={t.fields.status}
            options={[{ value: '', label: t.filters.all }, ...statusOptions]}
            value={filters.status}
            placeholder={t.filters.all}
            onChange={(value) => {
              setFilters((prev) => ({ ...prev, status: value }));
            }}
          />

          {/*
           * 「지금 취소 가능한 것만」. 라벨을 체크박스의 자식으로 두면 디자인 시스템이 접근 이름을
           * 이어 준다 — 라벨 층이 없는 컨트롤이라 `.field-cell-unlabeled`로 윗선을 맞춘다.
           */}
          <div className="field-cell field-cell-unlabeled">
            <Checkbox
              checked={filters.cancellableOnly}
              onChange={(event) => {
                setFilters((prev) => ({ ...prev, cancellableOnly: event.target.checked }));
              }}
            >
              {t.fields.cancellableOnly}
            </Checkbox>
          </div>
        </div>
      </div>

      <HiddenFilterChips open={more.isOpen} chips={hiddenChips} onRemove={onRemoveFilter} />
    </>
  );
};
