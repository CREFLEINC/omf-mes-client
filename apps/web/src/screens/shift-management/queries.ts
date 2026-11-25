import type { components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { fetchAllPages } from '../../patterns/fetch-all-pages';
import { useMasterWrite, type MasterWriteResult } from '../../patterns/master';
import { runRequest } from '../../patterns/request';

export type Shift = components['schemas']['Shift'];
type ShiftCreate = components['schemas']['ShiftCreate'];
type ShiftUpdate = components['schemas']['ShiftUpdate'];
type ShiftDetailResponse = components['schemas']['ShiftDetailResponse'];
type Plant = components['schemas']['Plant'];
type SessionScope = components['schemas']['SessionScope'];

export const shiftKeys = {
  all: ['shift-management'] as const,
  plants: ['shift-management', 'plants'] as const,
  list: (plantId: number) => ['shift-management', 'list', plantId] as const,
  detail: (shiftId: number) => ['shift-management', 'detail', shiftId] as const,
};

/** 잠금 토큰(ETag)은 상세 경로에 보관된다 — 수정·중지가 이 경로로 꺼낸다. */
export const shiftDetailPath = (shiftId: number): string => `/mdm/shifts/${String(shiftId)}`;

/** 데이터 범위 안인가 — 줄에 공장이 있으면 그 공장, 없으면 그 사업부의 공장 모두, 줄이 없으면 전체. */
const inDataScope = (plant: Plant, scopes: readonly SessionScope[]): boolean =>
  scopes.length === 0 ||
  scopes.some((scope) =>
    scope.plantId !== undefined
      ? scope.plantId === plant.plantId
      : scope.businessUnitId === plant.businessUnitId,
  );

/** 세션 데이터 범위 안의 사용 중인 공장(공장 코드 차례). 교대는 공장마다 따로 둔다. */
export const usePlants = (scopes: readonly SessionScope[]): UseQueryResult<Plant[]> => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: shiftKeys.plants,
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

/**
 * 공장의 교대 — 사용 중지한 것까지(기존 조회 API `includeInactive` · 시작 시각 차례). 사용 유무 라벨이 화면에서 거른다.
 * `'all'` 이면 공장 조건 없이 모두 받는다(공장이 지정되지 않은 계정 · 화면이 볼 수 있는 공장으로 다시 거른다).
 */
export const useShifts = (plantId: number | 'all' | null): UseQueryResult<Shift[]> => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: shiftKeys.list(plantId === 'all' ? 0 : (plantId ?? -1)),
    enabled: plantId !== null,
    queryFn: async () =>
      (
        await fetchAllPages((page, size) =>
          runRequest(() =>
            client.GET('/mdm/shifts', {
              params: {
                query: {
                  ...(typeof plantId === 'number' ? { plantId } : {}),
                  includeInactive: true,
                  page,
                  size,
                },
              },
            }),
          ),
        )
      ).items,
    select: (shifts) =>
      [...shifts].sort(
        (left, right) =>
          left.plantId - right.plantId ||
          left.startTime.localeCompare(right.startTime) ||
          left.shiftCode.localeCompare(right.shiftCode),
      ),
  });
};

/**
 * 수정 창을 열 때 — 잠금 토큰과 코드 수정 가부를 받는다.
 * 창을 열 때마다 새로 받는다(남겨 두지 않음) — 남긴 값을 쓰면 그 사이 누가 고친 내용을 못 보고 저장이 충돌한다.
 */
export const useShiftDetail = (shiftId: number | null): UseQueryResult<ShiftDetailResponse> => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: shiftKeys.detail(shiftId ?? 0),
    enabled: shiftId !== null,
    staleTime: 0,
    gcTime: 0,
    queryFn: () =>
      runRequest(() =>
        client.GET('/mdm/shifts/{shiftId}', { params: { path: { shiftId: shiftId ?? 0 } } }),
      ),
  });
};

export type ShiftSave =
  { mode: 'create'; body: ShiftCreate } | { mode: 'update'; shiftId: number; body: ShiftUpdate };

export const SHIFT_FORM_FIELDS = ['shiftCode', 'shiftName', 'startTime', 'endTime'] as const;

/** 교대 추가 · 수정. 수정은 상세의 ETag 로 잠근다(409 저장 충돌). */
export const useSaveShift = (
  editingId: number | null,
  onSuccess: () => void,
): MasterWriteResult<ShiftSave> => {
  const { client } = useApiClient();
  return useMasterWrite<ShiftSave, Shift>({
    request: (save, headers) =>
      save.mode === 'create'
        ? client.POST('/mdm/shifts', {
            params: { header: { 'Idempotency-Key': headers['Idempotency-Key'] } },
            body: save.body,
          })
        : client.PUT('/mdm/shifts/{shiftId}', {
            params: {
              path: { shiftId: save.shiftId },
              header: {
                'Idempotency-Key': headers['Idempotency-Key'],
                'If-Match': headers['If-Match'] ?? '',
              },
            },
            body: save.body,
          }),
    etagPath: editingId === null ? null : shiftDetailPath(editingId),
    invalidateKeys: [shiftKeys.all],
    knownFields: SHIFT_FORM_FIELDS,
    onSuccess,
  });
};

/** 교대 사용 중지(`off`) · 재사용(`on`) — 본문이 빈 액션이라 멱등 키 수명은 기본값(`per-attempt`)이다. */
export const useToggleShift = (
  shiftId: number | null,
  to: 'on' | 'off',
  onSuccess: () => void,
): MasterWriteResult<void> => {
  const { client } = useApiClient();
  return useMasterWrite<void, Shift>({
    request: (_variables, headers) => {
      const params = {
        path: { shiftId: shiftId ?? 0 },
        header: {
          'Idempotency-Key': headers['Idempotency-Key'],
          'If-Match': headers['If-Match'] ?? '',
        },
      };
      return to === 'off'
        ? client.POST('/mdm/shifts/{shiftId}:deactivate', { params })
        : client.POST('/mdm/shifts/{shiftId}:activate', { params });
    },
    etagPath: shiftId === null ? null : shiftDetailPath(shiftId),
    invalidateKeys: [shiftKeys.all],
    knownFields: [],
    onSuccess,
  });
};
