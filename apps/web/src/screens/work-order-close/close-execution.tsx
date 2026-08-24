import type { ApiError, components } from '@omf-mes/api-client';
import { Button, useToast } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useState } from 'react';
import { useApiClient } from '../../patterns/api-context';
import { SaveErrorBanner } from '../../patterns/master';
import { WorkOrderCloseConfirmDialog } from './close-confirm-dialog';
import { useWorkOrderCloseMutation } from './mutations';
import { workOrderCloseDetailPath } from './queries';
type WorkOrderClose = components['schemas']['WorkOrderClose'];
type Confirmation = [body: WorkOrderClose, etag: string | undefined, signature: string];
export interface WorkOrderCloseExecutionProps {
  workOrderId: number;
  workOrderNo: string;
  request: WorkOrderClose | null;
  onClearSelection: () => void;
  onReloadCandidates: () => Promise<unknown>;
  onReloadDetail: () => Promise<unknown>;
}
const toFieldError = (fieldErrors: Record<string, string>): ApiError | null => {
  const errors = Object.entries(fieldErrors).map(([field, message]) =>
    Object.assign({ scope: 'field' as const, code: 'SERVER_VALIDATION' }, { field, message }),
  );
  return errors.length === 0 ? null : { kind: 'validation', errors };
};
export const WorkOrderCloseExecution = (props: WorkOrderCloseExecutionProps) => {
  const toast = useToast();
  const { etags } = useApiClient();
  const etagPath = workOrderCloseDetailPath(props.workOrderId);
  const request = props.request;
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const write = useWorkOrderCloseMutation({
    workOrderId: props.workOrderId,
    onSuccess: () => {
      setConfirmation(null);
      props.onClearSelection();
      toast.show({ variant: 'success', description: messages.workOrderClose.closeSuccess });
    },
  });
  useEffect(() => {
    if (request !== null || confirmation === null || write.isSaving) return;
    setConfirmation(null);
    write.reset();
  }, [confirmation, request, write.isSaving, write.reset]);
  const closeDialog = (): void => {
    setConfirmation(null);
    write.reset();
  };
  const reload = (): void => {
    closeDialog();
    props.onClearSelection();
    void Promise.all([props.onReloadCandidates(), props.onReloadDetail()]);
  };
  return (
    <>
      <Button
        disabled={request === null || write.isSaving}
        onClick={() => {
          if (request === null) return;
          write.reset();
          setConfirmation([request, etags.ifMatch(etagPath), JSON.stringify(request)]);
        }}
      >
        {messages.workOrderClose.confirm.confirm}
      </Button>
      {confirmation === null || (request === null && !write.isSaving) ? null : (
        <WorkOrderCloseConfirmDialog
          workOrderNo={props.workOrderNo}
          banner={
            <>
              <SaveErrorBanner error={write.error} onReload={reload} />
              <SaveErrorBanner error={toFieldError(write.fieldErrors)} />
            </>
          }
          isSubmitting={write.isSaving}
          onClose={closeDialog}
          onConfirm={() => {
            if (write.isSaving) return;
            if (
              request === null ||
              confirmation[1] !== etags.ifMatch(etagPath) ||
              JSON.stringify(request) !== confirmation[2]
            )
              return closeDialog();
            write.write(confirmation[0]);
          }}
        />
      )}
    </>
  );
};
