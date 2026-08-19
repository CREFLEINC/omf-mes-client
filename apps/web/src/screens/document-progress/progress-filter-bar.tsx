import { Button, Checkbox, DatePicker, SearchInput, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState } from 'react';

import { codeNote, codePlaceholder } from './code-options';
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
  /** 상태 선택지. 같은 이유로 화면이 넘긴다. */
  statusOptions: SelectOption[];
  onSearch: (filters: ProgressFilters) => void;
  onReset: () => void;
}

/**
 * 진행현황 조회 조건 줄 — **여덟 축**이다.
 *
 * 트리거 모델은 「모아서 적용」이다 — 조건을 고치는 동안 조회가 나가면 반쯤 지운 검색어로
 * 요청이 나간다. 「조회」를 누를 때만 주소가 바뀌고 그때 조회된다.
 *
 * ⭐ **문서 유형만 성질이 다르다.** 나머지 일곱은 결과를 좁히는 조건이지만 유형은 **조회가
 * 성립하기 위한 전제**다(계약 필수 질의값). 그래서 유형이 비어 있으면 「조회」를 눌러도 요청이
 * 나가지 않고, 그 사실은 표 자리의 안내가 말한다 — 버튼을 잠그지 않는 이유는, 잠그면 사용자가
 * **무엇을 채워야 열리는지**를 화면에서 읽을 수 없기 때문이다.
 *
 * **품목·자재 LOT·창고는 번호 칸이다.** 이름으로 고르는 참조 조회를 두지 않는다 — 이름 목록을
 * 얹으면 그 조회의 좁힘·잘림 규칙이 함께 따라오는데, 이 회차의 목록은 그 이름을 그리지 않는다.
 * 번호로만 좁힌다는 사실은 보조 문구가 밝힌다.
 *
 * **조건 칩을 두지 않는다.** 조건이 여덟이고 전부 이 줄에 그대로 서 있어 칩이 같은 사실을 두 번
 * 말한다 — 칩은 조건이 접히거나 다른 탭에 걸릴 때 값을 되짚는 수단이고, 이 화면에는 그 자리가 없다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const ProgressFilterBar = ({
  appliedFilters,
  documentTypeOptions,
  disabledTypeNote,
  statusOptions,
  onSearch,
  onReset,
}: ProgressFilterBarProps) => {
  const periodId = useId();
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
    item: appliedItem,
    lot: appliedLot,
    warehouse: appliedWarehouse,
    cancellableOnly: appliedCancellableOnly,
    q: appliedQ,
  } = appliedFilters;

  useEffect(() => {
    setFilters({
      documentType: appliedDocumentType,
      status: appliedStatus,
      from: appliedFrom,
      to: appliedTo,
      item: appliedItem,
      lot: appliedLot,
      warehouse: appliedWarehouse,
      cancellableOnly: appliedCancellableOnly,
      q: appliedQ,
    });
  }, [
    appliedDocumentType,
    appliedStatus,
    appliedFrom,
    appliedTo,
    appliedItem,
    appliedLot,
    appliedWarehouse,
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

  /**
   * 값 목록이 비어 있는 코드 칸은 **「전체」도 붙이지 않는다.** 고를 것이 하나도 없는데
   * 「전체」만 있으면 목록이 준비된 것처럼 보인다 — 왜 비었는지는 안내가 말한다.
   */
  const withAllOption = (options: SelectOption[]): SelectOption[] =>
    options.length === 0 ? options : [{ value: '', label: t.filters.all }, ...options];

  /**
   * 유형 칸의 보조 문구 — **둘 중 하나만 선다.**
   *
   * 「목록이 준비 중」은 선택지가 **비었을 때만**, 「고를 수 없는 유형이 있다」는 표에 값이
   * **있을 때만** 선다. 둘 다 같은 표에서 나오므로 **동시에 설 수 없다** — 그래서 이어 붙이지
   * 않고 앞의 것을 먼저 본다. 이어 붙이는 형태로 두면 일어날 수 없는 조합을 설명하는 코드가 되고,
   * 읽는 사람이 「둘이 함께 뜨는 화면」을 찾다 헤맨다.
   */
  const documentTypeNote = codeNote(documentTypeOptions) ?? disabledTypeNote;

  return (
    <>
      <div className="filter-bar">
        <SelectField
          label={t.fields.documentType}
          options={withAllOption(documentTypeOptions)}
          value={filters.documentType}
          note={documentTypeNote}
          placeholder={documentTypeOptions.length === 0 ? codePlaceholder() : t.filters.all}
          onChange={(value) => {
            setFilters((prev) => ({ ...prev, documentType: value }));
          }}
        />

        <SelectField
          label={t.fields.status}
          options={withAllOption(statusOptions)}
          value={filters.status}
          note={codeNote(statusOptions)}
          placeholder={statusOptions.length === 0 ? codePlaceholder() : t.filters.all}
          onChange={(value) => {
            setFilters((prev) => ({ ...prev, status: value }));
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

        <div className="field-cell">
          <TextField
            label={t.fields.item}
            inputMode="numeric"
            value={filters.item}
            onChange={(event) => {
              setFilters((prev) => ({ ...prev, item: event.target.value }));
            }}
          />
        </div>

        <div className="field-cell">
          <TextField
            label={t.fields.lot}
            inputMode="numeric"
            value={filters.lot}
            onChange={(event) => {
              setFilters((prev) => ({ ...prev, lot: event.target.value }));
            }}
          />
        </div>

        <div className="field-cell">
          <TextField
            label={t.fields.warehouse}
            inputMode="numeric"
            value={filters.warehouse}
            onChange={(event) => {
              setFilters((prev) => ({ ...prev, warehouse: event.target.value }));
            }}
          />
        </div>

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

        <SearchInput
          label={t.fields.q}
          value={filters.q}
          onChange={(event) => {
            setFilters((prev) => ({ ...prev, q: event.target.value }));
          }}
          /* 엔터로도 조회된다 — 검색칸에서 엔터가 아무 일도 하지 않으면 멈춘 것으로 읽힌다. */
          onSearch={search}
        />

        {/* 조회와 초기화는 짝이라 함께 줄바꿈되게 묶는다. */}
        <div className="field-cell field-cell-unlabeled">
          <div className="filter-actions">
            <Button onClick={search}>{messages.common.search}</Button>
            <Button variant="outlined" onClick={reset}>
              {messages.common.reset}
            </Button>
          </div>
        </div>
      </div>

      {/*
       * 화면이 스스로 밝히는 두 사실.
       *
       * ① 기본 기간을 심지 않는다 — **비어 있는 칸이 고장으로 읽히지 않게** 한다(전례
       *    `disposal-issue/gi-filter-bar.tsx`의 `periodNote`와 같은 자리).
       * ② 품목·자재 LOT·창고는 **번호로만** 좁힌다 — 이름을 치다 빈 결과를 보면 안 된다.
       */}
      <p className="field-note">{t.filters.periodNote}</p>
      <p className="field-note">{t.filters.idNote}</p>
    </>
  );
};
