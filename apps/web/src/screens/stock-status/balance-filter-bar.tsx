import { Button, Checkbox, Icon, SearchInput } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState } from 'react';

import {
  FilterMoreButton,
  HiddenFilterChips,
  hasChangedFilters,
  useFilterMore,
} from '../../patterns/filter-more';

import {
  EMPTY_FILTERS,
  hasScopeCondition,
  toFilterChips,
  type BalanceFilters,
  type FilterChipNames,
} from './filters';
import type { StockCodeNames } from './code-names';
import { ItemSelectField, SelectField } from './select-field';
import type { SelectOption } from './types';

const t = messages.stockStatus;

/** 조건 줄에 보이는 칸(C-6) — 값이 칸에 보이므로 칩으로 겹쳐 적지 않는다. */
const VISIBLE_KEYS: readonly (keyof BalanceFilters)[] = ['warehouse', 'item'];
/** 칸이 없는 조건 — 행에서 고른 입하 LOT. 펼쳐도 값이 보일 칸이 없어 칩이 늘 남는다. */
const FIELDLESS_KEYS: readonly (keyof BalanceFilters)[] = ['inboundLot'];

export interface BalanceFilterBarProps {
  /** 주소에 반영된(= 조회에 쓰인) 조건. 고르는 중인 값은 이 부품 안에만 있다. */
  appliedFilters: BalanceFilters;
  /** 참조 선택지 3종. 화면이 이름으로 풀어 넘긴다 — 번호를 사용자가 고를 일이 없다. 품목은 칸이 서버에서 쪽으로 받는다. */
  warehouseOptions: SelectOption[];
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
  lotNote?: string;
  locationNote?: string;
  /** 이 구획이 이름을 내는 참조 넷(창고·위치·품목·LOT) 중 하나라도 실패했는가. */
  referencesFailed: boolean;
  onRetryReferences: () => void;
  /**
   * 고르는 중인 창고가 바뀌었다(omf-all-around#270). 화면이 그 창고로 위치 선택지를 채운다 —
   * [조회] 전에도 위치를 고를 수 있어야 안내 문구와 맞는다.
   */
  onWarehouseChange?: (warehouse: string) => void;
  onSearch: (filters: BalanceFilters) => void;
  /** 조건 칩의 ×. 그 조건 하나만 풀고 곧바로 다시 조회한다. */
  onRemoveFilter: (key: keyof BalanceFilters) => void;
  onReset: () => void;
  /** 품질 상태 · 재고 상태 · 소유 구분 선택지 이름(서버 코드 목록 · omf-all-around#360). 없으면 코드 그대로. */
  codeNames?: StockCodeNames;
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
 * **보이는 칸은 둘이다**(C-6 · 관리웹 정리 시안 A, 2026-11-20) — 창고(필수) · 품목, 칸 폭은 C-19 보통. 입하 LOT 번호까지
 * 셋을 보통 폭으로 두면 조회 · 초기화 · 조건 더보기와 함께 1280 에서 한 줄에 들지 않는다(240×3 + 단추 셋 > 조건 줄 942px).
 * 입하 LOT 번호(창고 없이 조회하는 길) · 위치 · LOT(창고 · 품목에 매달린다) · 품질 상태 · 재고 상태 · 소유 구분 ·
 * 잔액 0 포함은 「조건 더보기」에 접는다. 접힌 칸에 걸린 조건과 행에서 고른 입하 LOT 은 칩으로만 알린다.
 * 「초기화」는 바뀐 것이 있을 때만 보인다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const BalanceFilterBar = ({
  appliedFilters,
  warehouseOptions,
  lotOptions,
  locationOptions,
  qualityStatusOptions,
  inventoryStatusOptions,
  ownershipOptions,
  chipNames,
  warehouseNote,
  lotNote,
  locationNote,
  referencesFailed,
  onRetryReferences,
  onWarehouseChange,
  onSearch,
  onRemoveFilter,
  onReset,
  codeNames,
}: BalanceFilterBarProps) => {
  const reasonId = useId();
  const more = useFilterMore();

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
    inboundLotNo: appliedInboundLotNo,
    inboundLot: appliedInboundLot,
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
      inboundLotNo: appliedInboundLotNo,
      inboundLot: appliedInboundLot,
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
    appliedInboundLotNo,
    appliedInboundLot,
  ]);

  /**
   * 조회를 잠그는 사유. `null`이면 조회할 수 있다.
   *
   * **막는 것은 창고 하나뿐이다.** 나머지 조건은 전부 선택이라 비어 있는 것이 잘못이 아니다.
   * 005 FR-035 — 입하 LOT 조건(번호 칸 · 행에서 고른 입하 LOT)이 있으면 창고 없이 조회된다(범위 안내 없음).
   */
  const searchReason = hasScopeCondition(filters) ? null : t.reasons.warehouseRequired;

  const search = (): void => {
    if (searchReason !== null) return;

    onSearch(filters);
  };

  /*
   * 입하 LOT 칸의 Enter 는 칸이 넘겨 준 값으로 조회한다(G2 L21). 붙여 넣기 · 스캐너처럼 글자와 Enter 가 한꺼번에
   * 오면 상태가 아직 따라오지 않아 빈 칸으로 읽혀 조회가 잠긴 채 아무 일도 없었다.
   */
  const searchInboundLotNo = (value: string): void => {
    const next = { ...filters, inboundLotNo: value };

    setFilters(next);
    if (!hasScopeCondition(next)) return;

    onSearch(next);
  };

  /**
   * 초기화. **자기 편집 상태를 함께 비운다** — 부모에게만 알리면 아직 조회하지 않은 값은 주소가 바뀌지 않아 되돌림
   * effect 도 깨어나지 않고, 「초기화」를 눌렀는데 고르던 값이 그대로 남는다.
   */
  const reset = (): void => {
    setFilters(EMPTY_FILTERS);
    onWarehouseChange?.('');
    onReset();
  };

  /*
   * 접힌 칸의 조건만 칩으로 — 보이는 칸(창고 · 품목 · 입하 LOT 번호)의 값을 칩으로 겹쳐 적지 않는다. 펼치면 접혀 있던 칸에
   * 값이 보이므로 그 칩은 거두고, 칸이 없는 입하 LOT 거르기만 남긴다.
   */
  const hiddenChips = toFilterChips(appliedFilters, chipNames).filter(
    (chip) =>
      !VISIBLE_KEYS.includes(chip.key) && (!more.isOpen || FIELDLESS_KEYS.includes(chip.key)),
  );
  const isChanged = hasChangedFilters(EMPTY_FILTERS, filters, appliedFilters);

  /* 「전체」를 값이 빈 선택지로 둔다 — 두지 않으면 한 번 고른 뒤에 해제할 방법이 칸 안에 없어진다. */
  const withAll = (options: readonly SelectOption[]): SelectOption[] => [
    { value: '', label: t.filters.all },
    ...options,
  ];

  /* 고르는 글자는 서버 코드 목록의 이름(omf-all-around#360) — 보내는 값은 코드 그대로. */
  const codeOptions = (
    codes: readonly string[],
    nameOf?: (code: string) => string,
  ): SelectOption[] =>
    withAll(codes.map((code) => ({ value: code, label: nameOf?.(code) ?? code })));

  return (
    <>
      <div className="filter-bar">
        {/*
         * 조회 줄의 창고 · 품목은 C-19 보통(240px) 정한 폭이다 — 고른 값이 길어도 칸 폭이 그대로다(말줄임).
         *
         * 「조건 더보기」 안은 규범 3-2 의 최소 폭을 그대로 쓴다 — 위치 · LOT 은 `codeName`(18.5rem): 위치는 「코드 · 이름」이고
         * LOT 은 `LOT-2026-000045` 형의 긴 식별자라 `.wide-select`의 13rem으로 모자란다(브라우저 확인 F-B1).
         * 코드 셋은 `code`(13rem) — 규범 3-2가 코드값 13자에서 도출한 값 그대로다.
         *
         * 매달림의 순서는 창고 → 위치, 품목 → LOT 이다. 위치 · LOT 은 「조건 더보기」에 같은 차례로 놓인다.
         */}
        <SelectField
          fixedWidth
          required
          label={t.fields.warehouse}
          options={withAll(warehouseOptions)}
          value={filters.warehouse}
          note={warehouseNote}
          onChange={(value) => {
            /* 창고를 바꾸면 고른 위치를 비운다 — 다른 창고의 위치가 조건에 남지 않게. */
            setFilters((prev) => ({
              ...prev,
              warehouse: value,
              location: prev.warehouse === value ? prev.location : '',
            }));
            onWarehouseChange?.(value);
          }}
        />
        {/*
         * 조회를 잠근 사유는 창고 칸 바로 오른쪽 안내 칩(정보 아이콘 + 파란 바탕)으로 둔다(#360). 감추지 않고 늘 보이는
         * DOM 텍스트로 그려 조회 단추의 aria-describedby 로 잇는다 — 비활성 단추는 포커스를 받지 못해 툴팁만으론 닿을 수 없다.
         */}
        {searchReason !== null && (
          <div className="field-cell field-cell-unlabeled">
            <p id={reasonId} className="iqc-inspection-action-note" data-tone="info">
              <Icon name="info" size={14} aria-hidden />
              {searchReason}
            </p>
          </div>
        )}
        <ItemSelectField
          fixedWidth
          label={t.fields.item}
          leadingOptions={withAll([])}
          value={filters.item}
          onChange={(value) => {
            setFilters((prev) => ({ ...prev, item: value }));
          }}
        />

        {/* 조회와 초기화는 짝이라 함께 줄바꿈되게 묶고(배치 규범 2-1), 조건 줄 오른쪽 끝에 세운다(#360). */}
        <div className="field-cell field-cell-unlabeled filter-actions-end">
          <div className="filter-actions">
            <Button
              disabled={searchReason !== null}
              aria-describedby={searchReason === null ? undefined : reasonId}
              onClick={search}
            >
              {messages.common.search}
            </Button>
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
          {/* 005 FR-035 — 입하 LOT 번호(정확 일치). Enter 로 조회한다. */}
          <div className="field-cell">
            <SearchInput
              label={t.fields.inboundLotNo}
              placeholder={t.fields.inboundLotNoPlaceholder}
              value={filters.inboundLotNo}
              clearLabel={messages.common.clear}
              onChange={(event) => {
                const inboundLotNo = event.target.value;
                setFilters((prev) => ({ ...prev, inboundLotNo }));
              }}
              onSearch={searchInboundLotNo}
              onClear={() => {
                setFilters((prev) => ({ ...prev, inboundLotNo: '' }));
              }}
            />
          </div>

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
            options={codeOptions(qualityStatusOptions, codeNames?.quality)}
            value={filters.qualityStatus}
            onChange={(value) => {
              setFilters((prev) => ({ ...prev, qualityStatus: value }));
            }}
          />
          <SelectField
            optionWidth="code"
            label={t.fields.inventoryStatus}
            options={codeOptions(inventoryStatusOptions, codeNames?.inventory)}
            value={filters.inventoryStatus}
            onChange={(value) => {
              setFilters((prev) => ({ ...prev, inventoryStatus: value }));
            }}
          />
          <SelectField
            optionWidth="code"
            label={t.fields.ownership}
            options={codeOptions(ownershipOptions, codeNames?.ownership)}
            value={filters.ownership}
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
        </div>
      </div>

      <HiddenFilterChips open={false} chips={hiddenChips} onRemove={onRemoveFilter} />

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
    </>
  );
};
