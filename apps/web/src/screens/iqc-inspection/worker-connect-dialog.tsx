import { Button, Dialog, TextField, useToast } from '@crefle/web-ui';
import type { AppUserWorker } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { SaveErrorBanner, useMasterWrite } from '../../patterns/master';
import { runRequest, toApiError } from '../../patterns/request';
import { sessionKeys } from '../../patterns/session';
import { describeLoadError } from '../users-roles/load-error-banner';
import { FieldLabel } from './field-label';

const t = messages.usersRoles.workerLink;

/** 서버가 연결 거부를 싣는 칸(`PUT /app/users/{id}/worker` · 400 `workerId`) — 입력칸 아래에 낸다. */
const WORKER_FIELD = 'workerId';

export interface WorkerConnectDialogProps {
  /** 지금 로그인한 계정 — 이 계정에 작업자를 잇는다. */
  appUserId: number;
  onClose: () => void;
}

/**
 * 검사 조회·판정에서 바로 여는 「작업자 연결」 창(사용자 지시 2026-10-28 · #197) — 사용자 관리의 연결 창(`users-roles/worker-link-field`)과
 * 같은 순서다: 사번으로 재직자를 찾고, 다른 계정에 이미 연결된 사번이면 보내지 않고 막는다.
 *
 * ⭐ 성공하면 세션을 다시 읽는다 — 판정 칸이 재로그인 없이 바로 풀린다.
 */
export const WorkerConnectDialog = ({ appUserId, onClose }: WorkerConnectDialogProps) => {
  const { client } = useApiClient();
  const queryClient = useQueryClient();
  const toast = useToast();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [workerNo, setWorkerNo] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);

  const write = useMasterWrite<number, AppUserWorker>({
    request: (workerId, headers) =>
      client.PUT('/app/users/{appUserId}/worker', {
        params: { path: { appUserId }, header: { 'Idempotency-Key': headers['Idempotency-Key'] } },
        body: { workerId },
      }),
    etagPath: null,
    invalidateKeys: [],
    knownFields: [WORKER_FIELD],
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: sessionKeys.current });
      // ui-check-ignore: C-13 사용자 관리의 연결 알림과 같은 「사번 · 이름」 표기
      const summary = `${saved.workerNo ?? ''} · ${saved.workerName ?? ''}`;
      toast.show({ variant: 'success', description: t.linkedToast(summary) });
      onClose();
    },
  });

  const inputError = localError ?? write.fieldErrors[WORKER_FIELD];
  const isBusy = isLookingUp || write.isSaving;

  /* 오류가 서면 입력칸으로 돌아가 값을 골라 둔다 — 바로 고쳐 치게. */
  useEffect(() => {
    if (inputError === undefined) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [inputError]);

  const close = (): void => {
    if (!isBusy) onClose();
  };

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    if (isBusy) return;
    const trimmed = workerNo.trim();
    if (trimmed === '') {
      setLocalError(t.workerNoRequired);
      return;
    }
    setLocalError(null);
    write.reset();
    setIsLookingUp(true);
    try {
      const found = await runRequest(() =>
        client.GET('/mdm/workers', {
          params: { query: { workerNo: trimmed, includeInactive: false, page: 1, size: 2 } },
        }),
      ).then((response) => response.items.find((worker) => worker.workerNo === trimmed));
      if (found === undefined) {
        setLocalError(t.notFound);
        return;
      }
      if (found.appUserId != null && found.appUserId !== appUserId) {
        setLocalError(t.linkedElsewhere);
        return;
      }
      write.write(found.workerId);
    } catch (error) {
      // 사번 조회 자체가 실패했다(통신·서버 오류) — 조용히 끝내지 않고 입력칸 아래에 원인을 낸다.
      setLocalError(describeLoadError(toApiError(error)));
    } finally {
      setIsLookingUp(false);
    }
  };

  return (
    <Dialog
      open
      onClose={close}
      size="sm"
      title={t.connect}
      closeOnBackdropClick={false}
      showCloseButton={false}
    >
      <form className="users-roles-worker-dialog" onSubmit={(event) => void submit(event)}>
        {write.error !== null && <SaveErrorBanner error={write.error} />}
        <div className="users-roles-worker-dialog-field">
          <FieldLabel htmlFor={inputId} label={t.inputLabel} />
          <TextField
            ref={inputRef}
            id={inputId}
            fullWidth
            autoFocus
            placeholder={t.inputPlaceholder}
            value={workerNo}
            onChange={(event) => {
              setWorkerNo(event.target.value);
              // 고쳐 쓰는 동안 앞 제출의 오류를 남기지 않는다.
              setLocalError(null);
              if (write.error !== null) write.reset();
            }}
            disabled={isBusy}
            error={inputError}
          />
          <p className="field-note">{t.noteConnect}</p>
        </div>
        <div className="users-roles-worker-dialog-actions">
          <Button
            type="button"
            variant="outlined"
            className="app-button-neutral"
            disabled={isBusy}
            onClick={close}
          >
            {messages.common.cancel}
          </Button>
          <Button type="submit" loading={isBusy} disabled={isBusy || workerNo.trim() === ''}>
            {t.submitConnect}
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
