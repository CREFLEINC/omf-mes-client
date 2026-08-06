import { Button, Chip, Select, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState } from 'react';

import { toFilterChips, type MessageFilters } from './filters';
import { validatePeriod, type PeriodInput } from './period';

const t = messages.integrationSync;

/** 한 선택칸이 필요로 하는 것 전부. 네 칸이 같은 구조라 목록으로 돌린다. */
interface CodeSelect {
  key: keyof MessageFilters;
  label: string;
  options: readonly string[];
}

export interface MessageFilterBarProps {
  /** 주소에 반영된(= 조회에 쓰인) 기간. 편집 중인 값은 이 부품 안에만 있다. */
  appliedPeriod: PeriodInput;
  appliedFilters: MessageFilters;
  /** 코드 선택지 4종. 조회 결과에서 만들어 화면이 넘긴다. */
  statusOptions: readonly string[];
  interfaceOptions: readonly string[];
  directionOptions: readonly string[];
  targetTypeOptions: readonly string[];
  onSearch: (period: PeriodInput, filters: MessageFilters) => void;
  /** 조건 칩의 ×. 그 조건 하나만 풀고 곧바로 다시 조회한다. */
  onRemoveFilter: (key: keyof MessageFilters) => void;
  onReset: () => void;
}

/**
 * 조회 조건 줄.
 *
 * 트리거 모델은 「모아서 적용, 해제는 즉시」다 — 날짜나 조건을 고치는 동안 조회가 나가면
 * 반쯤 지운 기간으로 요청이 나간다. 「조회」를 누를 때만 주소가 바뀌고 그때 조회된다.
 * 조건 칩의 ×는 해제라 즉시 반영한다.
 */
export const MessageFilterBar = ({
  appliedPeriod,
  appliedFilters,
  statusOptions,
  interfaceOptions,
  directionOptions,
  targetTypeOptions,
  onSearch,
  onRemoveFilter,
  onReset,
}: MessageFilterBarProps) => {
  const reasonId = useId();
  const fieldId = useId();

  const [period, setPeriod] = useState<PeriodInput>(appliedPeriod);
  const [filters, setFilters] = useState<MessageFilters>(appliedFilters);

  useEffect(() => {
    setPeriod(appliedPeriod);
  }, [appliedPeriod]);
  useEffect(() => {
    setFilters(appliedFilters);
  }, [appliedFilters]);

  /** 기간이 갖춰지지 않으면 조회를 막고 사유를 밝힌다 — 계약이 기간을 필수로 두었다. */
  const searchReason = validatePeriod(period);

  const codeSelects: CodeSelect[] = [
    { key: 'status', label: t.fields.status, options: statusOptions },
    { key: 'iface', label: t.fields.interfaceCode, options: interfaceOptions },
    { key: 'direction', label: t.fields.direction, options: directionOptions },
    { key: 'targetType', label: t.fields.targetType, options: targetTypeOptions },
  ];

  const chips = toFilterChips(appliedFilters);

  return (
    <>
      <div className="filter-bar">
        <TextField
          type="date"
          label={t.fields.periodFrom}
          value={period.from}
          onChange={(event) => {
            setPeriod((prev) => ({ ...prev, from: event.target.value }));
          }}
        />
        <TextField
          type="date"
          label={t.fields.periodTo}
          value={period.to}
          onChange={(event) => {
            setPeriod((prev) => ({ ...prev, to: event.target.value }));
          }}
        />

        {codeSelects.map((select) => (
          /*
           * 배치 규범 3 — 디자인 시스템 Select는 라벨을 내장하지 않는다.
           * 라벨을 직접 붙이고 htmlFor로 잇는다. aria-label만 두면 눈으로 보이는 이름이 없다.
           *
           * 규범 3-2 — 이 네 칸은 **코드값**을 고른다. 선택지 목록이 트리거 폭에 갇혀 있어
           * 최소 폭을 주지 않으면 「FAILED」가 「FAI⋯」로 잘려 무엇을 고르는지 읽을 수 없다.
           * 값이 짧은 시도 하한 칸에는 붙이지 않는다.
           */
          <div className="field-cell wide-select" key={select.key}>
            <label className="field-label" htmlFor={`${fieldId}-${select.key}`}>
              {select.label}
            </label>
            <Select
              id={`${fieldId}-${select.key}`}
              value={filters[select.key]}
              placeholder={t.filters.all}
              /*
               * 「전체」를 값이 빈 선택지로 둔다. 두지 않으면 한 번 고른 뒤에
               * 조건을 해제할 방법이 선택칸 안에 없어진다.
               */
              options={[
                { value: '', label: t.filters.all },
                ...select.options.map((code) => ({ value: code, label: code })),
              ]}
              onChange={(value) => {
                setFilters((prev) => ({ ...prev, [select.key]: value }));
              }}
            />
          </div>
        ))}

        <div className="field-cell">
          <label className="field-label" htmlFor={`${fieldId}-retryMin`}>
            {t.fields.retryMin}
          </label>
          <TextField
            id={`${fieldId}-retryMin`}
            type="number"
            min={0}
            step={1}
            value={filters.retryMin}
            onChange={(event) => {
              setFilters((prev) => ({ ...prev, retryMin: event.target.value }));
            }}
          />
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
              onClick={() => {
                onSearch(period, filters);
              }}
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

      {/* 선택지가 어디서 왔고 무엇이 빠져 있는지 밝힌다 — 없으면 값이 사라진 것으로 읽힌다. */}
      <p className="field-note">{t.filters.optionsNote}</p>

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
