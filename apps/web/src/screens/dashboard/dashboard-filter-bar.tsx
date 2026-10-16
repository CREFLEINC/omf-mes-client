import { Button, DatePicker, Icon } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import { FieldLabel } from './field-label';
import type { DashboardFilters } from './filters';
import { DASHBOARD_REFRESH_INTERVAL_MS } from './queries';
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
  /** 재조회 중(수동 · 자동 모두). 그동안 「갱신」을 막는다 — 같은 요청을 겹쳐 보내지 않는다. */
  isRefreshing: boolean;
  /** 마지막으로 조회가 성공한 시각(공장 시각 표기). 아직 없으면 `null`. */
  lastUpdatedText: string | null;
  /** 갱신이 실패해 직전 값을 보이고 있다. */
  isStale: boolean;
}

/**
 * 기준 조건 줄 — **축이 둘뿐이다**(기준 날짜 · 공장).
 *
 * ⭐ **고르는 즉시 반영한다.** 형제 조회 화면들은 「모아서 적용」(조회 버튼)인데 여기는 다르다:
 * 자유 입력 칸이 없고 컨트롤이 둘뿐이라, 고르고 나서 다시 「조회」를 눌러야 하는 것은 한 걸음이
 * 남는 것이지 오조작을 막아 주지 않는다. 편집 중인 값을 따로 들지 않으므로 주소와 화면이
 * 어긋나는 갈래 자체가 생기지 않는다.
 *
 * 「갱신」은 조건을 바꾸는 것이 아니라 **같은 조건을 다시 묻는** 버튼이다. 자동 갱신 주기와 마지막 갱신
 * 시각을 조건 줄 바로 아래 한 줄에 상시로 적는다(omf-all-around#115 · 사용자 지시 2026-10-16) — 적지
 * 않으면 사용자가 화면을 실시간으로 읽는다.
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
  lastUpdatedText,
  isStale,
}: DashboardFilterBarProps) => {
  const baseDateId = useId();
  const noteId = `${baseDateId}-manual`;

  return (
    <div className="filter-bar dashboard-filter-bar">
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

      {/*
       * ⭐ 오른쪽 묶음 — 갱신 안내 + 「갱신」(사용자 지시 2026-10-16). 왼쪽 필터와 역할을 나눠 줄 오른쪽 끝에
       * 선다. 좁으면 묶음째 다음 줄로 내려간다(안내와 단추는 떨어지지 않는다). 줄은 아래 기준선으로
       * 맞춰 입력칸과 같은 줄에 선다(`app.css` `.dashboard-filter-bar`).
       */}
      <div className="filter-actions dashboard-filter-actions">
        {/*
         * 안내를 **이 버튼에** 잇는다(`aria-describedby`) — 갱신 주기와 마지막 갱신은 이 버튼을 누를지
         * 정하는 정보다.
         */}
        <p id={noteId} className="dashboard-refresh-status">
          {[
            t.filters.autoRefresh(DASHBOARD_REFRESH_INTERVAL_MS / 60_000),
            ...(lastUpdatedText === null ? [] : [t.filters.lastUpdated(lastUpdatedText)]),
            ...(isStale ? [t.filters.refreshFailed] : []),
          ].join(' · ')}
        </p>
        {/*
         * ⭐ 입력칸과 같은 높이 · 모서리 · 테두리, 기본 글자색(사용자 지시 2026-10-16). DS `outlined` 의
         * 빨간 글자(`--primary-text`)와 둥근 알약 모양만 `.dashboard-refresh-button` 이 덮는다.
         * 재조회 중에는 막고(로딩) — 자동 갱신이 도는 순간에 눌러도 요청이 겹치지 않는다.
         */}
        <Button
          variant="outlined"
          className="dashboard-refresh-button"
          leadingIcon={<Icon name="refresh" size={18} />}
          onClick={onRefresh}
          disabled={isRefreshing}
          loading={isRefreshing}
          aria-describedby={noteId}
        >
          {t.filters.refresh}
        </Button>
      </div>
    </div>
  );
};
