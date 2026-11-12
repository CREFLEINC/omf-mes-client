import { createIdempotencyKey } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { runRequest, toApiError } from '../../patterns/request';
import type { BulkStep } from './bulk-create-plan';
import { locationDetailPath, locationKeys } from './queries';
import type { Location } from './types';

/** 실패 한 건 — 그 단계의 코드와 사유. 구역이 실패하면 그 구역의 랙도 같은 사유로 실패다. */
export interface BulkFailure {
  code: string;
  reason: string;
}

export type BulkRunState =
  | { status: 'idle' }
  | { status: 'running'; done: number; total: number }
  | { status: 'done' }
  | { status: 'partial'; failures: BulkFailure[]; failedRacks: number; created: number };

/** 실패 사유 한 줄 — 서버 문구가 있으면 그것을 쓴다(랙 추가 창과 같다). */
export const bulkFailureReason = (error: unknown): string => {
  const apiError = toApiError(error);
  switch (apiError.kind) {
    case 'validation':
    case 'stateLocked':
      return apiError.errors[0]?.message ?? messages.httpError.title;
    case 'conflict':
      return apiError.message === '' ? messages.httpError.title : apiError.message;
    case 'http':
      return apiError.message ?? messages.httpError.title;
    case 'network':
      return messages.warehouseLocation.bulkCreate.netFail;
  }
};

/** 한 단계가 만드는 위치 수 — 구역 1, 랙은 그 층 · 셀까지. */
const locationsOf = (step: BulkStep): number =>
  step.kind === 'zone' ? 1 : 1 + step.levelCount + step.levelCount * step.cellCountPerLevel;

/**
 * 일괄 생성 실행(#267 · 계약 §3 · R-1 ~ R-3). 단계를 하나씩 차례로 부른다 — 서버가 창고 단위로 잠가 함께 불러도 빠르지 않고
 * 코드 차례가 미리 보기와 어긋날 수 있다.
 *
 * - 끝낸 단계를 기억해 다시 누르면 남은 것만 부른다. 만든 구역의 id 는 그 구역의 랙이 쓴다(구역을 두 번 만들지 않는다).
 * - 랙이 실패해도 다음 단계로 간다. 구역이 실패하면 그 구역의 랙은 건너뛰고 실패로 센다.
 * - 이름은 코드와 같게 — 서버가 미리 지은 코드와 다른 번호를 붙이면(동시 생성) 이름을 그 코드로 고친다.
 * - 끝나면(일부 실패 포함) 위치 목록을 다시 읽는다.
 *
 * 기억은 받은 `steps` 배열 하나에 묶인다 — 다른 계획을 주면 처음부터다. 창을 닫으면 계획도 사라진다(R-3).
 */
export const useBulkCreate = (warehouseId: number) => {
  const { client, etags } = useApiClient();
  const queryClient = useQueryClient();
  const [state, setState] = useState<BulkRunState>({ status: 'idle' });
  const memory = useRef<{
    steps: readonly BulkStep[];
    done: Set<number>;
    zoneIds: Map<number, number>;
  } | null>(null);

  const renameToCode = useCallback(
    async (created: Location): Promise<void> => {
      if (created.locationName === created.locationCode) return;
      const detail = await runRequest(() =>
        client.GET('/mdm/locations/{locationId}', {
          params: { path: { locationId: created.locationId } },
        }),
      );
      await runRequest(() =>
        client.PUT('/mdm/locations/{locationId}', {
          params: {
            path: { locationId: created.locationId },
            header: {
              'Idempotency-Key': createIdempotencyKey(),
              'If-Match': etags.ifMatch(locationDetailPath(created.locationId)) ?? '',
            },
          },
          body: {
            locationName: created.locationCode,
            aliasName: detail.location.aliasName ?? null,
          },
        }),
      );
    },
    [client, etags],
  );

  const postLocation = useCallback(
    async (parentLocationId: number | null, code: string): Promise<Location> => {
      const created = await runRequest(() =>
        client.POST('/mdm/locations', {
          params: { header: { 'Idempotency-Key': createIdempotencyKey() } },
          body: { warehouseId, parentLocationId, locationName: code, aliasName: null },
        }),
      );
      await renameToCode(created);
      return created;
    },
    [client, renameToCode, warehouseId],
  );

  const run = useCallback(
    async (steps: readonly BulkStep[]): Promise<void> => {
      if (memory.current?.steps !== steps) {
        memory.current = { steps, done: new Set(), zoneIds: new Map() };
      }
      const { done, zoneIds } = memory.current;
      const pending = steps
        .map((step, index) => ({ step, index }))
        .filter((e) => !done.has(e.index));
      if (pending.length === 0) return;

      const failures: BulkFailure[] = [];
      /** 실패한 새 구역 — 그 랙은 건너뛴다. */
      const failedZones = new Map<number, string>();
      let failedRacks = 0;
      let count = 0;
      setState({ status: 'running', done: 0, total: pending.length });

      for (const { step, index } of pending) {
        try {
          if (step.kind === 'zone') {
            const zone = await postLocation(null, step.code);
            zoneIds.set(step.index, zone.locationId);
          } else {
            const skipped =
              step.zoneRef.kind === 'new' ? failedZones.get(step.zoneRef.index) : undefined;
            if (skipped !== undefined) {
              failedRacks += 1;
              continue;
            }
            const zoneId =
              step.zoneRef.kind === 'new'
                ? zoneIds.get(step.zoneRef.index)
                : step.zoneRef.locationId;
            if (zoneId === undefined) throw new Error('zone');
            if (step.levelCount === 0) {
              await postLocation(zoneId, step.code);
            } else {
              await runRequest(() =>
                client.POST('/mdm/locations:rack', {
                  params: { header: { 'Idempotency-Key': createIdempotencyKey() } },
                  body: {
                    parentLocationId: zoneId,
                    levelCount: step.levelCount,
                    cellCountPerLevel: step.cellCountPerLevel,
                  },
                }),
              );
            }
          }
          done.add(index);
        } catch (error) {
          const reason = bulkFailureReason(error);
          failures.push({ code: step.code, reason });
          if (step.kind === 'zone') failedZones.set(step.index, reason);
          else failedRacks += 1;
        } finally {
          count += 1;
          setState({ status: 'running', done: count, total: pending.length });
        }
      }

      await queryClient.invalidateQueries({ queryKey: locationKeys.all });
      if (failures.length === 0) {
        setState({ status: 'done' });
        return;
      }
      const created = steps.reduce(
        (sum, step, index) => (done.has(index) ? sum + locationsOf(step) : sum),
        0,
      );
      setState({ status: 'partial', failures, failedRacks, created });
    },
    [client, postLocation, queryClient],
  );

  return { state, run };
};
