import { Button, DatePicker } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import { FieldLabel } from './field-label';
import type { DashboardFilters } from './filters';
import { SelectField } from './select-field';
import type { SelectOption } from './types';

const t = messages.dashboard;

export interface DashboardFilterBarProps {
  /** 주소에 반영된(= 조회에 쓰인) 조건. 이 부품은 편집 중인 값을 따로 들지 않는다. */
  filters: DashboardFilters;
  plantOptions: SelectOption[];
  plantNote?: string;
  onChange: (filters: DashboardFilters) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

/**
 * 기준 조건 줄 — **축이 둘뿐이다**(기준 날짜 · 공장).
 *
 * ⭐ **고르는 즉시 반영한다.** 형제 조회 화면들은 「모아서 적용」(조회 버튼)인데 여기는 다르다:
 * 자유 입력 칸이 없고 컨트롤이 둘뿐이라, 고르고 나서 다시 「조회」를 눌러야 하는 것은 한 걸음이
 * 남는 것이지 오조작을 막아 주지 않는다. 편집 중인 값을 따로 들지 않으므로 주소와 화면이
 * 어긋나는 갈래 자체가 생기지 않는다.
 *
 * ⛔ **자동 갱신이 없다** — 「갱신」은 조건을 바꾸는 것이 아니라 **같은 조건을 다시 묻는** 버튼이다.
 * 그 사실을 조건 줄에 상시로 적는다. 적지 않으면 사용자가 화면을 실시간으로 읽는다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const DashboardFilterBar = ({
  filters,
  plantOptions,
  plantNote,
  onChange,
  onRefresh,
  isRefreshing,
}: DashboardFilterBarProps) => {
  const baseDateId = useId();
  const noteId = `${baseDateId}-manual`;

  return (
    /*
     * 안내는 `.filter-bar` **밖**에 둔다 — 그 클래스는 컨트롤을 한 줄로 늘어놓는 flex라
     * 안에 넣으면 문장이 칸 하나로 끼어들어 컨트롤 사이에 선다.
     */
    <>
      <div className="filter-bar">
        <div className="field-cell">
          <FieldLabel htmlFor={baseDateId} label={t.filters.baseDate} />
          {/*
           * 기준 날짜를 비울 수 있게 둔다(`clearable`) — 비우면 서버가 오늘로 정한다.
           * 화면이 「오늘」을 계산하지 않으므로 비움이 곧 「오늘」이고, 그 길을 막으면 한 번
           * 날짜를 고른 뒤에는 오늘로 돌아올 방법이 칸 안에 없어진다.
           */}
          <DatePicker
            id={baseDateId}
            mode="single"
            clearable
            placeholder={messages.common.selectDate}
            value={filters.baseDate === '' ? null : filters.baseDate}
            onChange={(value) => {
              onChange({ ...filters, baseDate: value ?? '' });
            }}
          />
        </div>

        <SelectField
          label={t.filters.plant}
          options={[{ value: '', label: t.filters.allPlants }, ...plantOptions]}
          value={filters.plant}
          note={plantNote}
          placeholder={t.filters.allPlants}
          wide
          onChange={(value) => {
            onChange({ ...filters, plant: value });
          }}
        />

        <div className="filter-actions">
          {/*
           * 안내를 **이 버튼에** 잇는다. 줄을 감싼 `div`에 붙이면 역할이 없는 요소라 보조 기술이
           * 읽지 않는다 — 「자동으로 갱신되지 않는다」는 사실이 이 버튼을 두는 이유 자체이므로,
           * 그 사실이 닿아야 할 자리도 여기다.
           */}
          <Button
            variant="outlined"
            onClick={onRefresh}
            disabled={isRefreshing}
            aria-describedby={noteId}
          >
            {t.filters.refresh}
          </Button>
        </div>
      </div>

      <p id={noteId} className="pane-lead">
        {t.filters.manualOnly}
      </p>
    </>
  );
};
