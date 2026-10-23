import { messages } from '@omf-mes/i18n';

import type { WorkOrderCloseFilterValues } from './filter-bar';

export interface WorkOrderCloseStatusValueSnapshot {
  code: string;
  isActive: boolean;
}

export interface WorkOrderCloseStatusLookupSnapshot {
  data:
    | {
        items: readonly WorkOrderCloseStatusValueSnapshot[];
        truncated: boolean;
      }
    | undefined;
  isError: boolean;
  isPending: boolean;
}

/**
 * 처음 조회하는 상태 — 마감할 수 있는 작업지시가 실제로 머무는 진행·중단. W/O 를 완료로 옮기는
 * 동작이 없어 완료만 보면 늘 비고, 서버는 쉼표로 여러 상태를 받는다.
 */
export const DEFAULT_STATUS_FILTER = 'IN_PROGRESS,SUSPENDED';

/** 서버가 판정으로 거르는 것은 끝나지 않은 작업지시뿐이다 — 마감·취소가 섞이면 400 이다. */
export const canFilterByJudgment = (statusCode: string): boolean =>
  !statusCode.split(',').some((code) => code === 'CLOSED' || code === 'CANCELLED');

type WorkOrderCloseInitialFilters<StatusCode extends '' | typeof DEFAULT_STATUS_FILTER> = Omit<
  WorkOrderCloseFilterValues,
  'statusCode'
> & { statusCode: StatusCode };

interface WorkOrderCloseFilterInitializationBase {
  canLoadCandidates: boolean;
  statusUnavailableReason: string | null;
}

export type WorkOrderCloseFilterInitialization =
  | (WorkOrderCloseFilterInitializationBase & {
      kind: 'CHECKING';
      initialFilters: WorkOrderCloseInitialFilters<''>;
      canLoadCandidates: false;
      statusUnavailableReason: string;
    })
  | (WorkOrderCloseFilterInitializationBase & {
      kind: 'UNAVAILABLE';
      initialFilters: WorkOrderCloseInitialFilters<''>;
      canLoadCandidates: false;
      statusUnavailableReason: string;
    })
  | (WorkOrderCloseFilterInitializationBase & {
      kind: 'READY';
      initialFilters: WorkOrderCloseInitialFilters<typeof DEFAULT_STATUS_FILTER>;
      canLoadCandidates: true;
      statusUnavailableReason: null;
    });

const emptyInitialFilters = (): WorkOrderCloseInitialFilters<''> => ({
  productionOrderId: '',
  plannedStartFrom: '',
  plannedStartTo: '',
  statusCode: '',
  judgmentCode: '',
});

const unavailable = (statusUnavailableReason: string): WorkOrderCloseFilterInitialization => ({
  kind: 'UNAVAILABLE',
  initialFilters: emptyInitialFilters(),
  canLoadCandidates: false,
  statusUnavailableReason,
});

export const toWorkOrderCloseFilterInitialization = (
  snapshot: WorkOrderCloseStatusLookupSnapshot,
): WorkOrderCloseFilterInitialization => {
  const t = messages.workOrderClose.filter;

  if (snapshot.isError) return unavailable(t.statusLookupFailed);

  if (snapshot.isPending) {
    return {
      kind: 'CHECKING',
      initialFilters: emptyInitialFilters(),
      canLoadCandidates: false,
      statusUnavailableReason: t.statusLookupLoading,
    };
  }

  if (snapshot.data === undefined) return unavailable(t.statusLookupEmpty);
  if (snapshot.data.truncated) return unavailable(t.statusLookupTruncated);

  const activeValues = snapshot.data.items.filter((value) => value.isActive);
  if (activeValues.length === 0) return unavailable(t.statusLookupEmpty);
  if (!activeValues.some((value) => value.code === 'IN_PROGRESS')) {
    return unavailable(t.inProgressStatusMissing);
  }

  return {
    kind: 'READY',
    initialFilters: { ...emptyInitialFilters(), statusCode: DEFAULT_STATUS_FILTER },
    canLoadCandidates: true,
    statusUnavailableReason: null,
  };
};
