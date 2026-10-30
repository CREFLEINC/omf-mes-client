import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { requireIfMatch, useMasterWrite, type MasterWriteResult } from '../../patterns/master';
import { runRequest } from '../../patterns/request';
import type {
  HandoverAlertSetting,
  HandoverAlertSettingReplace,
  Plant,
  SettingSummary,
} from './types';

/**
 * 한 행의 상세 경로. **경로형이다** — ETag 보관소가 경로만 키로 쓰므로 공장·종류를 질의에 두면
 * 모든 행이 같은 ETag 칸을 나눠 쓴다(W-CO-11 과 같다).
 */
export const settingPath = (plantId: number, alertTypeCode: string): string =>
  `/app/handover-alert-settings/${String(plantId)}/${encodeURIComponent(alertTypeCode)}`;

export const handoverSettingKeys = {
  all: ['handover-alert-settings'] as const,
  plants: ['handover-alert-settings', 'plants'] as const,
  summary: (plantId: number | null) =>
    ['handover-alert-settings', 'summary', plantId ?? 0] as const,
  detail: (plantId: number | null, alertTypeCode: string | null) =>
    ['handover-alert-settings', 'detail', plantId ?? 0, alertTypeCode ?? ''] as const,
};

/** 세션의 데이터 범위 한 줄 — 계약 `SessionScope`. */
export interface DataScope {
  businessUnitId: number;
  plantId?: number;
}

/**
 * 데이터 범위 안인가. 규칙은 서버(P-62)와 같다 — 줄에 공장이 있으면 그 공장, 없으면 그 사업부의
 * 공장 모두, 줄이 없으면 전체. 범위 밖 공장은 서버가 403 으로 막으므로 고를 수 없게 감춘다.
 */
export const inDataScope = (plant: Plant, scopes: readonly DataScope[]): boolean =>
  scopes.length === 0 ||
  scopes.some((scope) =>
    scope.plantId !== undefined
      ? scope.plantId === plant.plantId
      : scope.businessUnitId === plant.businessUnitId,
  );

/** 사용 중이고 데이터 범위 안인 공장. */
export const usePlants = (scopes: readonly DataScope[]): UseQueryResult<Plant[]> => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: handoverSettingKeys.plants,
    queryFn: async () =>
      (await runRequest(() => client.GET('/mdm/plants', { params: { query: {} } }))).items,
    select: (plants) => plants.filter((plant) => plant.isActive && inDataScope(plant, scopes)),
  });
};

export const useSettingSummary = (plantId: number | null): UseQueryResult<SettingSummary> => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: handoverSettingKeys.summary(plantId),
    enabled: plantId !== null,
    queryFn: () =>
      runRequest(() =>
        client.GET('/app/handover-alert-settings', {
          params: { query: { plantId: plantId ?? 0 } },
        }),
      ),
  });
};

export const useSettingDetail = (
  plantId: number | null,
  alertTypeCode: string | null,
): UseQueryResult<HandoverAlertSetting> => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: handoverSettingKeys.detail(plantId, alertTypeCode),
    enabled: plantId !== null && alertTypeCode !== null,
    queryFn: () =>
      runRequest(() =>
        client.GET('/app/handover-alert-settings/{plantId}/{alertTypeCode}', {
          params: { path: { plantId: plantId ?? 0, alertTypeCode: alertTypeCode ?? '' } },
        }),
      ),
  });
};

/**
 * 저장. ⭐ **행이 아직 없으면 If-Match 를 싣지 않는다**(계약 §A) — 상세가 ETag 를 주지 않았으면
 * 잠금 없이 보내고, 준 뒤에는 늘 싣는다.
 */
export const useReplaceSetting = (
  plantId: number | null,
  alertTypeCode: string | null,
  onSuccess: (data: HandoverAlertSetting) => void,
): MasterWriteResult<HandoverAlertSettingReplace> => {
  const { client, etags } = useApiClient();
  const path =
    plantId === null || alertTypeCode === null ? null : settingPath(plantId, alertTypeCode);
  const locked = path !== null && etags.ifMatch(path) !== undefined;

  return useMasterWrite({
    request: (body, headers) =>
      client.PUT('/app/handover-alert-settings/{plantId}/{alertTypeCode}', {
        params: {
          path: { plantId: plantId ?? 0, alertTypeCode: alertTypeCode ?? '' },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            ...(locked ? { 'If-Match': requireIfMatch(headers) } : {}),
          },
        },
        body,
      }),
    etagPath: locked ? path : null,
    invalidateKeys: [handoverSettingKeys.summary(plantId)],
    knownFields: [],
    onSuccess,
  });
};
