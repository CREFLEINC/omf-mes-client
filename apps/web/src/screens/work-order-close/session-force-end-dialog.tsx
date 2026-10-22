import { Button, Dialog, TextArea, useToast } from '@crefle/web-ui';
import type { components, WorkSessionForceEnd } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { type JSX, useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { SaveErrorBanner, useMasterWrite } from '../../patterns/master';
import { formatPlantDateTime } from '../../patterns/plant-time';
import { workOrderCloseKeys, type WorkOrderCloseOpenSessionView } from './queries';

const t = messages.workOrderClose.forceEnd;
const sessionText = messages.workOrderClose.status.sessions;

export interface SessionForceEndDialogProps {
  session: WorkOrderCloseOpenSessionView;
  onClose: () => void;
}

const terminalOf = (session: WorkOrderCloseOpenSessionView): string =>
  session.terminalCode ?? sessionText.unknown;

/**
 * 관리웹에서 열린 세션을 닫는 주의 창. 되돌릴 수 없고 그 단말의 작업을 멈추므로, 어느 단말·작업자의
 * 세션인지와 그 단말에서 무엇이 일어나는지를 누르기 전에 보인다. 사유는 기록으로 남아 필수다.
 */
export const SessionForceEndDialog = ({
  session,
  onClose,
}: SessionForceEndDialogProps): JSX.Element => {
  const { client } = useApiClient();
  const toast = useToast();
  const [reason, setReason] = useState('');
  const write = useMasterWrite<WorkSessionForceEnd, components['schemas']['WorkSession']>({
    request: (body, headers) =>
      client.POST('/production/work-sessions/{workSessionId}:force-end', {
        params: {
          path: { workSessionId: session.workSessionId },
          header: { 'Idempotency-Key': headers['Idempotency-Key'] },
        },
        body,
      }),
    /* 서버가 세션을 잠그고 상태로 판정한다 — 계약이 If-Match 를 받지 않는다. */
    etagPath: null,
    invalidateKeys: [workOrderCloseKeys.all],
    knownFields: ['reason'],
    keyLifetime: 'until-applied',
    onSuccess: () => {
      toast.show({ variant: 'success', description: t.done(terminalOf(session)) });
      onClose();
    },
  });
  const trimmed = reason.trim();
  const worker =
    session.workerName === null || session.workerNo === null
      ? sessionText.unknown
      : sessionText.workerValue(session.workerName, session.workerNo);
  const state =
    session.statusCode === 'RUNNING' || session.statusCode === 'STOPPED'
      ? sessionText[session.statusCode]
      : sessionText.unknown;
  const fields: [label: string, value: string][] = [
    [sessionText.terminal, terminalOf(session)],
    [sessionText.worker, worker],
    [sessionText.startedAt, formatPlantDateTime(session.startedAt) ?? sessionText.unknown],
    [sessionText.state, state],
  ];

  return (
    <Dialog
      open
      title={t.title}
      showCloseButton={false}
      /* 되돌릴 수 없는 일 앞에서 바깥을 눌러 닫히지 않게 한다. */
      closeOnBackdropClick={false}
      onClose={() => {
        if (!write.isSaving) onClose();
      }}
      footer={
        <>
          <Button variant="outlined" disabled={write.isSaving} onClick={onClose}>
            {t.cancel}
          </Button>
          <Button
            variant="filled"
            disabled={trimmed === '' || write.isSaving}
            loading={write.isSaving}
            onClick={() => write.write({ reason: trimmed })}
          >
            {t.confirm}
          </Button>
        </>
      }
    >
      <SaveErrorBanner error={write.error} />
      <dl className="work-order-close-confirm-details">
        {fields.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <p>{t.effect}</p>
      <p>{t.notify}</p>
      <TextArea
        label={t.reason}
        value={reason}
        rows={2}
        fullWidth
        required
        helperText={write.fieldErrors.reason === undefined ? t.reasonHelp : undefined}
        error={write.fieldErrors.reason}
        onChange={(event) => {
          setReason(event.target.value);
          write.clearFieldError('reason');
        }}
      />
    </Dialog>
  );
};
