import { Button, Chip, Dialog, TextField, useToast } from '@crefle/web-ui';
import type { AppUserWorker } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { SaveErrorBanner, useMasterWrite } from '../../patterns/master';
import { runRequest } from '../../patterns/request';
import { sessionKeys } from '../../patterns/session';
import { FieldLabel } from './field-label';
import { LoadErrorBanner } from './load-error-banner';

const t = messages.usersRoles.workerLink;

export const workerLinkKey = (appUserId: number) =>
  ['users-roles-users', 'worker', appUserId] as const;

const workerDetailKey = (workerId: number) =>
  ['users-roles-users', 'worker-detail', workerId] as const;

/** 서버가 연결 거부를 싣는 칸(`PUT /app/users/{id}/worker` · 400 `workerId`) — 입력칸 아래에 낸다. */
const WORKER_FIELD = 'workerId';

export interface WorkerLinkFieldProps {
  appUserId: number;
  /** 작업자의 부서 번호 → 이름. 사용자 정보의 부서 칸과 같은 목록에서 푼다. */
  departmentLabel: (departmentId: number) => string;
}

/**
 * 계정 ↔ 작업자 연결 — 사용자 정보 카드 안의 「연결된 작업자」 구역(omf-all-around#104 · 서버 선행 P-38).
 *
 * 관리웹 IQC 판정은 계정에 연결된 작업자를 검사자로 남긴다 — 연결이 없으면 화면도 서버도 저장을 막는다.
 *
 * **기본은 한 줄 조회다**(담당자 결정 2026-10-16). [배지] 이름 · 사번 · 부서와 버튼이 한 줄, 그 아래 안내 한 줄.
 * 입력은 [작업자 연결]·[작업자 변경]을 눌렀을 때만 그 아래 그룹으로 열고, 오류는 입력칸 바로 아래에 둔다.
 * 해제는 보조 버튼 + 확인 창. 「즉시 적용」 안내는 입력 그룹과 확인 창에만 둔다.
 *
 * **사번으로 연결한다.** 재직자 중 그 사번을 찾아 그 작업자로 치환한다. 한 작업자가 다른 계정에 이미 연결돼 있으면
 * 서버가 400(`workerId`)으로 막는다 — 그 칸 오류는 입력칸 아래에, 나머지는 배너에 낸다.
 *
 * ⭐ 성공하면 세션을 다시 읽는다 — 자기 계정을 바꿨다면 IQC 판정 화면이 재로그인 없이 바로 잠기거나 풀린다.
 */
