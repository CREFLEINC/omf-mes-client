import { createIdempotencyKey, type components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { fetchAllPages } from '../../patterns/fetch-all-pages';
import { useMasterWrite, type MasterWriteResult, type WriteHeaders } from '../../patterns/master';
import { runRequest, type ApiCallResult } from '../../patterns/request';
import { sameDayPolicy, WORKING_DAYS_POLICY_CODE, type WeeklyWorkingDays } from './working-days';

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
      (await runRequest(() => client.GET('/mdm/plants', { params: { query: {} } }))).items,
    select: (plants) =>
      plants
        .filter((plant) => plant.isActive && inDataScope(plant, scopes))
        .sort((left, right) => left.plantCode.localeCompare(right.plantCode)),
  });
};

/** `WEEKLY_WORKING_DAYS` 행 전부(끝난 것 포함) — 공장마다 오늘 적용되는 행과 오늘 시작한 행을 화면이 고른다. */
export const useWorkingDayPolicies = (): UseQueryResult<OperationPolicy[]> => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: plantWorkingDaysKeys.policies,
    queryFn: async () =>
      (
        await fetchAllPages((page, size) =>
          runRequest(() =>
            client.GET('/app/operation-policies', {
              params: { query: { policyCode: WORKING_DAYS_POLICY_CODE, page, size } },
            }),
          ),
        )
      ).items,
  });
};

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
  policies: readonly OperationPolicy[],
  onSuccess: () => void,
): MasterWriteResult<WorkingDaysChange[]> => {
  const { client, etags } = useApiClient();

  const saveOne = async (
    change: WorkingDaysChange,
    idempotencyKey: string,
  ): Promise<ApiCallResult<OperationPolicy>> => {
    const existing = sameDayPolicy(policies, change.plantId, change.today);
    if (existing === undefined) {
      return client.POST('/app/operation-policies', {
        params: { header: { 'Idempotency-Key': idempotencyKey } },
        body: {
          policyCode: WORKING_DAYS_POLICY_CODE,
          plantId: change.plantId,
          valueNumeric: change.days,
          effectiveFrom: change.today,
        },
      });
    }

    /* 수정은 잠금 토큰이 필요하다 — 상세를 받아 ETag 를 확보한 뒤 고친다. */
    const path = { operationPolicyId: existing.operationPolicyId };
    const detail = await client.GET('/app/operation-policies/{operationPolicyId}', {
      params: { path },
    });
    if (detail.error !== undefined) return detail;
    return client.PUT('/app/operation-policies/{operationPolicyId}', {
      params: {
        path,
        header: {
          'Idempotency-Key': idempotencyKey,
          'If-Match':
            etags.ifMatch(`/app/operation-policies/${String(existing.operationPolicyId)}`) ?? '',
        },
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
      for (const [index, change] of changes.entries()) {
        /* 공장마다 다른 쓰기라 키도 따로 둔다 — 같은 키를 다시 쓰면 서버가 앞 응답을 돌려준다. */
        last = await saveOne(
          change,
          index === 0 ? headers['Idempotency-Key'] : createIdempotencyKey(),
        );
        if (last.error !== undefined) return last;
      }
      if (last === undefined) throw new Error('바꾼 공장이 없으면 저장하지 않는다.');
      return last;
    },
    etagPath: null,
    invalidateKeys: [plantWorkingDaysKeys.policies],
    knownFields: [],
    onSuccess,
  });
};
