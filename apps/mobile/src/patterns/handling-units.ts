import type { components } from '@omf-mes/api-client';
import { useQueries, useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from './api-context';
import { runRequest } from './request';

type Client = ReturnType<typeof useApiClient>['client'];

export type HandlingUnit = components['schemas']['HandlingUnit'];
export type HandlingUnitContent = components['schemas']['HandlingUnitContent'];

/** 스캔한 포장과 그 안에 든 것. 찾지 못하면 null 이며 조회 실패와는 다른 결과다. */
export interface ScannedHandlingUnit {
  handlingUnit: HandlingUnit;
  contents: HandlingUnitContent[];
}

export const handlingUnitKeys = {
  /** 이 뿌리를 걷으면 이 화면이 들고 있던 포장 조회가 전부 버려진다. */
  root: ['scanned-handling-unit'] as const,
  scanned: (code: string | null) => ['scanned-handling-unit', code] as const,
};

/**
 * 스캔값으로 포장을 찾는다.
 *
 * 이 경로에는 번호 정확 일치 축이 없어 부분 검색으로 묻고 화면이 고른다. 돌아온 줄을 다시
 * 확인하지 않으면 비슷한 번호의 다른 포장을 이 포장으로 읽는다.
 *
 * 쪽을 넉넉히 받는다. 목록이 쪽 단위라 일치 건이 뒷쪽에 있으면 못 찾는데, 못 찾은 것과 없는
 * 것이 화면에서 같아 보인다.
 */
const SEARCH_SIZE = 200;

const findHandlingUnit = async (
  client: Client,
  code: string,
): Promise<ScannedHandlingUnit | null> => {
  const found = await runRequest(() =>
    client.GET('/inventory/handling-units', { params: { query: { q: code, size: SEARCH_SIZE } } }),
  );

  const matched = found.items.find((unit) => unit.handlingUnitNo === code);

  if (matched === undefined) {
    return null;
  }

  /* 목록 응답에는 내용물이 없다. 무엇이 들었는지는 따로 묻는다. */
  const detail = await runRequest(() =>
    client.GET('/inventory/handling-units/{handlingUnitId}', {
      params: { path: { handlingUnitId: matched.handlingUnitId } },
    }),
  );

  return { handlingUnit: detail.handlingUnit, contents: detail.contents };
};

export const useScannedHandlingUnit = (
  code: string | null,
): UseQueryResult<ScannedHandlingUnit | null> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: handlingUnitKeys.scanned(code),
    enabled: code !== null,
    queryFn: () => {
      if (code === null) {
        throw new Error('스캔하기 전에는 포장을 조회하지 않습니다.');
      }

      return findHandlingUnit(client, code);
    },
  });
};

/**
 * 포장에 든 LOT 의 번호표.
 *
 * 구성 응답은 LOT 식별자만 준다. 그 번호를 그대로 보이면 작업자가 실물 라벨과 대조할 수
 * 없다 - 라벨에는 LOT 번호가 찍혀 있지 대리키가 찍혀 있지 않다.
 */
export const useLotLabels = (sources: ScannedHandlingUnit[]): Map<number, string> => {
  const { client } = useApiClient();
  const lotIds = [
    ...new Set(sources.flatMap((source) => source.contents.map((content) => content.lotId))),
  ];

  return useQueries({
    queries: lotIds.map((lotId) => ({
      queryKey: ['handling-unit-lot', lotId] as const,
      queryFn: async () => {
        const data = await runRequest(() =>
          client.GET('/trace/lots/{lotId}', { params: { path: { lotId } } }),
        );

        return [lotId, data.lot.lotNo] as const;
      },
    })),
    combine: (results) =>
      new Map(
        results
          .map((result) => result.data)
          .filter((pair): pair is readonly [number, string] => pair !== undefined),
      ),
  });
};
