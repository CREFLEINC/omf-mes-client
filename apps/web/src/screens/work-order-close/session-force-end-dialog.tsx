import { Button, Chip, type ChipStatus, Dialog, Icon, TextArea, useToast } from '@crefle/web-ui';
import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { type JSX, useEffect, useId, useRef, useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { InfoFacts } from '../../patterns/info-facts';
import { SaveErrorBanner, useMasterWrite } from '../../patterns/master';
import { formatPlantDateTime } from '../../patterns/plant-time';
import { workOrderCloseKeys, type WorkOrderCloseOpenSessionView } from './queries';

type WorkSessionForceEnd = components['schemas']['WorkSessionForceEnd'];

const t = messages.workOrderClose.forceEnd;
/** 서버가 받는 사유 길이의 상한 */
const REASON_MAX_LENGTH = 500;
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
  const queryClient = useQueryClient();
  const isAlreadyEnded = write.error?.kind === 'stateLocked';
  /* 이미 끝난 세션이면 실패로 붙잡지 않는다 — 그 사실을 알리고 마감 조건을 다시 읽은 뒤 닫는다. */
  const handledAlreadyEnded = useRef(false);
  useEffect(() => {
    if (!isAlreadyEnded || handledAlreadyEnded.current) return;
    handledAlreadyEnded.current = true;
    void queryClient.invalidateQueries({ queryKey: workOrderCloseKeys.all });
    toast.show({ variant: 'info', description: t.alreadyEnded(terminalOf(session)) });
    onClose();
  }, [isAlreadyEnded, onClose, queryClient, session, toast]);
  const noteId = useId();
  const trimmed = reason.trim();
  /* 글자 수 상한은 칸이 막지 않는다(붙여넣기를 자르지 않게) — 넘으면 보내기 전에 막는다. */
  const blockedReason =
    trimmed === ''
      ? t.reasonRequired
      : trimmed.length > REASON_MAX_LENGTH
        ? t.reasonTooLong(REASON_MAX_LENGTH)
        : null;
  /* 빈 사유는 단추만 잠근다 — 칸 아래 · 단추 위에 같은 안내를 되풀이하지 않는다(#360). 넘친 글자 수만 알린다. */
  const tooLongNote = trimmed.length > REASON_MAX_LENGTH ? blockedReason : null;
  const worker =
    session.workerName === null || session.workerNo === null
      ? sessionText.unknown
      : sessionText.workerValue(session.workerName, session.workerNo);
  /* 상태는 칩으로 — 진행 중 정보 색, 중단 경고 색, 모르는 값 중립(#360). 「진행 중」은 이 팝업 표시만이다. */
  const [stateLabel, stateTone]: [string, ChipStatus] =
    session.statusCode === 'RUNNING'
      ? [t.RUNNING, 'info']
      : session.statusCode === 'STOPPED'
        ? [sessionText.STOPPED, 'warning']
        : [sessionText.unknown, 'idle'];

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
        /* 작업자에게 알리라는 한 줄은 단추 줄 왼쪽 경고 칩, 단추는 오른쪽 — 확인 팝업 공용 짜임(#360). */
        <div className="confirm-foot">
          <p className="iqc-inspection-action-note" data-tone="warning">
            <Icon name="warning" size={14} aria-hidden />
            {t.notify}
          </p>
          <span className="confirm-foot-actions">
            <Button variant="outlined" disabled={write.isSaving} onClick={onClose}>
              {t.cancel}
            </Button>
            <Button
              variant="filled"
              aria-describedby={tooLongNote === null ? undefined : noteId}
              disabled={blockedReason !== null || write.isSaving}
              loading={write.isSaving}
              onClick={() => write.write({ reason: trimmed })}
            >
              {t.confirm}
            </Button>
          </span>
        </div>
      }
    >
      <SaveErrorBanner error={write.error} />
      {/* 정보 상자 — 정보 표시 팝업 시안 상자, 한 줄 가로 나열(#360). */}
      <InfoFacts
        rows={[
          [
            { label: sessionText.terminal, value: terminalOf(session) },
            { label: sessionText.worker, value: worker },
            {
              label: t.startedAt,
              value: formatPlantDateTime(session.startedAt) ?? sessionText.unknown,
            },
            {
              label: sessionText.state,
              value: (
                <Chip size="sm" variant="status" status={stateTone}>
                  {stateLabel}
                </Chip>
              ),
            },
          ],
        ]}
      />
      <p>{t.effect}</p>
      <TextArea
        label={t.reason}
        placeholder={t.reasonPlaceholder}
        value={reason}
        rows={2}
        fullWidth
        required
        maxLength={REASON_MAX_LENGTH}
        helperText={write.fieldErrors.reason === undefined ? t.reasonHelp : undefined}
        error={write.fieldErrors.reason}
        onChange={(event) => {
          setReason(event.target.value);
          write.clearFieldError('reason');
        }}
      />
      {tooLongNote !== null && (
        <p className="field-note" id={noteId}>
          {tooLongNote}
        </p>
      )}
    </Dialog>
  );
};
