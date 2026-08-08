import { Button, Checkbox, Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState } from 'react';

import { toFilterChips, type BalanceFilters, type FilterChipNames } from './filters';
import { SelectField } from './select-field';
import type { SelectOption } from './types';

const t = messages.stockStatus;

export interface BalanceFilterBarProps {
  /** 주소에 반영된(= 조회에 쓰인) 조건. 고르는 중인 값은 이 부품 안에만 있다. */
  appliedFilters: BalanceFilters;
  /** 참조 선택지 4종. 화면이 이름으로 풀어 넘긴다 — 번호를 사용자가 고를 일이 없다. */
  warehouseOptions: SelectOption[];
  itemOptions: SelectOption[];
  lotOptions: SelectOption[];
  locationOptions: SelectOption[];
  /** 코드 선택지 3종. 값 목록이 확정되지 않아 조회 결과에서 만든다. */
  qualityStatusOptions: readonly string[];
  inventoryStatusOptions: readonly string[];
  ownershipOptions: readonly string[];
  /** 조건 칩에 실을 참조 이름. 번호를 문구로 만드는 자리를 두지 않기 위한 것이다(#44). */
  chipNames: FilterChipNames;
  /** 참조 선택지의 한계(잘림·실패·매달린 조건 미충족) 안내. 밝히지 않으면 값이 사라진 것으로 읽힌다. */
  warehouseNote?: string;
  itemNote?: string;
  lotNote?: string;
  locationNote?: string;
  /** 이 구획이 이름을 내는 참조 넷(창고·위치·품목·LOT) 중 하나라도 실패했는가. */
  referencesFailed: boolean;
  onRetryReferences: () => void;
  onSearch: (filters: BalanceFilters) => void;
  /** 조건 칩의 ×. 그 조건 하나만 풀고 곧바로 다시 조회한다. */
  onRemoveFilter: (key: keyof BalanceFilters) => void;
  onReset: () => void;
}

