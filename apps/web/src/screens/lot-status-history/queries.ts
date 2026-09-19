import type { ApiClient, components } from '@omf-mes/api-client';
import { keepPreviousData, useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { HistoryFilters, LotFilters } from './filters';
import { lotStatusKeys } from './query-keys';
import {
  toHistoryActorId,
  toLotHistoryBounds,
  toLotHoldEventQuery,
  toLotHoldListQuery,
  toLotStatusEventQuery,
  toLotStatusListQuery,
  toLotStatusSummaryQuery,
  type LotHoldEventQuery,
  type LotStatusEventQuery,
} from './request-queries';
import { mergeTimeline, scopeStatusEvents, type LotTimelineEntry } from './timeline';
import {
  toLotHoldEventView,
  toLotStatusEventView,
  toLotHoldView,
  toLotDetailView,
  toLotStatusRow,
  toLotStatusSummaryView,
  type LotHoldEventView,
  type LotStatusEventView,
  type LotHoldView,
  type LotDetailView,
  type LotStatusRow,
  type LotStatusSummaryView,
} from './types';

type Client = ApiClient['client'];
type PageMeta = components['schemas']['PageMeta'];
type AppUser = components['schemas']['AppUser'];

export interface LotStatusListResult {
  rows: readonly LotStatusRow[];
  page: PageMeta;
}

export interface LotHoldListResult {
  rows: readonly LotHoldView[];
  page: PageMeta;
}

export interface LotTimelineResult {
  entries: readonly LotTimelineEntry[];
  /** 보류 사건이 읽기 상한을 넘어 일부만 합쳤다. */
  isTruncated: boolean;
}

export interface LotActorListResult {
  items: readonly AppUser[];
  page: PageMeta;
}

export const useLotActorOptions = (enabled: boolean): UseQueryResult<LotActorListResult> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: lotStatusKeys.actors,
    enabled,
    queryFn: () =>
      runRequest(() => client.GET('/app/users', { params: { query: { includeInactive: true } } })),
  });
};

export const useLotDetail = (lotId: number | null): UseQueryResult<LotDetailView> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: lotStatusKeys.detail(lotId),
    enabled: lotId !== null,
    queryFn: async () => {
      if (lotId === null) throw new Error('LOT을 고르기 전에는 상세를 조회하지 않습니다.');
      const data = await runRequest(() =>
        client.GET('/trace/lots/{lotId}', { params: { path: { lotId } } }),
      );
      return toLotDetailView(data);
    },
  });
};

const fetchLotStatuses = async (
  client: Client,
  query: NonNullable<ReturnType<typeof toLotStatusListQuery>>,
): Promise<LotStatusListResult> => {
  const data = await runRequest(() => client.GET('/quality/lot-statuses', { params: { query } }));

  return { rows: data.items.map(toLotStatusRow), page: data.page };
};

export const useLotStatusList = (
  filters: LotFilters,
  page: number,
): UseQueryResult<LotStatusListResult> => {
  const { client } = useApiClient();
  const query = toLotStatusListQuery(filters, page);

  return useQuery({
    queryKey: lotStatusKeys.list(filters, page),
    enabled: query !== null,
    placeholderData: keepPreviousData,
    queryFn: () => {
      if (query === null) throw new Error('LOT 유형을 고르기 전에는 목록을 조회하지 않습니다.');
      return fetchLotStatuses(client, query);
    },
  });
};

const fetchLotStatusSummary = async (
  client: Client,
  query: NonNullable<ReturnType<typeof toLotStatusSummaryQuery>>,
): Promise<LotStatusSummaryView> => {
  const data = await runRequest(() =>
    client.GET('/quality/lot-status-summary', { params: { query } }),
  );

  return toLotStatusSummaryView(data);
};

export const useLotStatusSummary = (filters: LotFilters): UseQueryResult<LotStatusSummaryView> => {
  const { client } = useApiClient();
  const query = toLotStatusSummaryQuery(filters);

  return useQuery({
    queryKey: lotStatusKeys.summary(filters),
    enabled: query !== null,
    queryFn: () => {
      if (query === null) throw new Error('LOT 유형을 고르기 전에는 요약을 조회하지 않습니다.');
      return fetchLotStatusSummary(client, query);
    },
  });
};

