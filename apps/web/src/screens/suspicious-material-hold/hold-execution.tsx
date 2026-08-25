import { AlertBanner, Button, Dialog, useToast } from '@crefle/web-ui';
import type { ApiError, components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { SaveErrorBanner, useMasterWrite } from '../../patterns/master';
import type { SelectedLotSnapshot } from './candidate-model';

type Body = components['schemas']['LotHoldCreate'];
type LotHold = components['schemas']['LotHold'];
const t = messages.suspiciousMaterialHold.execution;
interface Confirmation {
  body: Body;
  lotNames: Record<string, string>;
}
const ROOT_KEYS = [
  ['suspicious-material-hold'],
  ['lot-status-history'],
  ['lot-status-transition'],
] as const;
const conflict = (error: ApiError | null): boolean =>
  error?.kind === 'conflict' || (error?.kind === 'http' && error.status === 409);
const conflictMessage = (error: ApiError | null): string => {
  if (
    (error?.kind === 'conflict' || error?.kind === 'http') &&
    error.message !== undefined &&
    error.message.trim() !== ''
  )
    return error.message;
  return t.conflictFallback;
};
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export interface SuspiciousMaterialHoldExecutionProps {
  body: Body | null;
  selected: SelectedLotSnapshot[];
  onConfirmationChange: (pinned: boolean) => void;
  onApplied: () => void;
  onReload: () => void;
}

export const SuspiciousMaterialHoldExecution = ({
  body,
  selected,
  onConfirmationChange,
  onApplied,
  onReload,
}: SuspiciousMaterialHoldExecutionProps) => {
  const { client } = useApiClient();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [applied, setApplied] = useState(false);
  const write = useMasterWrite<Confirmation, LotHold[]>({
    request: async (request, headers) => {
      const result = await client.POST('/quality/lot-holds', {
        params: { header: { 'Idempotency-Key': headers['Idempotency-Key'] } },
        body: request.body,
      });
      if (result.response.status !== 409 || !isRecord(result.error)) return result;
      const raw = result.error as Record<string, unknown>;
      const rawId = raw.conflictingLotId;
      const lotName = typeof rawId === 'number' ? request.lotNames[String(rawId)] : undefined;
      const serverMessage = typeof raw.message === 'string' ? raw.message.trim() : '';
      const owner = lotName ?? t.conflictOwner;
      return {
        ...result,
        error: {
          ...raw,
          message:
            serverMessage === ''
              ? t.conflictChanged(owner)
              : t.conflictServer(owner, serverMessage),
        },
      };
    },
    etagPath: null,
    invalidateKeys: ROOT_KEYS,
    knownFields: [
      'lots',
      'holdQty',
      'uomId',
      'reasonCode',
      'releaseCondition',
      'targetLotStatusCode',
      'remarks',
    ],
    keyLifetime: 'until-applied',
    onSuccess: () => {
      setConfirmation(null);
      setApplied(true);
      onConfirmationChange(false);
      toast.show({ variant: 'success', description: t.success });
      onApplied();
    },
  });
  const close = (): void => {
    if (write.isSaving) return;
    setConfirmation(null);
    onConfirmationChange(false);
    write.reset();
  };
  const reload = (): void => {
    close();
    onReload();
    for (const queryKey of ROOT_KEYS) void queryClient.invalidateQueries({ queryKey });
  };
  const stale = conflict(write.error);

  return (
    <section aria-label={t.pane}>
      <Button
        disabled={body === null || confirmation !== null}
        onClick={() => {
          if (body !== null) {
            setApplied(false);
            setConfirmation({
              body,
              lotNames: Object.fromEntries(selected.map((lot) => [String(lot.lotId), lot.lotNo])),
            });
            onConfirmationChange(true);
          }
        }}
      >
        {t.confirm}
      </Button>
      {applied && (
        <AlertBanner variant="success" title={t.success}>
          {t.successNext}
        </AlertBanner>
      )}
      {confirmation !== null && (
        <Dialog
          open
          closeOnBackdropClick={false}
          showCloseButton={false}
          title={t.dialogTitle}
          onClose={close}
          footer={
            <>
              <Button variant="outlined" disabled={write.isSaving} onClick={close}>
                {t.cancel}
              </Button>
              <Button
                loading={write.isSaving}
                disabled={stale}
                onClick={() => {
                  if (!write.isSaving && !stale) write.write(confirmation);
                }}
              >
                {t.register}
              </Button>
            </>
          }
        >
          {stale ? (
            <AlertBanner variant="error" action={<Button onClick={reload}>{t.reload}</Button>}>
              {conflictMessage(write.error)}
            </AlertBanner>
          ) : (
            <>
              <SaveErrorBanner error={write.error} />
              {Object.keys(write.fieldErrors).length > 0 && (
                <AlertBanner variant="error" title={t.fieldError}>
                  <ul>
                    {Object.values(write.fieldErrors).map((message) => (
                      <li key={message}>{message}</li>
                    ))}
                  </ul>
                </AlertBanner>
              )}
            </>
          )}
          <AlertBanner variant="warning" title={t.impact}>
            {t.impactDescription(Object.keys(confirmation.lotNames).length)}
          </AlertBanner>
        </Dialog>
      )}
    </section>
  );
};
