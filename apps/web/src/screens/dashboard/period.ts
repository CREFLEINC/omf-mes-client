import { messages } from '@omf-mes/i18n';
import { createContext, useContext } from 'react';

import type { DashboardFilterQuery } from './filters';

/**
 * 지금 보는 기간이 **하루**인가(⭐ 기간 조회 · 사용자 확정 2026-10-16). 화면이 조건에서 정해 내려 준다
 * (`isSingleDay`). 하루면 표기는 지금 그대로(「금일」 · 「당월」 · 「전일 대비」 · 「전월」), 이틀 이상이면
 * 「선택 기간」 · 「직전 기간」. 설비 · 출하 대기 · 알림처럼 「실시간 / 현재」인 칸은 이 값을 보지 않는다.
 */
export const SingleDayContext = createContext(true);

export const useSingleDay = (): boolean => useContext(SingleDayContext);

const q = messages.dashboard.quality;

/** 품질 · 부적합 탭의 기간 이름표 — 하루면 「당월」(전월 비교) 그대로, 이틀 이상이면 「선택 기간」(직전 기간 비교). */
export const usePeriodTags = () =>
  useSingleDay()
    ? {
        month: q.tagMonth,
        monthTotal: q.tagMonthTotal,
        today: q.tagToday,
        recent: q.dailyRecent,
        prev: q.prevMonth,
        prevMissing: q.prevMissing,
        flat: q.deltaFlat,
      }
    : {
        month: q.tagPeriod,
        monthTotal: q.tagPeriod,
        today: q.tagPeriod,
        recent: q.tagPeriod,
        prev: q.prevPeriod,
        prevMissing: q.prevMissingPeriod,
        flat: q.deltaFlatPeriod,
      };

/**
 * 대시보드가 지금 쓰는 조회 조건(기간 · 공장) — 품질 종합 LOT 목록 창이 같은 조건으로 부르려고 쓴다(카드 숫자와 같은
 * 기간 · 공장). 화면이 내려 준다.
 */
export const FilterQueryContext = createContext<DashboardFilterQuery>({});
