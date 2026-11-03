import { createIdempotencyKey, type components } from '@omf-mes/api-client';
import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { fetchAllPages } from '../../patterns/fetch-all-pages';
import { useMasterWrite, type MasterWriteResult, type WriteHeaders } from '../../patterns/master';
import {
  ApiRequestError,
  runRequest,
  runRequestWithResponse,
  type ApiCallResult,
} from '../../patterns/request';
import {
  addDays,
  sameDayPolicy,
  todayIn,
  WORKING_DAYS_POLICY_CODE,
  type WeeklyWorkingDays,
} from './working-days';

type Plant = components['schemas']['Plant'];
type OperationPolicy = components['schemas']['OperationPolicy'];

export const plantWorkingDaysKeys = {
  all: ['plant-working-days'] as const,
  plants: ['plant-working-days', 'plants'] as const,
  policies: ['plant-working-days', 'policies'] as const,
};

/** 세션의 데이터 범위 한 줄 — 계약 `SessionScope`. */
export interface DataScope {
  businessUnitId: number;
  plantId?: number;
}

/** 데이터 범위 안인가 — 줄에 공장이 있으면 그 공장, 없으면 그 사업부의 공장 모두, 줄이 없으면 전체. */
export const inDataScope = (plant: Plant, scopes: readonly DataScope[]): boolean =>
  scopes.length === 0 ||
  scopes.some((scope) =>
    scope.plantId !== undefined
      ? scope.plantId === plant.plantId
      : scope.businessUnitId === plant.businessUnitId,
  );

/** 데이터 범위 안의 사용 중인 공장 전부(screens/W-CO-15.md 규칙 「공장 목록」). */
export const usePlants = (scopes: readonly DataScope[]): UseQueryResult<Plant[]> => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: plantWorkingDaysKeys.plants,
    queryFn: async () =>
      (
        await fetchAllPages((page, size) =>
          runRequest(() => client.GET('/mdm/plants', { params: { query: { page, size } } })),
        )
      ).items,
    select: (plants) =>
      plants
        .filter((plant) => plant.isActive && inDataScope(plant, scopes))
        .sort((left, right) => left.plantCode.localeCompare(right.plantCode)),
  });
};

/** 정책 행과, 고칠 수 있는 행(오늘 무렵 시작한 행)의 불러올 때 판 번호(ETag). */
export interface WorkingDayPolicies {
  items: OperationPolicy[];
  /**
   * 행 번호 → 불러올 때 받은 ETag. 저장은 **이 값**을 If-Match 로 싣는다 — 저장 직전에 다시 받으면
   * 화면을 연 뒤 남이 고친 것을 덮어써도 409 가 나지 않는다.
   */
  versions: ReadonlyMap<number, string>;
}

const policyPath = (operationPolicyId: number): string =>
  `/app/operation-policies/${String(operationPolicyId)}`;

/**
 * `WEEKLY_WORKING_DAYS` 행 전부(끝난 것 포함) — 공장마다 오늘 적용되는 행과 오늘 시작한 행을 화면이 고른다.
 * 오늘 무렵(공장 시간대 차이로 브라우저 어제부터) 시작한 행은 상세를 받아 판 번호를 함께 기억한다 —
 * 목록 행에는 판 번호가 없다.
 */
export const useWorkingDayPolicies = (): UseQueryResult<WorkingDayPolicies> => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: plantWorkingDaysKeys.policies,
    queryFn: async () => {
      const items = (
        await fetchAllPages((page, size) =>
          runRequest(() =>
            client.GET('/app/operation-policies', {
              params: { query: { policyCode: WORKING_DAYS_POLICY_CODE, page, size } },
            }),
          ),
        )
      ).items;
      const since = addDays(todayIn(undefined), -1);
      const versions = new Map<number, string>();
      for (const policy of items.filter((row) => row.effectiveFrom >= since)) {
        const { response } = await runRequestWithResponse(() =>
          client.GET('/app/operation-policies/{operationPolicyId}', {
            params: { path: { operationPolicyId: policy.operationPolicyId } },
          }),
        );
        const etag = response.headers.get('ETag');
        if (etag !== null) versions.set(policy.operationPolicyId, etag);
      }
      return { items, versions };
    },
  });
};

