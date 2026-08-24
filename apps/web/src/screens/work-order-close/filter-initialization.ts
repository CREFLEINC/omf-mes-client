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

type WorkOrderCloseInitialFilters<StatusCode extends '' | 'COMPLETED'> = Omit<
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
      initialFilters: WorkOrderCloseInitialFilters<'COMPLETED'>;
      canLoadCandidates: true;
      statusUnavailableReason: null;
    });

const emptyInitialFilters = (): WorkOrderCloseInitialFilters<''> => ({
  productionOrderId: '',
  plannedStartFrom: '',
  plannedStartTo: '',
  statusCode: '',
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
  if (!activeValues.some((value) => value.code === 'COMPLETED')) {
    return unavailable(t.completedStatusMissing);
  }

  return {
    kind: 'READY',
    initialFilters: { ...emptyInitialFilters(), statusCode: 'COMPLETED' },
    canLoadCandidates: true,
    statusUnavailableReason: null,
  };
};