const fetchLotHolds = async (
  client: Client,
  query: NonNullable<ReturnType<typeof toLotHoldListQuery>>,
): Promise<LotHoldListResult> => {
  const data = await runRequest(() => client.GET('/quality/lot-holds', { params: { query } }));

  return { rows: data.items.map(toLotHoldView), page: data.page };
};

export const useLotHolds = (lotId: number | null, page = 1): UseQueryResult<LotHoldListResult> => {
  const { client } = useApiClient();
  const query = toLotHoldListQuery(lotId, page);

  return useQuery({
    queryKey: lotStatusKeys.holds(lotId, page),
    enabled: query !== null,
    placeholderData: keepPreviousData,
    queryFn: () => {
      if (query === null) throw new Error('LOT을 고르기 전에는 보류 문서를 조회하지 않습니다.');
      return fetchLotHolds(client, query);
    },
  });
};

/** 한 번에 받을 보류 사건 수. 서버 상한(200)과 같다. */
const HOLD_EVENT_PAGE_SIZE = 200;
/** 기간이 넓어도 화면이 멎지 않게 읽기를 여기서 멈춘다. 넘으면 「일부만」을 밝힌다. */
const HOLD_EVENT_MAX_PAGES = 10;

/**
 * 상태 변경과 한 표에 합치려면 기간 안의 보류 사건을 모두 받아야 한다 — 서버 쪽 나눔을
 * 그대로 쓰면 두 줄 종류의 쪽 경계가 어긋난다. 쪽을 넘기며 끝까지 읽는다.
 */
const fetchAllHoldEvents = async (
  client: Client,
  query: LotHoldEventQuery,
): Promise<{ rows: LotHoldEventView[]; isTruncated: boolean }> => {
  const rows: LotHoldEventView[] = [];

  for (let page = 1; page <= HOLD_EVENT_MAX_PAGES; page += 1) {
    const data = await runRequest(() =>
      client.GET('/quality/lot-hold-events', {
        params: { query: { ...query, page, size: HOLD_EVENT_PAGE_SIZE } },
      }),
    );
    rows.push(...data.items.map(toLotHoldEventView));
    if (data.items.length === 0 || rows.length >= data.page.total) {
      return { rows, isTruncated: false };
    }
  }

  return { rows, isTruncated: true };
};

const fetchStatusEvents = async (
  client: Client,
  query: LotStatusEventQuery,
): Promise<LotStatusEventView[]> => {
  const data = await runRequest(() =>
    client.GET('/trace/lot-status-events', { params: { query } }),
  );
  return data.items.map(toLotStatusEventView);
};

/** 「이력으로 찾기」 — 기간 안의 보류 사건과 상태 변경을 합친다. 쪽 나눔은 화면이 한다. */
export const useLotHistoryTimeline = (
  filters: HistoryFilters,
  offsetMinutes: number,
): UseQueryResult<LotTimelineResult> => {
  const { client } = useApiClient();
  const holdQuery = toLotHoldEventQuery(filters, 1, offsetMinutes);
  const statusQuery = toLotStatusEventQuery(filters, offsetMinutes);

  return useQuery({
    queryKey: lotStatusKeys.history(filters, offsetMinutes),
    enabled: holdQuery !== null && statusQuery !== null,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      if (holdQuery === null || statusQuery === null)
        throw new Error('유효한 기간을 입력하기 전에는 이력을 조회하지 않습니다.');
      const [holds, statuses] = await Promise.all([
        fetchAllHoldEvents(client, holdQuery),
        fetchStatusEvents(client, statusQuery),
      ]);
      const scoped = scopeStatusEvents(statuses, {
        lotNo: filters.lot,
        actorId: toHistoryActorId(filters),
      });
      return { entries: mergeTimeline(holds.rows, scoped), isTruncated: holds.isTruncated };
    },
  });
};

/** LOT 상세 — 그 LOT 의 보류 사건과 상태 변경 전부. */
export const useLotTimeline = (lotId: number): UseQueryResult<LotTimelineResult> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: lotStatusKeys.lotTimeline(lotId),
    queryFn: async () => {
      const bounds = toLotHistoryBounds(new Date());
      const [holds, statuses] = await Promise.all([
        fetchAllHoldEvents(client, { ...bounds, lotId, sort: 'occurredDesc' }),
        fetchStatusEvents(client, { ...bounds, lotId }),
      ]);
      return { entries: mergeTimeline(holds.rows, statuses), isTruncated: holds.isTruncated };
    },
  });
};
