import { Breadcrumb, PageHeader } from '@crefle/web-ui';
import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

import type { SelectedLotSnapshot } from './candidate-model';
import { SuspiciousMaterialCandidatePane } from './candidate-pane';
import { SuspiciousMaterialHoldExecution } from './hold-execution';
import { type HoldInputLot, SuspiciousMaterialHoldInputPane } from './hold-input-pane';

type Body = components['schemas']['LotHoldCreate'];
const t = messages.suspiciousMaterialHold;
const SUSPICIOUS_MATERIAL_TARGET_LOT_STATUS_CODE = 'INSPECTION_PENDING';

interface SuspiciousMaterialHoldFlowProps {
  targetLotStatusCode: string | null;
}

export const SuspiciousMaterialHoldFlow = ({
  targetLotStatusCode,
}: SuspiciousMaterialHoldFlowProps) => {
  const queryClient = useQueryClient();
  const [selection, setSelection] = useState<SelectedLotSnapshot[]>([]);
  const [body, setBody] = useState<Body | null>(null);
  const [pinned, setPinned] = useState(false);
  const [candidateReady, setCandidateReady] = useState(false);
  const inputSelection = useMemo<HoldInputLot[]>(
    () =>
      selection.map((lot) => ({
        ...lot,
        locationLabel: lot.locationLabel ?? null,
        uomLabel: lot.uomLabel ?? null,
      })),
    [selection],
  );
  const changePinned = useCallback(
    (next: boolean): void => {
      if (next) void queryClient.cancelQueries({ queryKey: ['suspicious-material-hold'] });
      setPinned(next);
    },
    [queryClient],
  );
  const clear = (): void => {
    setSelection([]);
    setBody(null);
  };

  return (
    <div className="suspicious-material-hold-workspace">
      <SuspiciousMaterialCandidatePane
        isLocked={pinned}
        selection={selection}
        onSelectionChange={setSelection}
        onAvailabilityChange={setCandidateReady}
      />
      <SuspiciousMaterialHoldInputPane
        selection={candidateReady ? inputSelection : []}
        targetLotStatusCode={targetLotStatusCode}
        isLocked={pinned}
        onBodyChange={setBody}
      />
      <SuspiciousMaterialHoldExecution
        body={body}
        selected={selection}
        onConfirmationChange={changePinned}
        onApplied={clear}
        onReload={clear}
      />
    </div>
  );
};

export const SuspiciousMaterialHoldScreen = () => (
  <div className="screen suspicious-material-hold-screen">
    <PageHeader
      title={t.title}
      breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
    />
    <SuspiciousMaterialHoldFlow targetLotStatusCode={SUSPICIOUS_MATERIAL_TARGET_LOT_STATUS_CODE} />
  </div>
);