export const WorkerLinkField = ({ appUserId, departmentLabel }: WorkerLinkFieldProps) => {
  const { client } = useApiClient();
  const queryClient = useQueryClient();
  const toast = useToast();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [workerNo, setWorkerNo] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [isUnlinkOpen, setIsUnlinkOpen] = useState(false);

  const link = useQuery({
    queryKey: workerLinkKey(appUserId),
    queryFn: () =>
      runRequest(() =>
        client.GET('/app/users/{appUserId}/worker', { params: { path: { appUserId } } }),
      ),
  });

  const current = link.data;
  const linkedId = current?.workerId ?? null;

  /* 부서는 연결 응답에 없다 — 연결된 작업자의 상세에서 읽는다. */
  const detail = useQuery({
    queryKey: workerDetailKey(linkedId ?? 0),
    enabled: linkedId !== null,
    queryFn: () =>
      runRequest(() =>
        client.GET('/mdm/workers/{workerId}', { params: { path: { workerId: linkedId ?? 0 } } }),
      ),
  });

  const departmentId = detail.data?.worker.departmentId ?? null;
  const department = departmentId === null ? t.noDepartment : departmentLabel(departmentId);

  const closeEdit = (): void => {
    setIsEditing(false);
    setWorkerNo('');
    setLocalError(null);
  };

  const write = useMasterWrite<number | null, AppUserWorker>({
    request: (workerId, headers) =>
      client.PUT('/app/users/{appUserId}/worker', {
        params: { path: { appUserId }, header: { 'Idempotency-Key': headers['Idempotency-Key'] } },
        body: { workerId },
      }),
    etagPath: null,
    invalidateKeys: [],
    knownFields: [WORKER_FIELD],
    onSuccess: (saved) => {
      queryClient.setQueryData(workerLinkKey(appUserId), saved);
      void queryClient.invalidateQueries({ queryKey: sessionKeys.current });
      closeEdit();
      setIsUnlinkOpen(false);
      toast.show({
        variant: 'success',
        description:
          saved.workerId === null
            ? t.unlinkedToast
            : t.linkedToast(`${saved.workerNo ?? ''} · ${saved.workerName ?? ''}`),
      });
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
      write.write(found.workerId);
    } finally {
      setIsLookingUp(false);
    }
  };

  const isLinked = current !== undefined && linkedId !== null;

  return (
    <section className="users-roles-worker-link" aria-label={t.title}>
      <h3 className="users-roles-worker-link-title">{t.title}</h3>

      {link.isError && <LoadErrorBanner error={link.error} onRetry={() => void link.refetch()} />}
      {!isUnlinkOpen && <SaveErrorBanner error={write.error} />}

      {current !== undefined && (
        <>
          <div className="users-roles-worker-link-row">
            <div className="users-roles-worker-link-summary">
              <Chip variant="status" size="sm" status={isLinked ? 'success' : 'idle'}>
                {isLinked ? t.linked : t.unlinked}
              </Chip>
              {isLinked ? (
                <>
                  <strong>{current.workerName}</strong>
                  <span className="users-roles-worker-link-meta">{current.workerNo}</span>
                  <span className="users-roles-worker-link-meta">{department}</span>
                </>
              ) : (
                <span>{t.none}</span>
              )}
            </div>
            {!isEditing && (
              <div className="users-roles-worker-link-actions">
                {isLinked ? (
                  <>
                    <Button
                      variant="outlined"
                      size="sm"
                      className="app-button-neutral"
                      disabled={isBusy}
                      onClick={() => {
                        write.reset();
                        setIsEditing(true);
                      }}
                    >
                      {t.change}
                    </Button>
                    <Button
                      variant="text"
                      size="sm"
                      className="app-button-neutral"
                      disabled={isBusy}
                      onClick={() => {
                        write.reset();
                        setIsUnlinkOpen(true);
                      }}
                    >
                      {t.unlink}
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="tonal"
                    size="sm"
                    disabled={isBusy}
                    onClick={() => {
                      write.reset();
                      setIsEditing(true);
                    }}
                  >
                    {t.connect}
                  </Button>
                )}
              </div>
            )}
          </div>
          {!isEditing && (
            <p className="field-note users-roles-worker-link-hint">
              {isLinked ? t.hintLinked : t.hintUnlinked}
            </p>
          )}
        </>
      )}

      {isEditing && (
        <form className="users-roles-worker-link-edit" onSubmit={(event) => void submit(event)}>
          <FieldLabel htmlFor={inputId} label={isLinked ? t.inputChange : t.inputConnect} />
          <div className="users-roles-worker-link-edit-row">
            <TextField
              ref={inputRef}
              id={inputId}
              size="sm"
              value={workerNo}
              onChange={(event) => {
                setWorkerNo(event.target.value);
              }}
              disabled={isBusy}
              error={inputError}
            />
            <Button type="submit" size="sm" loading={isBusy} disabled={isBusy}>
              {isLinked ? t.submitChange : t.submitConnect}
            </Button>
            <Button
              type="button"
              variant="text"
              size="sm"
              className="app-button-neutral"
              disabled={isBusy}
              onClick={() => {
                write.reset();
                closeEdit();
              }}
            >
              {messages.common.cancel}
            </Button>
          </div>
          <p className="field-note">{isLinked ? t.noteChange : t.noteConnect}</p>
        </form>
      )}

      <Dialog
        open={isUnlinkOpen}
        onClose={() => {
          setIsUnlinkOpen(false);
        }}
        size="sm"
        title={t.unlinkConfirmTitle}
        closeOnBackdropClick={false}
        footer={
          <>
            <Button
              variant="outlined"
              className="app-button-neutral"
              onClick={() => {
                setIsUnlinkOpen(false);
              }}
            >
              {messages.common.cancel}
            </Button>
            <Button
              loading={write.isSaving}
              disabled={write.isSaving}
              onClick={() => {
                write.write(null);
              }}
            >
              {t.unlink}
            </Button>
          </>
        }
      >
        {isUnlinkOpen && <SaveErrorBanner error={write.error} />}
        {isUnlinkOpen && (
          <p>{t.unlinkConfirmBody(`${current?.workerNo ?? ''} · ${current?.workerName ?? ''}`)}</p>
        )}
      </Dialog>
    </section>
  );
};
