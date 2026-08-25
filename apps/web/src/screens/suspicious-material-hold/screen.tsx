import type { components } from '@omf-mes/api-client';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

import type { SelectedLotSnapshot } from './candidate-model';
import { SuspiciousMaterialCandidatePane } from './candidate-pane';
import { SuspiciousMaterialHoldExecution } from './hold-execution';
import { type HoldInputLot, SuspiciousMaterialHoldInputPane } from './hold-input-pane';

type Body = components['schemas']['LotHoldCreate'];
export interface SuspiciousMaterialHoldScreenProps {
  targetLotStatusCode: string | null;
}

export const SuspiciousMaterialHoldScreen = ({
  targetLotStatusCode,
}: SuspiciousMaterialHoldScreenProps) => {
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
    <div className="content-stack">
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
