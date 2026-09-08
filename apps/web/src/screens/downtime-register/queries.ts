import type { ApiClient } from '@omf-mes/api-client';
import { useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import {
  isOngoing,
  toBreakdownView,
  toDowntimeView,
  type BreakdownView,
  type DowntimeView,
} from './types';

/**
 * 이 화면의 읽기 넷.
 *
 * | 구획 | 호출 | 기간 |
 * | --- | --- | --- |
 * | ① 진행 중 | 비가동 목록 · `openOnly` | ⛔ **걸지 않는다** — 전날부터 이어진 구간을 놓친다 |
 * | ④ 오늘 목록 | 비가동 목록 | 오늘 하루 |
 * | ④ 오늘 합계 | 비가동 집계 | 오늘 하루 — **기간 필수**(공유계약 L-3) |
 * | ③ 고장 후보 | 고장 목록 · `openOnly` | 걸지 않는다 |
 *
 * 경로 리터럴은 이 파일에만 둔다 — `openapi-fetch`가 경로를 리터럴 타입으로 요구해 문자열
 * 변수로 넘기면 타입 검사가 풀린다.
 *
 * ⚠ **오프라인이면 ④를 부르지 않는다**(스펙 §6-2). 여러 단말이 함께 채우는 합계라 이 단말이
 * 아는 것만으로 다시 계산하면 **틀린 숫자를 맞는 것처럼** 보이게 된다. 화면은 그 자리를
 * 「내 단말 입력분만」으로 바꿔 범위를 밝힌다.
 */

type Client = ApiClient['client'];

export const downtimeRegisterKeys = {
  all: ['downtime-register'] as const,
  ongoing: (equipmentId: number) => ['downtime-register', 'ongoing', equipmentId] as const,
  today: (equipmentId: number, day: string) =>
    ['downtime-register', 'today', equipmentId, day] as const,
  todaySummary: (equipmentId: number, day: string) =>
    ['downtime-register', 'today-summary', equipmentId, day] as const,
  openBreakdowns: (equipmentId: number) =>
    ['downtime-register', 'open-breakdowns', equipmentId] as const,
  reasonOptions: ['downtime-register', 'reason-options'] as const,
};

/**
 * 사유 코드 그룹 — **이름으로 가리킨다.**
 *
 * ⛔ 채번 식별자(`codeGroupId`)를 박지 않는다 — 환경마다 다르다(계약 주). 이름은 고객의
 * 코드 마스터에 등재된 그룹 코드이고 이 화면이 그룹을 안정적으로 가리킬 유일한 수단이다.
 */
const DOWNTIME_REASON_GROUP_CODE = 'DOWNTIME_REASON';

/** 한 번에 받아 오는 값 수. 고객이 늘리는 목록이라(G-31) 넉넉히 받아 화면에서 자르지 않는다. */
const REASON_OPTION_SIZE = 100;

const pad = (value: number, length: number): string => String(value).padStart(length, '0');

/** 오늘 하루를 가리키는 날짜 글자(`yyyy-mm-dd`). **단말이 선 날**이다. */
export const toLocalDay = (at: Date): string =>
  `${String(at.getFullYear())}-${pad(at.getMonth() + 1, 2)}-${pad(at.getDate(), 2)}`;

const fetchOngoing = async (client: Client, equipmentId: number): Promise<DowntimeView[]> => {
  const data = await runRequest(() =>
    client.GET('/maintenance/downtimes', {
      /*
       * ⛔ **기간을 걸지 않는다.** 어제 시작해 아직 안 끝난 구간이 이 화면의 첫 구획에
       * 서야 하는데, 오늘로 자르면 그 구간이 사라지고 작업자는 새 비가동을 시작한다.
       * 계약도 이 호출만 기간을 면제한다.
       */
      params: { query: { equipmentId, openOnly: true } },
    }),
  );

  /*
   * ⚠ **받은 것을 한 번 더 거른다.** 「끝나지 않은 것만」으로 물었지만 끝난 구간이 섞여 오면
   * 화면이 **자기 목록과 모순되는 말**을 한다 — 위에서는 「진행 중」이라 하고 아래 오늘 목록에는
   * 같은 건이 끝난 구간으로 선다. 그 상태에서 「지금 종료」는 이미 닫힌 구간을 닫으려 든다.
   *
   * 진행 중인지는 **끝 시각의 부재**로 판정할 수 있으므로 화면이 스스로 확인할 수 있다 —
   * 확인할 수 있는 것을 믿고 넘기지 않는다.
   *
   * ⚠ 목 서버에서 이 모습을 봤지만 그것은 **목이 질의를 무시하고 예시를 돌려주기 때문**일 수
   * 있다. 이 방어의 근거는 「서버가 틀린다」가 아니라 **「화면이 두 자리에서 같은 건을 다르게
   * 말하면 안 된다」**이다 — 위에서는 진행 중이라 하고 아래 오늘 목록에서는 끝난 구간으로 서는
   * 모습은 어느 쪽이 원인이든 화면의 잘못이다.
   */
  return data.items.map(toDowntimeView).filter(isOngoing);
};

const fetchToday = async (
  client: Client,
  equipmentId: number,
  day: string,
): Promise<DowntimeView[]> => {
  const data = await runRequest(() =>
    client.GET('/maintenance/downtimes', {
      params: { query: { equipmentId, startedFrom: day, startedTo: day } },
    }),
  );

  return data.items.map(toDowntimeView);
};

const fetchTodayMinutes = async (
  client: Client,
  equipmentId: number,
  day: string,
): Promise<number> => {
  const data = await runRequest(() =>
    client.GET('/maintenance/downtimes/summary', {
      /* 기간은 **필수**다 — 빼면 서버가 거부한다. */
      params: { query: { equipmentId, startedFrom: day, startedTo: day } },
    }),
  );

  return data.actualDowntimeMinutes;
};

const fetchOpenBreakdowns = async (
  client: Client,
  equipmentId: number,
): Promise<BreakdownView[]> => {
  const data = await runRequest(() =>
    client.GET('/maintenance/breakdowns', {
      params: { query: { equipmentId, openOnly: true } },
    }),
  );

  return data.items.map(toBreakdownView);
};

export interface OngoingResult {
  /**
   * 진행 중 구간. **여럿이면 가장 먼저 시작한 것**을 보인다 — 저장 측이 겹침을 막지 않아
   * 둘 이상일 수 있고, 그중 하나를 고르는 근거가 필요하다. 오래 열려 있는 것이 먼저 닫혀야
   * 할 것이다.
   */
  downtime: DowntimeView | null;
  isPending: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
}

export const useOngoingDowntime = (equipmentId: number | null): OngoingResult => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: downtimeRegisterKeys.ongoing(equipmentId ?? 0),
    enabled: equipmentId !== null,
    queryFn: () => {
      if (equipmentId === null) {
        throw new Error('설비를 모르면 진행 중 비가동을 조회하지 않습니다.');
      }

      return fetchOngoing(client, equipmentId);
    },
  });

  const earliest = [...(query.data ?? [])].sort((left, right) =>
    left.startedAt.localeCompare(right.startedAt),
  )[0];

  return {
    downtime: earliest ?? null,
    isPending: equipmentId !== null && query.isPending,
    isError: query.isError,
    error: query.error,
    refetch: () => {
      void query.refetch();
    },
  };
};

