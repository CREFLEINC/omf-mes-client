import { Button, Checkbox, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useState } from 'react';

import { hasChangedFilters } from '../../patterns/filter-more';

import { DEFAULT_FILTERS, type CountFilters } from './filters';
import { SelectField } from './select-field';
import type { SelectOption } from './types';

const t = messages.stocktaking;

export interface CountFilterBarProps {
  /** 주소에 반영된(= 조회에 쓰인) 조건. 편집 중인 값은 이 부품 안에만 있다. */
  appliedFilters: CountFilters;
  /** 창고 선택지. 화면이 이름으로 풀어 넘긴다 — 번호를 사용자가 칠 일이 없다. */
  warehouseOptions: SelectOption[];
  /** 참조 선택지의 한계(잘림·실패) 안내. 밝히지 않으면 값이 사라진 것으로 읽힌다. */
  warehouseNote?: string;
  /**
   * 전송 중인가. **조회·초기화만 잠근다** — 조건 칸 자체는 열어 둔다(잠그면 지금 걸린 조건을
   * 해제할 방법이 사라지고, 칸을 고쳐도 조회가 나가지 않아 잃는 것이 없다).
   */
  isLocked: boolean;
  onSearch: (filters: CountFilters) => void;
  onReset: () => void;
}

/**
 * 실사 조회 조건 줄.
 *
 * 트리거 모델은 「모아서 적용」이다 — 조건을 고치는 동안 조회가 나가면
 * 반쯤 고른 조건으로 요청이 나간다. 「조회」를 누를 때만 주소가 바뀌고 그때 조회된다.
 *
 * **조건은 셋이고 모두 이 줄에 보인다**(C-6) — 창고 · 계획일 · 진행 중만. 접을 조건이 없어 「조건 더보기」도, 칸의 값을
 * 겹쳐 적는 조건 칩도 두지 않는다. 「초기화」는 바뀐 것이 있을 때만 보인다(관리웹 정리 시안 A, 2026-11-20).
 *
 * **기본 기간을 심지 않는다**(계획 결정 3). 그 사실을 밝히던 줄 아래 안내와, 선택지가 늘 비어
 * 있어 쓰이지 않던 실사 유형·상태 조건은 걷었다(사용자 지시 2026-11-18).
 *
 * **조건이 하나도 없어도 조회가 열려 있다** — 이 화면은 들어오자마자 진행 중인 실사를 보여야
 * 한다. 잠글 조건이 없어 「조회」에 비활성 사유가 붙는 자리도 없다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const CountFilterBar = ({
  appliedFilters,
  warehouseOptions,
  warehouseNote,
  isLocked,
  onSearch,
  onReset,
}: CountFilterBarProps) => {
  const [filters, setFilters] = useState<CountFilters>(appliedFilters);

  /*
   * 주소가 정본이다 — 뒤로가기·초기화로 주소가 **바뀌면** 편집 중인 값도 그 값으로 되돌아간다.
   *
   * **되돌림을 참조가 아니라 값으로 판정한다.** 부모는 렌더할 때마다 주소에서 값을 새로 읽으므로
   * 내용이 같아도 참조가 달라질 수 있고(조회 응답이 도착해 다시 그려질 때가 그렇다),
   * 참조로 판정하면 그때마다 사용자가 고르던 값이 사라진다(#43). 값이 실제로 달라졌을 때만 되돌린다.
   */
  const {
    warehouse: appliedWarehouse,
    from: appliedFrom,
    to: appliedTo,
    inProgressOnly: appliedInProgressOnly,
  } = appliedFilters;

  useEffect(() => {
    setFilters({
      warehouse: appliedWarehouse,
      from: appliedFrom,
      to: appliedTo,
      inProgressOnly: appliedInProgressOnly,
    });
  }, [appliedWarehouse, appliedFrom, appliedTo, appliedInProgressOnly]);

  const search = (): void => {
    onSearch(filters);
  };

  /**
   * 초기화. **자기 편집 상태를 함께 비운다** — 부모에게만 알리면 아직 조회하지 않은 값은 주소가 바뀌지 않아 되돌림
   * effect 도 깨어나지 않고, 「초기화」를 눌렀는데 고르던 값이 그대로 남는다.
   */
  const reset = (): void => {
    setFilters(DEFAULT_FILTERS);
    onReset();
  };

  const isChanged = hasChangedFilters(DEFAULT_FILTERS, filters, appliedFilters);

  /* 「전체」를 값이 빈 선택지로 둔다 — 두지 않으면 한 번 고른 뒤에 해제할 방법이 칸 안에 없어진다. */
  const withAll = (options: SelectOption[]): SelectOption[] => [
    { value: '', label: t.filters.all },
    ...options,
  ];

  return (
    <div className="filter-bar">
      {/*
       * 규범 3-2 — 선택칸이 「코드 · 이름」을 고른다. 최소 폭을 주지 않으면
       * 선택지 목록이 트리거 폭에 갇혀 잘리고, 무엇을 고르는지 읽을 수 없다.
       */}
      <SelectField
        wide
        label={t.fields.warehouse}
        options={withAll(warehouseOptions)}
        value={filters.warehouse}
        note={warehouseNote}
        onChange={(value) => {
          setFilters((prev) => ({ ...prev, warehouse: value }));
        }}
      />

      {/* 설치본에 `DatePicker`가 없다 — 네이티브 타입으로 대체한다(W-01-07이 세운 처리). */}
      <TextField
        type="date"
        label={t.fields.plannedDateFrom}
        value={filters.from}
        onChange={(event) => {
          setFilters((prev) => ({ ...prev, from: event.target.value }));
        }}
      />
      <TextField
        type="date"
        label={t.fields.plannedDateTo}
        value={filters.to}
        onChange={(event) => {
          setFilters((prev) => ({ ...prev, to: event.target.value }));
        }}
      />

      {/* 확인칸은 라벨 층이 없다 — 규범 2의 `.field-cell-unlabeled`가 줄을 맞춘다. */}
      <div className="field-cell field-cell-unlabeled">
        <div className="check-group">
          <Checkbox
            checked={filters.inProgressOnly}
            onChange={(event) => {
              setFilters((prev) => ({ ...prev, inProgressOnly: event.target.checked }));
            }}
          >
            {t.fields.inProgressOnly}
          </Checkbox>
        </div>
      </div>

      {/*
       * 조회와 초기화는 짝이라 함께 줄바꿈되게 묶는다(배치 규범 2-1).
       * 조건 때문에 잠기는 자리는 없다 — 조건 없이도 조회가 열려 있다.
       * **전송 중에만 잠긴다**(수명 표 18행) — 조회·초기화는 고른 실사를 비우는 길이라,
       * 보내는 동안 열어 두면 앞 요청의 결과가 다른 맥락에 나타난다.
       * 조건 줄 오른쪽 끝에 선다 — 재고 관리 묶음의 다른 탭과 같다(#360).
       */}
      <div className="field-cell field-cell-unlabeled filter-actions-end">
        <div className="filter-actions">
          <Button disabled={isLocked} onClick={search}>
            {messages.common.search}
          </Button>
          {isChanged && (
            <Button variant="outlined" disabled={isLocked} onClick={reset}>
              {messages.common.reset}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
