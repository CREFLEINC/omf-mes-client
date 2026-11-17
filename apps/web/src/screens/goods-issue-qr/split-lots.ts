import type { components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { fetchAllPages } from '../../patterns/fetch-all-pages';
import type { MaterialLotLabelLot } from '../../patterns/material-lot-label-print';
import { plantToday } from '../../patterns/plant-time';
import { runRequest } from '../../patterns/request';

/**
 * P-01-02 분할 LOT 라벨 — 목록과 그 판정(008 · omf-all-around#289 · contracts §4).
 *
 * ⭐ 부분 출고가 만든 분할 LOT(원천 `GOODS_ISSUE_SPLIT`)에 자재 LOT 라벨(`MATERIAL_LOT_LABEL`)을 찍는다. 미발행
 *    판정·건수는 서버가 준다(`GET /logistics/split-material-lots`) — 화면이 다시 세지 않는다.
 */
export type SplitMaterialLot = components['schemas']['SplitMaterialLot'];

/** 보기 — 라벨 안 찍음(기간 무관 · 오래된 순)과 찍음(출고일 기간 · 최근 순). 서버 `labelState` 와 같다. */
export type LabelState = 'UNPRINTED' | 'PRINTED';

/** 찍음 보기의 출고일 기간. 서버 `issuedFrom`·`issuedTo`(기본 최근 7일). */
export type PrintedPeriod = 'today' | 'week' | 'month';

export const PRINTED_PERIODS: readonly PrintedPeriod[] = ['today', 'week', 'month'];

const PERIOD_DAYS: Record<PrintedPeriod, number> = { today: 0, week: 6, month: 29 };

/** 인쇄가 실패한 마지막 발행 — 미발행으로 남는다(서버 판정과 같다). */
export const PRINT_FAILED = 'FAILED';

export const splitLotKeys = {
  all: ['split-material-lots'] as const,
  list: (plantId: number | null, state: LabelState, period: PrintedPeriod) =>
    ['split-material-lots', plantId, state, state === 'PRINTED' ? period : null] as const,
};

/** 공장 날짜(`YYYY-MM-DD`)에서 며칠 앞. */
const daysBefore = (date: string, days: number): string => {
  const at = new Date(`${date}T00:00:00Z`);

  at.setUTCDate(at.getUTCDate() - days);

  return at.toISOString().slice(0, 10);
};

/** 찍음 보기의 출고일 범위 — 오늘(공장 날짜)까지. */
export const issuedRangeOf = (
  period: PrintedPeriod,
  now: Date = new Date(),
): { issuedFrom: string; issuedTo: string } => {
  const today = plantToday(now);

  return { issuedFrom: daysBefore(today, PERIOD_DAYS[period]), issuedTo: today };
};

export interface SplitLotList {
  items: SplitMaterialLot[];
  /** 이 공장의 라벨 안 찍은 분할 LOT 수(기간 무관) — 서버가 센다. */
  unprintedCount: number;
}

/**
 * 분할 LOT 목록 — 쪽을 끝까지 받는다. 「라벨 안 찍음」은 기간 제한이 없어 오래된 것이 뒷쪽에 밀리면 놓친다(SC-004).
 */
export const useSplitMaterialLots = (
  plantId: number | null,
  state: LabelState,
  period: PrintedPeriod,
): UseQueryResult<SplitLotList> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: splitLotKeys.list(plantId, state, period),
    enabled: plantId !== null,
    queryFn: async () => {
      let unprintedCount = 0;
      const range = state === 'PRINTED' ? issuedRangeOf(period) : {};
      const all = await fetchAllPages(async (page, size) => {
        const data = await runRequest(() =>
          client.GET('/logistics/split-material-lots', {
            params: {
              query: { plantId: plantId ?? 0, labelState: state, page, size, ...range },
            },
          }),
        );

        if (page === 1) unprintedCount = data.unprintedCount;

        return data;
      });

      return { items: all.items, unprintedCount };
    },
  });
};

/** 라벨을 안 찍었거나 마지막 인쇄가 실패했다 — 「라벨 안 찍음」에 남는다. */
export const isUnprinted = (lot: SplitMaterialLot): boolean =>
  lot.labelIssue === null || lot.labelIssue.lastPrintOutcomeCode === PRINT_FAILED;

/**
 * 찍으려면 재발행 사유가 필요한가 — 발행 기록이 한 번이라도 있으면 다음은 2회차 이상이다(FR-009 · 서버 422).
 * 인쇄 실패로 남은 것도 회차가 이미 올라 있다.
 */
export const needsReissueReason = (lot: SplitMaterialLot): boolean => lot.labelIssue !== null;

/** 다음에 찍힐 회차 — 라벨 오른쪽 위 `#n`(미리 보기). 실제 회차는 서버가 매긴다. */
export const nextIssueSeq = (lot: SplitMaterialLot): number =>
  (lot.labelIssue?.lastIssueSeq ?? 0) + 1;

/** 찾기 칸 — 분할 LOT·원래 LOT 번호(스캔), 출고번호, 품목코드·품명. 대소문자는 가리지 않는다. */
export const matchesSplitLot = (lot: SplitMaterialLot, query: string): boolean => {
  const needle = query.trim().toLocaleLowerCase('en-US');

  if (needle === '') return true;

  return [
    lot.lotNo,
    lot.parentLot.lotNo,
    lot.goodsIssue.goodsIssueNo,
    lot.item.itemCode,
    lot.item.itemName,
  ].some((value) => value.toLocaleLowerCase('en-US').includes(needle));
};

/**
 * 라벨 면에 실을 값 — 자재 LOT 라벨과 같은 양식(FR-007). 수량은 분할 수량, 공급사는 원조 입하 LOT 의 것.
 * ⛔ 패키징 줄은 없다 — 떼어 낸 봉지는 패키징 단위가 아니다.
 */
export const toLabelLot = (lot: SplitMaterialLot): MaterialLotLabelLot => ({
  itemCode: lot.item.itemCode,
  itemName: lot.item.itemName,
  lotNo: lot.lotNo,
  lotQty: lot.qty,
  uomCode: lot.uomCode,
  supplierCode: lot.supplier?.supplierCode ?? null,
  supplierName: lot.supplier?.supplierName ?? null,
  package: null,
});