export interface TodayResult {
  downtimes: DowntimeView[];
  /**
   * 서버가 낸 오늘 합계(분). 부르지 않았거나 실패했으면 `null`이다.
   *
   * ⛔ **화면이 대신 더하지 않는다**(공유계약 L-2). 겹친 구간을 한 번만 세는 규칙이 서버에
   * 있고, 화면이 단순히 더하면 겹친 만큼 부풀어 오른다.
   */
  totalMinutes: number | null;
  isPending: boolean;
  /**
   * 조회를 걸었는가. 설비가 없거나 끊겼으면 걸지 않는다 — 그때의 빈 목록은 「없다」가 아니라
   * 「모른다」다. `isPending` 은 «꺼 둔» 조회에 대해 거짓이라 이 사실을 대신 말하지 못한다.
   */
  isAsked: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
}

/**
 * ④ 오늘 이 설비.
 *
 * `enabled`가 연결 상태를 함께 본다 — 끊긴 동안 조회를 던지면 실패 배너가 뜨는데, 그것은
 * 오류가 아니라 **예정된 상태**다(오프라인 허용 · 스펙 §6-2). 화면은 그 자리를 범위 안내로
 * 바꿔 그린다.
 */
export const useTodayDowntimes = (
  equipmentId: number | null,
  day: string,
  isOnline: boolean,
): TodayResult => {
  const { client } = useApiClient();

  const enabled = equipmentId !== null && isOnline;

  const list = useQuery({
    queryKey: downtimeRegisterKeys.today(equipmentId ?? 0, day),
    enabled,
    queryFn: () => {
      if (equipmentId === null) {
        throw new Error('설비를 모르면 오늘 비가동을 조회하지 않습니다.');
      }

      return fetchToday(client, equipmentId, day);
    },
  });

  const summary = useQuery({
    queryKey: downtimeRegisterKeys.todaySummary(equipmentId ?? 0, day),
    enabled,
    queryFn: () => {
      if (equipmentId === null) {
        throw new Error('설비를 모르면 오늘 집계를 조회하지 않습니다.');
      }

      return fetchTodayMinutes(client, equipmentId, day);
    },
  });

  return {
    downtimes: list.data ?? [],
    totalMinutes: summary.data ?? null,
    isPending: enabled && (list.isPending || summary.isPending),
    /*
     * **조회를 걸었는가.** 설비가 없거나 끊겼으면 걸지 않는다 — 그때 빈 목록은 「없다」가
     * 아니라 「모른다」다. 화면이 그 둘을 다르게 그리려면 이 사실을 알아야 하고,
     * `isPending` 은 «꺼 둔» 조회에 대해 거짓이라 대신 쓸 수 없다.
     */
    isAsked: enabled,
    /*
     * 목록이 실패하면 실패다. **집계만 실패한 것은 실패로 내지 않는다** — 줄은 보이는데
     * 합계 한 자리를 못 채운 것이라, 목록까지 감추면 있는 기록이 없는 것으로 보인다.
     */
    isError: list.isError,
    error: list.error,
    refetch: () => {
      void list.refetch();
      void summary.refetch();
    },
  };
};

