import { AlertBanner, Button, Chip, Dialog, TextField, useToast } from '@crefle/web-ui';
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

type PickMode = 'connect' | 'change';

export interface WorkerLinkFieldProps {
  appUserId: number;
  /** 작업자의 부서 번호 → 이름. 사용자 정보의 부서 칸과 같은 목록에서 푼다. */
  departmentLabel: (departmentId: number) => string;
}

/** 모달 안의 「현재 작업자」 블록 — 변경 모달과 해제 확인 창이 같이 쓴다. */
const WorkerBlock = ({ name, meta }: { name: string; meta: readonly string[] }) => (
  <div className="users-roles-worker-block">
    <strong>{name}</strong>
    {meta.map((line) => (
      <span key={line}>{line}</span>
    ))}
  </div>
);

/**
 * 계정 ↔ 작업자 연결 — 사용자 정보 카드 안의 「연결된 작업자」 구역(omf-all-around#104 · 서버 선행 P-38).
 *
 * 관리웹 IQC 판정은 계정에 연결된 작업자를 검사자로 남긴다 — 연결이 없으면 화면도 서버도 저장을 막는다.
 *
 * **카드는 조회만 한다**(담당자 결정 2026-10-16). 연결·변경은 작은 모달에서 사번을 받아 처리하고, 해제는 확인 창을
 * 거친다 — 버튼을 눌러도 카드의 크기·배치가 바뀌지 않는다.
 *
 * **사번으로 연결한다.** 재직자 중 그 사번을 찾아 그 작업자로 치환한다. 조회 응답의 `appUserId` 가 다른 계정이면
 * 보내지 않고 막는다(서버도 같은 경우를 400 `workerId` 로 막는다 — 경합으로 그 길에 들면 서버 문구를 입력칸 아래에 낸다).
 *
 * ⭐ 성공하면 세션을 다시 읽는다 — 자기 계정을 바꿨다면 IQC 판정 화면이 재로그인 없이 바로 잠기거나 풀린다.
 */
export const WorkerLinkField = ({ appUserId, departmentLabel }: WorkerLinkFieldProps) => {
  const { client } = useApiClient();
  const queryClient = useQueryClient();
  const toast = useToast();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pickMode, setPickMode] = useState<PickMode | null>(null);
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
      setPickMode(null);
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

  /* 열 때마다 빈 입력에서 시작한다 — 취소한 값이 다음에 남지 않게. */
  const openPick = (mode: PickMode): void => {
    write.reset();
    setWorkerNo('');
    setLocalError(null);
    setPickMode(mode);
  };

  const closePick = (): void => {
    if (isBusy) return;
    write.reset();
    setPickMode(null);
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
    } finally {
      setIsLookingUp(false);
    }
  };

  const isLinked = current !== undefined && linkedId !== null;
  const linkedName = current?.workerName ?? '';
  const linkedNo = current?.workerNo ?? '';

  return (
    <section className="users-roles-worker-link" aria-label={t.title}>
      <h3 className="users-roles-worker-link-title">{t.title}</h3>

      {link.isError && <LoadErrorBanner error={link.error} onRetry={() => void link.refetch()} />}

      {current !== undefined && (
        <>
          <div className="users-roles-worker-link-row">
            <div className="users-roles-worker-link-summary">
              <Chip variant="status" size="sm" status={isLinked ? 'success' : 'idle'}>
                {isLinked ? t.linked : t.unlinked}
              </Chip>
              {isLinked ? (
                <>
                  <strong>{linkedName}</strong>
                  <span className="users-roles-worker-link-meta">{linkedNo}</span>
                  <span className="users-roles-worker-link-meta">{department}</span>
                </>
              ) : (
                <span>{t.none}</span>
              )}
            </div>
            <div className="users-roles-worker-link-actions">
              {isLinked ? (
                <>
                  <Button
                    variant="outlined"
                    size="sm"
                    className="app-button-neutral"
                    onClick={() => {
                      openPick('change');
                    }}
                  >
                    {t.change}
                  </Button>
                  <Button
                    variant="text"
                    size="sm"
                    className="app-button-neutral"
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
                  onClick={() => {
                    openPick('connect');
                  }}
                >
                  {t.connect}
                </Button>
              )}
            </div>
          </div>
          <p className="field-note users-roles-worker-link-hint">
            {isLinked ? t.hintLinked : t.hintUnlinked}
          </p>
        </>
      )}

      <Dialog
        open={pickMode !== null}
        onClose={closePick}
        size="sm"
        title={pickMode === 'change' ? t.change : t.connect}
        closeOnBackdropClick={false}
        footer={
          <>
            <Button
              type="button"
              variant="outlined"
              className="app-button-neutral"
              disabled={isBusy}
              onClick={closePick}
            >
              {messages.common.cancel}
            </Button>
            <Button type="submit" form={`${inputId}-form`} loading={isBusy} disabled={isBusy}>
              {pickMode === 'change' ? t.submitChange : t.submitConnect}
            </Button>
          </>
        }
      >
        {pickMode !== null && (
          <form
            id={`${inputId}-form`}
            className="users-roles-worker-dialog"
            onSubmit={(event) => void submit(event)}
          >
            {write.error !== null && <SaveErrorBanner error={write.error} />}
            {pickMode === 'change' && (
              <WorkerBlock name={linkedName} meta={[`${linkedNo} · ${department}`]} />
            )}
            <div>
              <FieldLabel
                htmlFor={inputId}
                label={pickMode === 'change' ? t.inputChange : t.inputConnect}
              />
              <TextField
                ref={inputRef}
                id={inputId}
                autoFocus
                value={workerNo}
                onChange={(event) => {
                  setWorkerNo(event.target.value);
                }}
                disabled={isBusy}
                error={inputError}
              />
            </div>
            <p className="field-note">{pickMode === 'change' ? t.noteChange : t.noteConnect}</p>
          </form>
        )}
      </Dialog>

      <Dialog
        open={isUnlinkOpen}
        onClose={() => {
          if (!write.isSaving) setIsUnlinkOpen(false);
        }}
        size="sm"
        title={t.unlinkConfirmTitle}
        closeOnBackdropClick={false}
        footer={
          <>
            <Button
              variant="outlined"
              className="app-button-neutral"
              disabled={write.isSaving}
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
        {isUnlinkOpen && (
          <div className="users-roles-worker-dialog">
            {write.error !== null && <SaveErrorBanner error={write.error} />}
            <WorkerBlock name={linkedName} meta={[linkedNo]} />
            <p className="users-roles-worker-dialog-question">{t.unlinkQuestion}</p>
            <AlertBanner variant="warning">{t.unlinkImpact}</AlertBanner>
            <p className="field-note">{t.unlinkNote}</p>
          </div>
        )}
      </Dialog>
    </section>
  );
};
