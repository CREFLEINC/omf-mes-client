import type { ApiError, components } from '@omf-mes/api-client';
import { AlertBanner, Button, useToast } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useState } from 'react';
import { useApiClient } from '../../patterns/api-context';
import { SaveErrorBanner } from '../../patterns/master';
import {
  erpResultMenuPath,
  WorkOrderCloseConfirmDialog,
  type WorkOrderCloseConfirmDetail,
} from './close-confirm-dialog';
import { useWorkOrderCloseMutation } from './mutations';
import { workOrderCloseDetailPath } from './queries';
type WorkOrderClose = components['schemas']['WorkOrderClose'];
type Confirmation = [body: WorkOrderClose, etag: string | undefined, signature: string];
export interface WorkOrderCloseExecutionProps {
  workOrderId: number;
  workOrderNo: string;
  request: WorkOrderClose | null;
  details: readonly WorkOrderCloseConfirmDetail[];
  warnings: readonly string[];
  onClearSelection: () => void;
  onReloadCandidates: () => Promise<unknown>;
  onReloadDetail: () => Promise<unknown>;
  onReloadSessions: () => Promise<unknown>;
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
      toast.show({
        variant: 'success',
        description: messages.workOrderClose.closeSuccess(props.workOrderNo, erpResultMenuPath()),
      });
    },
  });
  /* 그사이 다른 단말이 세션을 열었으면 상태 칸이 그 세션을 보이도록 다시 읽는다. */
  const { onReloadSessions } = props;
  const errorCode = write.error !== null && 'code' in write.error ? write.error.code : undefined;
  useEffect(() => {
    if (errorCode === 'OPEN_SESSION_EXISTS') void onReloadSessions();
  }, [errorCode, onReloadSessions]);
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
      {props.warnings.length === 0 ? null : (
        <div className="banner-slot">
          <AlertBanner variant="info">
            {props.warnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </AlertBanner>
        </div>
      )}
      <div className="work-order-close-actions">
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
      </div>
      {confirmation === null || (request === null && !write.isSaving) ? null : (
        <WorkOrderCloseConfirmDialog
          workOrderNo={props.workOrderNo}
          details={props.details}
          warnings={props.warnings}
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
