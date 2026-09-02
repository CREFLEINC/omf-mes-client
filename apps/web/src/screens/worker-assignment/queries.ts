import type { ApiClient } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { WorkerResponse } from './verify';

/**
 * 이 화면이 부르는 요청 — **둘뿐이다**(요구서 §3-3 · 착수 통지 보완 2026-09-01).
 *
 * ```
 * GET /mdm/workers?workerNo=…&includeInactive=true   사번 확인
 * GET /mdm/workers?plantId=…                         오프라인용 목록 미리 받기 (§5-6 · C-11)
 * GET /mdm/terminals/{terminalId}                    단말 정보 표시
 * ```
 *
 * 앞의 둘은 **같은 오퍼레이션의 다른 축**이다 — 새 경로를 만들지 않았다.
 *
 * ⛔ **사번 확인 전용 경로를 만들지 않는다.** 이 화면은 인증이 아니라 귀속이라 작업자 조회로
 * 족하고, **세션을 만들면 설계가 뒤집힌다**(요구서 §3-3).
 *
 * ⭐ **읽기에는 사번이 필요 없다**(§5-4) — 단말 토큰만으로 기준정보를 읽는다.
 *
 * 경로 리터럴은 이 파일에만 둔다 — `openapi-fetch` 가 경로를 리터럴 타입으로 요구해
 * 문자열 변수로 넘기면 타입 검사가 풀린다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

type Client = ApiClient['client'];

const ALL_KEY = ['worker-assignment'] as const;

export const workerAssignmentKeys = {
  all: ALL_KEY,
  /** 사번이 곧 열쇠다 — 정확 일치 조회라 사번이 다르면 다른 결과다. */
  worker: (workerNo: string) => [...ALL_KEY, 'worker', workerNo] as const,
  terminal: (terminalId: number) => [...ALL_KEY, 'terminal', terminalId] as const,
  /** 공장별 목록. 공장이 다르면 다른 목록이다 — 한 열쇠로 묶으면 옆 공장 목록을 읽는다. */
  directory: (plantId: number) => [...ALL_KEY, 'directory', plantId] as const,
};

/** 미리 받아 두는 목록의 한 번 크기. 한 공장 재직 인원을 한 장에 담기 위한 값이다. */
const DIRECTORY_PAGE_SIZE = 500;

const fetchWorkers = (client: Client, workerNo: string): Promise<WorkerResponse[]> =>
  runRequest(() =>
    client.GET('/mdm/workers', {
      /*
       * ⭐ `includeInactive` 를 켠다 — 끄면 퇴사자가 «미등록»과 같은 모양(0건)으로 와서
       * 「등록되지 않은 사번입니다」라고 말하게 된다. 둘은 사용자가 할 일이 다르다.
       */
      params: { query: { workerNo: workerNo.trim(), includeInactive: true, page: 1, size: 2 } },
    }),
  ).then((response) => response.items);

/**
 * 사번을 확인한다. **누르기 전에는 부르지 않는다** — 치는 동안 매 글자마다 조회하면
 * 아직 다 치지도 않은 사번으로 「등록되지 않았다」가 뜬다.
 */
export const useWorkerLookup = (workerNo: string | null): UseQueryResult<WorkerResponse[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: workerAssignmentKeys.worker(workerNo ?? ''),
    queryFn: () => fetchWorkers(client, workerNo as string),
    enabled: workerNo !== null,
  });
};

const fetchDirectory = (client: Client, plantId: number): Promise<WorkerResponse[]> =>
  runRequest(() =>
    client.GET('/mdm/workers', {
      /*
       * ⭐ **재직자만 받는다**(§5-6 「해당 공장 재직 작업자 목록」). 오프라인에서 쓸 목록이라
       * 퇴사자까지 담으면 캐시가 커지기만 하고, 재직 여부는 **판정이 아니라 표시**여서
       * 판정값 캐시 금지(C-6)에 걸리지 않는다.
       */
      params: { query: { plantId, includeInactive: false, page: 1, size: DIRECTORY_PAGE_SIZE } },
    }),
  ).then((response) => response.items);

/**
 * 오프라인에서 쓸 작업자 목록을 **미리 받아 둔다**(§5-6 · C-11). 연결돼 있을 때만 돈다.
 *
 * ⚠ **공장을 모르면 부르지 않는다.** 「해당 공장」이 스펙의 조건인데 공장은 단말이 알려주고,
 * 단말 식별자를 줄 자리가 아직 없다(아래 `useTerminal`). ⛔ 공장 없이 전 공장을 받아 두지
 * 않는다 — 옆 공장 사번이 이 단말에서 통과한다.
 */
export const useWorkerDirectory = (
  plantId: number | null,
  isOnline: boolean,
): UseQueryResult<WorkerResponse[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: workerAssignmentKeys.directory(plantId ?? 0),
    queryFn: () => fetchDirectory(client, plantId as number),
    enabled: plantId !== null && isOnline,
  });
};

const fetchTerminal = (client: Client, terminalId: number) =>
  runRequest(() => client.GET('/mdm/terminals/{terminalId}', { params: { path: { terminalId } } }));

/**
 * 단말 한 건을 부른다 — 헤더의 단말 이름·설치 위치가 이 값이다(§5-8).
 *
 * ⚠ **단말 식별자를 줄 자리가 이 저장소에 아직 없다.** 셸이 여는 통로(`window.pop`)는
 * 단말 토큰·캐시·큐·출력물만 내주고 단말 식별자를 내주지 않는다. 그래서 지금은 언제나
 * 부르지 않으며, 통로가 생기면 **이 한 자리에 식별자를 넘기면 된다.**
 */
export const useTerminal = (terminalId: number | null) => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: workerAssignmentKeys.terminal(terminalId ?? 0),
    queryFn: () => fetchTerminal(client, terminalId as number),
    enabled: terminalId !== null,
  });
};
