import type { paths } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { ApiRequestError, runRequest } from '../../patterns/request';
import type { PeriodQuery } from '../integration-sync/period';
import type { MessageListResult } from '../integration-sync/types';
import {
  MESSAGE_STATUS,
  OUTBOUND_DIRECTION,
  toOutboundItem,
  type CountedStatus,
  type OutboundItem,
  type OutboundItemSettingRow,
} from './outbound-items';

/**
 * ERP 송신 탭의 읽기 — 송신 항목 설정 하나(짝 · 대기 · 실패 건수 · 송신 켜짐, 서버 #849)와 송신 예정 목록이다.
 *
 * 송신 예정 목록의 키는 연동 현황·이력의 키(`integration-messages`) 아래에 둔다 — 거기서 다시 보내면(재처리) 그
 * 무효화가 여기 목록도 함께 다시 읽는다.
 *
 * 송신기는 10초마다 돈다 — 보낸 건이 목록에서 빠지는 것이 보이게 15초마다 다시 읽는다.
 */
export const REFRESH_MS = 15_000;

/** 송신 예정 목록 한 쪽의 줄 수. */
export const PENDING_PAGE_SIZE = 20;

export const erpOutboundKeys = {
  items: ['erp-outbound', 'items'] as const,
  pending: (interfaceCode: string | null, page: number, period: PeriodQuery | null) =>
    ['integration-messages', 'outbound-pending', interfaceCode, page, period] as const,
};

/** 권한이 없으면(403) 다시 불러도 같다 — 되풀이하지 않는다. */
const isForbidden = (error: unknown): boolean =>
  error instanceof ApiRequestError && error.httpStatus === 403;

const retryUnlessForbidden = (count: number, error: Error): boolean =>
  !isForbidden(error) && count < 2;

/** 송신 항목 설정 응답 — 항목들과 이 서버의 송신 켜짐(`ERP_SEND_ENABLED`). */
interface OutboundSettings {
  /** 서버 #849(장부 P-129) 이전 응답에는 없다 — 그때는 `null`(모름)이다. */
  sendEnabled: boolean | null;
  items: OutboundItem[];
}

/**
 * 송신 항목 목록과 송신 켜짐을 한 번에 받는다 — 목록 구획과 탭 막대 칩이 같은 조회를 나눠 쓴다(`select` 로 갈라 읽는다).
 * 조회 조건이 없는 지금 상태라 조회 키도 하나다.
 */
const useOutboundSettings = <T>(
  select: (settings: OutboundSettings) => T,
  enabled = true,
): UseQueryResult<T> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: erpOutboundKeys.items,
    enabled,
    /* 건수가 실려 온다 — 송신기가 보낸 건이 빠지는 것이 보이게 목록과 같이 다시 읽는다. */
    refetchInterval: REFRESH_MS,
    /* W-06-12 권한이 없으면(연동 현황·이력의 칩) 403 — 되풀이해 부르지 않는다. */
    retry: retryUnlessForbidden,
    queryFn: async (): Promise<OutboundSettings> => {
      /* `sendEnabled` 는 계약 사본에 아직 없다(서버 #849) — 계약에 실리면 이 넓힘을 걷는다. */
      const data: { sendEnabled?: boolean; items: OutboundItemSettingRow[] } = await runRequest(
        () => client.GET('/integration/outbound-item-settings'),
      );

      return {
        sendEnabled: typeof data.sendEnabled === 'boolean' ? data.sendEnabled : null,
        items: data.items.map(toOutboundItem),
      };
    },
    select,
  });
};

const selectItems = (settings: OutboundSettings): OutboundItem[] => settings.items;
const selectSendEnabled = (settings: OutboundSettings): boolean | null => settings.sendEnabled;

export const useOutboundItems = (): UseQueryResult<OutboundItem[]> =>
  useOutboundSettings(selectItems);

/** 이 서버에서 ERP 송신이 켜져 있는가 — 모르면(옛 서버 · 아직 못 받음 · 권한 없음) `null`. */
export const useSendEnabled = (enabled = true): boolean | null =>
  useOutboundSettings(selectSendEnabled, enabled).data ?? null;

export interface OutboundCounts {
  /** 그 송신 인터페이스 · 상태의 건수. 받지 못했으면 `undefined`. */
  of: (interfaceCode: string, status: CountedStatus) => number | undefined;
  /** 송신 항목 전체의 합(짝 있는 항목만). 받지 못했으면 `undefined`. */
  total: (status: CountedStatus) => number | undefined;
  error: Error | null;
}

/**
 * 송신 항목별 · 전체 대기 · 실패 건수 — 송신 항목 설정에 실려 온다(서버 #849 · 장부 P-129, 대기는 PENDING 만 센다).
 * 받지 못했으면(권한 없음 포함) `undefined` — 0 으로 보이면 보낼 것이 없는 줄 안다.
 */
export const useOutboundCounts = (enabled = true): OutboundCounts => {
  const settings = useOutboundSettings(selectItems, enabled);
  const items = settings.data;

  const countOf = (item: OutboundItem, status: CountedStatus): number =>
    status === MESSAGE_STATUS.pending ? item.pendingCount : item.failedCount;

  const of = (interfaceCode: string, status: CountedStatus): number | undefined => {
    const item = items?.find((candidate) => candidate.interfaceCode === interfaceCode);
    return item === undefined ? undefined : countOf(item, status);
  };

  const total = (status: CountedStatus): number | undefined =>
    items
      ?.filter((item) => item.interfaceCode !== null)
      .reduce((sum, item) => sum + countOf(item, status), 0);

  return { of, total, error: settings.error };
};

/** 연계 메시지 목록의 조회 조건(계약 사본 그대로). */
type MessageListQuery = NonNullable<paths['/integration/messages']['get']['parameters']['query']>;

/** 고른 송신 항목의 송신 예정 목록. 짝이 없는 항목(반품 · 실사 조정)은 부르지 않는다. */
export const usePendingMessages = (
  interfaceCode: string | null,
  page: number,
  /** 생성일 조건. 없으면 기간 없이(전체) — 「아직 보내지 않은 것」은 기간과 상관없다. */
  period: PeriodQuery | null = null,
): UseQueryResult<MessageListResult> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: erpOutboundKeys.pending(interfaceCode, page, period),
    enabled: interfaceCode !== null,
    refetchInterval: REFRESH_MS,
    retry: retryUnlessForbidden,
    queryFn: () => {
      if (interfaceCode === null) {
        throw new Error('송신 인터페이스가 없는 항목은 목록을 조회하지 않습니다.');
      }

      /*
       * 대기(PENDING)는 기간 없이 부를 수 있다(서버 #849 · 장부 P-129) — 생성일 조건이 있을 때만 싣는다. 계약 사본은
       * 아직 기간을 필수로 적어 타입을 넓혀 넘긴다. 계약이 바뀌면 이 넓힘을 걷는다.
       */
      const query = {
        ...(period ?? {}),
        directionCode: OUTBOUND_DIRECTION,
        statusCode: MESSAGE_STATUS.pending,
        interfaceCode,
        ...(page > 1 ? { page } : {}),
        size: PENDING_PAGE_SIZE,
      } as MessageListQuery;

      return runRequest(() => client.GET('/integration/messages', { params: { query } }));
    },
  });
};
