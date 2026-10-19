import { Button, DatePicker, Icon, Select } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, useState } from 'react';

import { FieldLabel } from './field-label';
import {
  MAX_PERIOD_DAYS,
  QUICK_PERIODS,
  periodProblemOf,
  quickPeriodOf,
  type DashboardFilters,
  type PeriodProblem,
  type QuickPeriod,
} from './filters';
import { DASHBOARD_REFRESH_INTERVAL_MS } from './queries';
import { SelectField } from './select-field';
import type { SelectOption } from './types';

const t = messages.dashboard;

export interface DashboardFilterBarProps {
  /** 주소에 반영된(= 조회에 쓰인) 조건. 이 부품은 편집 중인 값을 따로 들지 않는다. */
  filters: DashboardFilters;
  plantOptions: SelectOption[];
  plantNote?: string;
  /** 「전체 공장」 선택지를 둘지. 데이터 범위가 공장 하나뿐이면 그 공장만 고를 수 있다(omf-all-around#120). */
  allowAllPlants?: boolean;
  onChange: (filters: DashboardFilters) => void;
  onRefresh: () => void;
  /** 재조회 중(수동 · 자동 모두). 그동안 「갱신」을 막는다 — 같은 요청을 겹쳐 보내지 않는다. */
  isRefreshing: boolean;
  /** 마지막으로 조회가 성공한 시각(공장 시각 표기). 아직 없으면 `null`. */
  lastUpdatedText: string | null;
  /** 갱신이 실패해 직전 값을 보이고 있다. */
  isStale: boolean;
  /** 공장 시각의 오늘(YYYY-MM-DD) — 빠른 선택과 미래 날짜 막기에만 쓴다. */
  today: string;
  /** 자동 갱신 중인가 — 지난 기간이면 `false`(안내를 「자동 갱신 안 함」으로). */
  isLive: boolean;
  /** 서버가 기간을 거절한 이유(400 field dateFrom · dateTo). 없으면 `undefined`. */
  periodError?: string;
}

const problemText = (problem: PeriodProblem): string => {
  switch (problem) {
    case 'order':
      return t.filters.periodOrder;
    case 'tooLong':
      return t.filters.periodTooLong(MAX_PERIOD_DAYS);
    case 'future':
      return t.filters.periodFuture;
  }
};

/**
 * 기준 조건 줄 — **축이 둘뿐이다**(기간 · 공장).
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
  allowAllPlants = true,
  onChange,
  onRefresh,
  isRefreshing,
  lastUpdatedText,
  isStale,
  today,
  isLive,
  periodError,
}: DashboardFilterBarProps) => {
  const periodId = useId();
  const noteId = `${periodId}-manual`;
  const periodNoteId = `${periodId}-note`;
  /* 고를 수 없는 기간(92일 초과 등)을 골랐을 때의 안내 — 조회하지 않고 칸 옆에 남긴다. */
  const [problem, setProblem] = useState<PeriodProblem | null>(null);
  /* 「직접 지정」을 고른 상태 — 지금 기간이 빠른 항목과 같아도 달력을 켜 둔다. */
  const [customPicked, setCustomPicked] = useState(false);
  const shownFrom = filters.dateFrom === '' ? today : filters.dateFrom;
  const shownTo = filters.dateTo === '' ? today : filters.dateTo;
  const periodNote = problem === null ? periodError : problemText(problem);
  /* 주소의 기간이 빠른 항목과 정확히 같으면 그 항목, 아니면 「직접 지정」. */
  const matchedQuick = QUICK_PERIODS.find((quick) => {
    const [from, to] = quickPeriodOf(quick, today);

    return from === shownFrom && to === shownTo;
  });
  const selected: QuickPeriod | 'custom' =
    customPicked || matchedQuick === undefined ? 'custom' : matchedQuick;

  const applyPeriod = (from: string, to: string): void => {
    const found = periodProblemOf(from, to, today);
    setProblem(found);
    if (found === null) onChange({ ...filters, dateFrom: from, dateTo: to });
  };

  return (
    <div className="filter-bar dashboard-filter-bar">
      {/*
       * ⭐ 기간(사용자 확정 2026-10-16) — DS 드롭다운(오늘 · 어제 · 최근 7일 · 이번 달 · 직접 지정) + DS 기간 달력
       * (「직접 지정」일 때만 켬). 기본은 오늘이고
       * 비워 두면 서버가 오늘로 정한다. 미래 날짜는 달력이 막고(`max`), 92일 초과는 고른 뒤 칸 옆에 안내하고
       * 조회하지 않는다. 서버가 거절한 이유(400)도 같은 자리에 선다.
       */}
      <div className="field-cell dashboard-period-cell">
        <FieldLabel htmlFor={periodId} label={t.filters.period} />
        <div className="dashboard-period">
          <Select
            id={periodId}
            className="dashboard-period-select"
            options={[...QUICK_PERIODS, 'custom' as const].map((key) => ({
              value: key,
              label: key === 'custom' ? t.filters.customPeriod : t.filters.quick[key],
            }))}
            value={selected}
            onChange={(value) => {
              if (value === 'custom') {
                setCustomPicked(true);
                return;
              }
              const quick = QUICK_PERIODS.find((key) => key === value);
              if (quick === undefined) return;
              setCustomPicked(false);
              const [from, to] = quickPeriodOf(quick, today);
              applyPeriod(from, to);
            }}
          />
          {/*
           * 날짜 범위 — 「직접 지정」일 때만 켠다. 다른 항목이면 꺼진 채 그 항목이 계산한 기간을 그대로 보인다.
           */}
          <DatePicker
            mode="range"
            max={today}
            value={[shownFrom, shownTo]}
            disabled={selected !== 'custom'}
            invalid={periodNote !== undefined}
            aria-label={t.filters.customPeriod}
            aria-describedby={periodNote === undefined ? undefined : periodNoteId}
            onChange={([from, to]) => {
              applyPeriod(from, to);
            }}
          />
        </div>
        {periodNote !== undefined && (
          <span id={periodNoteId} className="field-error" role="alert">
            {periodNote}
          </span>
        )}
      </div>

      <SelectField
        label={t.filters.plant}
        options={
          allowAllPlants
            ? [{ value: '', label: t.filters.allPlants }, ...plantOptions]
            : plantOptions
        }
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
            isLive
              ? t.filters.autoRefresh(DASHBOARD_REFRESH_INTERVAL_MS / 60_000)
              : t.filters.autoRefreshOff,
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