/**
 * 조회 조건 줄.
 *
 * 트리거 모델은 「모아서 적용, 해제는 즉시」다 — 조건을 고르는 동안 조회가 나가면
 * 반쯤 좁힌 조건으로 요청이 나간다. 「조회」를 누를 때만 주소가 바뀌고 그때 조회된다.
 * 조건 칩의 ×는 해제라 즉시 반영한다.
 *
 * **창고가 필수다** — W-01-09와 정반대다(그 화면은 조건이 하나도 없어도 조회한다).
 * 고르기 전에는 조회를 잠그고 사유를 `aria-describedby`로 잇는다. 요청은 0회다.
 *
 * **자유 입력칸을 두지 않는다.** 계약의 잔액 조회에 검색어 파라미터가 없어 칸을 만들면
 * 아무 데도 실리지 않는 입력이 된다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const BalanceFilterBar = ({
  appliedFilters,
  warehouseOptions,
  itemOptions,
  lotOptions,
  locationOptions,
  qualityStatusOptions,
  inventoryStatusOptions,
  ownershipOptions,
  chipNames,
  warehouseNote,
  itemNote,
  lotNote,
  locationNote,
  referencesFailed,
  onRetryReferences,
  onSearch,
  onRemoveFilter,
  onReset,
}: BalanceFilterBarProps) => {
  const reasonId = useId();

  const [filters, setFilters] = useState<BalanceFilters>(appliedFilters);

  /*
   * 주소가 정본이다 — 뒤로가기·초기화로 주소가 **바뀌면** 고르던 값도 그 값으로 되돌아간다.
   *
   * **되돌림을 참조가 아니라 값으로 판정한다.** 부모는 렌더할 때마다 주소에서 값을 새로 읽으므로
   * 내용이 같아도 참조가 달라질 수 있고(조회 응답이 도착해 다시 그려질 때가 그렇다),
   * 참조로 판정하면 그때마다 사용자가 고르던 값이 사라진다(#43).
   * 값이 실제로 달라졌을 때만 되돌린다 — 그래서 의존성에 **원시 필드 여덟을 풀어 둔다.**
   *
   * `includeZero`를 빠뜨리기 쉽다. 참·거짓이라 눈에 덜 띄지만 같은 규칙을 따른다.
   */
  const {
    warehouse: appliedWarehouse,
    item: appliedItem,
    lot: appliedLot,
    location: appliedLocation,
    qualityStatus: appliedQualityStatus,
    inventoryStatus: appliedInventoryStatus,
    ownership: appliedOwnership,
    includeZero: appliedIncludeZero,
  } = appliedFilters;

  useEffect(() => {
    setFilters({
      warehouse: appliedWarehouse,
      item: appliedItem,
      lot: appliedLot,
      location: appliedLocation,
      qualityStatus: appliedQualityStatus,
      inventoryStatus: appliedInventoryStatus,
      ownership: appliedOwnership,
      includeZero: appliedIncludeZero,
    });
  }, [
    appliedWarehouse,
    appliedItem,
    appliedLot,
    appliedLocation,
    appliedQualityStatus,
    appliedInventoryStatus,
    appliedOwnership,
    appliedIncludeZero,
  ]);

  /**
   * 조회를 잠그는 사유. `null`이면 조회할 수 있다.
   *
   * **막는 것은 창고 하나뿐이다.** 나머지 조건은 전부 선택이라 비어 있는 것이 잘못이 아니다.
   */
  const searchReason = filters.warehouse === '' ? t.reasons.warehouseRequired : null;

  const search = (): void => {
    if (searchReason !== null) return;

    onSearch(filters);
  };

  const chips = toFilterChips(appliedFilters, chipNames);

  /* 「전체」를 값이 빈 선택지로 둔다 — 두지 않으면 한 번 고른 뒤에 해제할 방법이 칸 안에 없어진다. */
  const withAll = (options: readonly SelectOption[]): SelectOption[] => [
    { value: '', label: t.filters.all },
    ...options,
  ];

  const codeOptions = (codes: readonly string[]): SelectOption[] =>
    withAll(codes.map((code) => ({ value: code, label: code })));

  return (
    <>
      <div className="filter-bar">
        {/*
         * 규범 3-2 — 최소 폭을 주지 않으면 선택지 목록이 트리거 폭에 갇혀 잘리고,
         * 무엇을 고르는지 읽을 수 없다. **판단 기준은 선택지 문구 길이다.**
         *
         * 참조 넷은 `codeName`(18.5rem) — 창고·위치·품목은 「코드 · 이름」이고 LOT은
         * `LOT-2026-000045` 형의 긴 식별자라 `.wide-select`의 13rem으로 모자란다
         * (브라우저 확인 F-B1: 창고 선택지가 13px 부족해 말줄임됐다).
         * 코드 셋은 `code`(13rem) — 규범 3-2가 코드값 13자에서 도출한 값 그대로다.
         *
         * 순서는 **매달림의 순서**다 — 창고 → 위치, 품목 → LOT. 고르는 차례가 곧 읽는 차례다.
         */}
        <SelectField
          optionWidth="codeName"
          label={t.fields.warehouse}
          options={withAll(warehouseOptions)}
          value={filters.warehouse}
          note={warehouseNote}
          onChange={(value) => {
            setFilters((prev) => ({ ...prev, warehouse: value }));
          }}
        />
        <SelectField
          optionWidth="codeName"
          label={t.fields.location}
          options={withAll(locationOptions)}
          value={filters.location}
          note={locationNote}
          onChange={(value) => {
            setFilters((prev) => ({ ...prev, location: value }));
          }}
        />
        <SelectField
          optionWidth="codeName"
          label={t.fields.item}
          options={withAll(itemOptions)}
          value={filters.item}
          note={itemNote}
          onChange={(value) => {
            setFilters((prev) => ({ ...prev, item: value }));
          }}
        />
        <SelectField
          optionWidth="codeName"
          label={t.fields.lot}
          options={withAll(lotOptions)}
          value={filters.lot}
          note={lotNote}
          onChange={(value) => {
            setFilters((prev) => ({ ...prev, lot: value }));
          }}
        />

        <SelectField
          optionWidth="code"
          label={t.fields.qualityStatus}
          options={codeOptions(qualityStatusOptions)}
          value={filters.qualityStatus}
          note={t.filters.codeNote}
          onChange={(value) => {
            setFilters((prev) => ({ ...prev, qualityStatus: value }));
          }}
        />
        <SelectField
          optionWidth="code"
          label={t.fields.inventoryStatus}
          options={codeOptions(inventoryStatusOptions)}
          value={filters.inventoryStatus}
          note={t.filters.codeNote}
          onChange={(value) => {
            setFilters((prev) => ({ ...prev, inventoryStatus: value }));
          }}
        />
        <SelectField
          optionWidth="code"
          label={t.fields.ownership}
          options={codeOptions(ownershipOptions)}
          value={filters.ownership}
          note={t.filters.codeNote}
          onChange={(value) => {
            setFilters((prev) => ({ ...prev, ownership: value }));
          }}
        />

        {/* 확인칸은 라벨이 오른쪽에 붙어 라벨 층이 없다 — 윗선을 맞추려 라벨 없는 셀에 담는다. */}
        <div className="field-cell field-cell-unlabeled">
          <Checkbox
            checked={filters.includeZero}
            onChange={(event) => {
              setFilters((prev) => ({ ...prev, includeZero: event.target.checked }));
            }}
          >
            {t.fields.includeZero}
          </Checkbox>
        </div>

        {/*
         * 조회와 초기화는 짝이라 함께 줄바꿈되게 묶고(배치 규범 2-1), 비활성 사유는 그 아래에 둔다.
         * 사유는 감추지 않고 항상 보이는 DOM 텍스트로 렌더해 aria-describedby로 잇는다 —
         * 비활성 컨트롤은 포커스를 받지 못해 툴팁만으로는 키보드·보조기술 사용자가 닿을 수 없다.
         */}
        <div className="field-cell field-cell-unlabeled">
          <div className="filter-actions">
            <Button
              disabled={searchReason !== null}
              aria-describedby={searchReason === null ? undefined : reasonId}
              onClick={search}
            >
              {messages.common.search}
            </Button>
            <Button variant="outlined" onClick={onReset}>
              {messages.common.reset}
            </Button>
          </div>
          {searchReason !== null && (
            <span id={reasonId} className="field-note">
              {searchReason}
            </span>
          )}
        </div>
      </div>

      {/*
       * 이 구획이 이름을 내는 참조 넷의 복구. **문구가 적은 대상과 다시 부르는 대상이 같다** —
       * 단위·소유처는 목록 구획에서만 보이므로 그 구획이 소유한다(계획 결정 9).
       */}
      {referencesFailed && (
        <div className="field-cell">
          <span className="field-note">{t.reasons.filterReferencesFailed}</span>
          <Button variant="outlined" size="sm" onClick={onRetryReferences}>
            {messages.common.retry}
          </Button>
        </div>
      )}

      {chips.length > 0 && (
        <div className="filter-bar">
          {chips.map((chip) => (
            <Chip
              key={chip.key}
              variant="status"
              removeLabel={chip.removeLabel}
              onRemove={() => {
                onRemoveFilter(chip.key);
              }}
            >
              {chip.label}
            </Chip>
          ))}
        </div>
      )}
    </>
  );
};