/** 화면을 연 뒤 남이 먼저 저장했다 — 다시 불러와야 풀린다. */
const staleConflict = (httpStatus?: number): ApiRequestError =>
  new ApiRequestError(
    { kind: 'conflict', cause: 'user', message: '' },
    httpStatus === undefined ? undefined : { httpStatus },
  );

/** 저장할 한 공장 — 그 공장 시간대의 오늘부터 적용한다. */
export interface WorkingDaysChange {
  plantId: number;
  days: WeeklyWorkingDays;
  today: string;
}

/**
 * 바뀐 공장만 「그날부터 적용」 행으로 저장한다(R-10). 오늘 시작한 행이 이미 있으면(같은 범위 · 같은
 * 시작일은 한 건) 그 행을 고치고, 없으면 새 행을 더한다. 앞 행은 건드리지 않는다 — 시작일이 늦은 행이
 * 이긴다. 공장 하나라도 실패하면 거기서 멈추고 그 실패를 낸다.
 */
export const useSaveWorkingDays = (
  policies: WorkingDayPolicies | undefined,
  onSuccess: () => void,
): MasterWriteResult<WorkingDaysChange[]> => {
  const { client } = useApiClient();
  const queryClient = useQueryClient();

  const saveOne = async (
    change: WorkingDaysChange,
    idempotencyKey: string,
  ): Promise<ApiCallResult<OperationPolicy>> => {
    const existing = sameDayPolicy(policies?.items ?? [], change.plantId, change.today);
    if (existing === undefined) {
      const created = await client.POST('/app/operation-policies', {
        params: { header: { 'Idempotency-Key': idempotencyKey } },
        body: {
          policyCode: WORKING_DAYS_POLICY_CODE,
          plantId: change.plantId,
          valueNumeric: change.days,
          effectiveFrom: change.today,
        },
      });
      /*
       * 같은 공장 · 같은 시작일은 유일 인덱스라 둘째 등록은 400 이다 — 화면을 연 뒤 남이 오늘 행을 먼저
       * 만들었다는 뜻이므로 충돌로 보고 다시 불러오게 한다(서버 S3 #947).
       */
      if (created.response.status === 400) throw staleConflict(400);
      return created;
    }

    /* 불러올 때 받은 판 번호가 없으면 잠글 수 없다 — 빈 If-Match 를 보내지 않고 다시 불러오게 한다. */
    const version = policies?.versions.get(existing.operationPolicyId);
    if (version === undefined) throw staleConflict();
    return client.PUT('/app/operation-policies/{operationPolicyId}', {
      params: {
        path: { operationPolicyId: existing.operationPolicyId },
        header: { 'Idempotency-Key': idempotencyKey, 'If-Match': version },
      },
      body: {
        valueNumeric: change.days,
        effectiveFrom: existing.effectiveFrom,
        effectiveTo: existing.effectiveTo ?? null,
      },
    });
  };

  return useMasterWrite<WorkingDaysChange[], OperationPolicy>({
    request: async (changes, headers: WriteHeaders) => {
      let last: ApiCallResult<OperationPolicy> | undefined;
      let saved = 0;
      let failed = true;
      try {
        for (const [index, change] of changes.entries()) {
          /* 공장마다 다른 쓰기라 키도 따로 둔다 — 같은 키를 다시 쓰면 서버가 앞 응답을 돌려준다. */
          last = await saveOne(
            change,
            index === 0 ? headers['Idempotency-Key'] : createIdempotencyKey(),
          );
          if (last.error !== undefined) return last;
          saved += 1;
        }
        if (last === undefined) throw new Error('바꾼 공장이 없으면 저장하지 않는다.');
        failed = false;
        return last;
      } finally {
        /* 중간 공장에서 멈춰도 앞서 저장된 공장은 다시 받아 보인다(성공이면 쓰기 훅이 무효화한다). */
        if (failed && saved > 0) {
          void queryClient.invalidateQueries({ queryKey: plantWorkingDaysKeys.policies });
        }
      }
    },
    etagPath: null,
    invalidateKeys: [plantWorkingDaysKeys.policies],
    knownFields: [],
    onSuccess,
  });
};
