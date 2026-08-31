import type { ApiClient, components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { requireIfMatch, useMasterWrite, type MasterWriteResult } from '../../patterns/master';
import { runRequest } from '../../patterns/request';
import { toToolResultView, type ToolResultListResult } from './types';

/**
 * 이 화면의 오퍼레이션 — 실적 목록 하나, 툴 상세 하나, 쓰기 하나.
 *
 * ⭐ **툴 상세를 부르는 이유는 잠금 토큰 때문이다.** 계약이 `resetCounter=true`일 때
 * `If-Match`를 **필수**로 두었고 그 값은 **대상 툴의 상세 조회 200이 내려주는 ETag**다.
 * 상세를 부르지 않으면 리셋을 보낼 수 없다 — 토큰 없이 보내면 서버가 422로 거부한다.
 *
 * ⛔ **툴 마스터를 고치는 경로를 부르지 않는다.** 누계를 되돌리는 것은 서버의 일이고 화면은
 * 「되돌린다」는 뜻만 보낸다.
 *
 * ⛔ **사용실적 입력 경로를 부르지 않는다.** 그것은 **더하기**이고 현장 단말의 몫이다 —
 * 여기서 함께 다루면 잠금이 필요한 쓰기와 아닌 쓰기가 한 폼에 섞인다.
 *
 * 경로 리터럴은 이 파일에만 둔다 — `openapi-fetch`가 경로를 리터럴 타입으로 요구해 문자열
 * 변수로 넘기면 타입 검사가 풀린다.
 */

type Client = ApiClient['client'];
type Mold = components['schemas']['Mold'];
type MaintenanceResult = components['schemas']['MaintenanceResult'];
type MaintenanceResultCreate = components['schemas']['MaintenanceResultCreate'];

export const toolResultKeys = {
  all: ['tool-pm-result'] as const,
  results: (moldId: number | null, page: number) =>
    ['tool-pm-result', 'results', moldId ?? 0, page] as const,
  tool: (moldId: number | null) => ['tool-pm-result', 'tool', moldId ?? 0] as const,
};

/** 툴 상세 경로. **잠금 토큰이 이 경로에 보관된다** — 실적 경로로 꺼내면 늘 비어 있다. */
export const moldDetailPath = (moldId: number): string => `/mdm/molds/${String(moldId)}`;

/**
 * 고른 툴의 상세.
 *
 * ⭐ **누계와 적정타수를 보여 주려고 부르는 것이자, 잠금 토큰을 확보하려고 부르는 것이다.**
 * 둘이 같은 요청인 것은 우연이 아니다 — 되돌리기는 「지금 누계」를 바꾸는 일이라, 사람이 본
 * 값과 서버가 바꿀 값이 같아야 한다.
 */
export const useToolDetail = (moldId: number | null): UseQueryResult<Mold> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: toolResultKeys.tool(moldId),
    enabled: moldId !== null,
    queryFn: () => {
      if (moldId === null) {
        throw new Error('툴을 고르기 전에는 상세를 조회하지 않습니다.');
      }

      /* 상세 응답은 툴 · 편집 가능 여부 · 라벨 발행 수를 함께 준다. 이 화면은 툴만 쓴다. */
      return runRequest(() =>
        client.GET('/mdm/molds/{moldId}', { params: { path: { moldId } } }),
      ).then((data) => data.mold);
    },
  });
};

/** 한 쪽에 담는 실적 수. 예방보전 이력은 한 툴에 여러 해가 쌓인다. */
export const PAGE_SIZE = 20;

/**
 * 고른 툴의 실적 목록.
 *
 * ⭐ **쪽을 보낸다.** 보내지 않으면 서버가 첫 쪽만 주고 화면은 그 사실을 모른 채 「이게
 * 전부」로 그린다 — 되돌린 이력이 여기서 잘리면 언제 무엇을 되돌렸는지 되짚을 수 없다.
 */
export const useToolResults = (
  moldId: number | null,
  page: number,
): UseQueryResult<ToolResultListResult> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: toolResultKeys.results(moldId, page),
    enabled: moldId !== null,
    queryFn: () => {
      if (moldId === null) {
        throw new Error('툴을 고르기 전에는 실적을 조회하지 않습니다.');
      }

      return runRequest(() =>
        client.GET('/maintenance/results', {
          params: {
            query: { targetTypeCode: 'MOLD', targetId: moldId, page, size: PAGE_SIZE },
          },
        }),
      ).then((data) => ({
        items: data.items.map(toToolResultView),
        page: data.page ?? { page, size: PAGE_SIZE, total: data.items.length },
      }));
    },
  });
};

/** 화면이 소유한 입력칸 이름 — 오류를 그릴 자리가 있는 것만 넣는다. */
const KNOWN_FIELDS = [
  'targetId',
  'startedAt',
  'finishedAt',
  'resultNote',
  'performedByUserId',
  'outsourceVendorName',
  'shotCountAfterReset',
] as const;

/**
 * 실적 등록.
 *
 * ⭐ **되돌리기를 켠 저장에는 잠금 토큰이 실린다.** 계약이 그때만 `If-Match`를 필수로 두었고,
 * 되돌리기는 **바꾸기**라 저장하는 사이 누계가 달라졌으면 거부되어야 한다.
 *
 * ⚠ **끈 저장에도 토큰을 싣는다.** 계약이 그 헤더를 선택으로 두어 실어도 무방하고, 실으면
 * 「내가 본 값 위에 적는다」가 두 갈래 모두에서 참이 된다 — 갈래를 나누면 언젠가 한쪽만
 * 고쳐진다. ⛔ **사용실적 입력(더하기)에는 이 보호를 걸지 않는다** — 그쪽은 여러 단말이
 * 동시에 기여하므로 잠그면 현장이 멎는다. 그 경로는 이 화면에 없다.
 *
 * ⭐ 멱등 키 수명이 **`until-applied`**다. 누계를 바꾸는 쓰기라 통신이 끊긴 뒤 다시 눌렀을 때
 * **두 번 되돌아가는 것**을 막아야 한다.
 */
export const useToolResultCreate = (
  moldId: number | null,
  onSuccess: () => void,
): MasterWriteResult<MaintenanceResultCreate> => {
  const { client } = useApiClient();

  return useMasterWrite<MaintenanceResultCreate, MaintenanceResult>({
    request: (body, headers) =>
      client.POST('/maintenance/results', {
        params: {
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'If-Match': requireIfMatch(headers),
          },
        },
        body,
      }),
    etagPath: moldId === null ? null : moldDetailPath(moldId),
    invalidateKeys: [toolResultKeys.all],
    knownFields: KNOWN_FIELDS,
    keyLifetime: 'until-applied',
    onSuccess,
  });
};