export interface OpenBreakdownsResult {
  breakdowns: BreakdownView[];
  isError: boolean;
}

/**
 * ③ 연결 후보 — 이 설비의 열린 고장.
 *
 * ⚠ **실패해도 저장을 막지 않는다.** 고장 연결은 선택이고(스펙 §5-4), 후보를 못 읽은 것이
 * 비가동을 기록하지 못할 이유가 되면 정작 설비가 멈춘 순간에 아무것도 남기지 못한다.
 */
export const useOpenBreakdowns = (
  equipmentId: number | null,
  isOnline: boolean,
): OpenBreakdownsResult => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: downtimeRegisterKeys.openBreakdowns(equipmentId ?? 0),
    enabled: equipmentId !== null && isOnline,
    queryFn: () => {
      if (equipmentId === null) {
        throw new Error('설비를 모르면 열린 고장을 조회하지 않습니다.');
      }

      return fetchOpenBreakdowns(client, equipmentId);
    },
  });

  return { breakdowns: query.data ?? [], isError: query.isError };
};

export interface ReasonOption {
  code: string;
  name: string;
}

export interface ReasonOptionsResult {
  options: ReasonOption[];
  isPending: boolean;
  /**
   * 고를 것이 하나도 없다 — 조회가 실패했거나 값이 오지 않았다. **작업자가 할 일이 같으므로
   * 묶는다**(스펙 §6-1 —「필드를 감추지 않고 비활성 + 사유」).
   */
  isUnavailable: boolean;
}

/**
 * ③ 사유 선택지 — **고객의 공통코드 마스터에서 받는다**(스펙 §4-A · 공유계약 `G-32`).
 *
 * ⛔ **값 목록을 화면에 박지 않는다.** 박아 두면 고객이 사유를 늘린 날 그 사유로는 비가동을
 * 적을 수 없는데 화면은 멀쩡해 보인다 — 초기 여섯은 시드일 뿐이다(`G-31`).
 *
 * ⚠ **끊겼다고 부르기를 멈추지 않는다.** 스펙 §6-2 가 오프라인에 끄라고 한 것은 ④ 집계
 * 하나뿐이고, 이 목록은 W/O 선배포 때 내려와 있어야 하는 «선행 자료»다(C-11). 한 번 받아
 * 두었으면 조회가 실패해도 그 값이 남아 그대로 고를 수 있고, 한 번도 못 받았으면 §6-1 대로
 * 칸을 잠근다 — 스펙도 그 경우를 「오프라인에서 저장 자체가 불가」로 적었다.
 */
export const useReasonOptions = (): ReasonOptionsResult => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: downtimeRegisterKeys.reasonOptions,
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/mdm/code-values', {
          params: {
            query: {
              codeGroupCode: DOWNTIME_REASON_GROUP_CODE,
              size: REASON_OPTION_SIZE,
            },
          },
        }),
      );

      return data.items.map((item) => ({ code: item.code, name: item.codeName }));
    },
  });

  const options = query.data ?? [];

  return {
    options,
    isPending: query.isPending,
    isUnavailable: !query.isPending && options.length === 0,
  };
};
