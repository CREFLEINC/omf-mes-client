import { Button, Chip, Dialog, TextField, useToast } from '@crefle/web-ui';
import type { AppUserWorker } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { SaveErrorBanner, useMasterWrite } from '../../patterns/master';
import { runRequest } from '../../patterns/request';
import { sessionKeys } from '../../patterns/session';
import { LoadErrorBanner } from './load-error-banner';

const t = messages.usersRoles.workerLink;

export const workerLinkKey = (appUserId: number) =>
  ['users-roles-users', 'worker', appUserId] as const;

const workerDetailKey = (workerId: number) =>
  ['users-roles-users', 'worker-detail', workerId] as const;

export interface WorkerLinkFieldProps {
  appUserId: number;
  /** 작업자의 부서 번호 → 이름. 사용자 정보의 부서 칸과 같은 목록에서 푼다. */
  departmentLabel: (departmentId: number) => string;
}

/**
 * 계정 ↔ 작업자 지정 — 사용자 정보 카드 안의 「작업자 정보」 구역(omf-all-around#104 · 서버 선행 P-38).
 *
 * 관리웹 IQC 판정은 계정에 지정된 작업자를 검사자로 남긴다 — 지정이 없으면 화면도 서버도 저장을 막는다.
 *
 * **기본은 조회다**(담당자 지시 2026-10-16). 지정 여부·사번·이름·부서를 먼저 보이고, 입력칸은 「작업자 지정」·
 * 「작업자 변경」을 눌렀을 때만 연다. 해제는 변경과 구분되는 보조 버튼이고 확인 창을 거친다. 「즉시 적용」 안내는
 * 지정·변경·해제를 하는 자리에서만 낸다. 실패하면 입력을 연 채로 두고 지정 정보는 그대로다.
 *
 * **사번으로 지정한다.** 재직자 중 그 사번을 찾아 그 작업자로 치환한다. 한 작업자가 다른 계정에 이미 지정돼 있으면
 * 서버가 400 으로 막는다.
 *
 * ⭐ 성공하면 세션을 다시 읽는다 — 자기 계정을 바꿨다면 IQC 판정 화면이 재로그인 없이 바로 잠기거나 풀린다.
 */
export const WorkerLinkField = ({ appUserId, departmentLabel }: WorkerLinkFieldProps) => {
  const { client } = useApiClient();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [workerNo, setWorkerNo] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
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

  /* 부서는 지정 응답에 없다 — 지정된 작업자의 상세에서 읽는다. */
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
    knownFields: [],
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

  const submit = async (): Promise<void> => {
    const trimmed = workerNo.trim();
    if (trimmed === '') {
      setLocalError(t.workerNoRequired);
      return;
    }
    setLocalError(null);
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
  };

  const isLinked = current !== undefined && linkedId !== null;

  return (
    <section className="users-roles-worker-link" aria-label={t.title}>
      <div className="users-roles-worker-link-head">
        <h3>{t.title}</h3>
        {isLinked && (
          <Chip variant="status" size="sm" status="success">
            {t.linked}
          </Chip>
        )}
      </div>

      {link.isError && <LoadErrorBanner error={link.error} onRetry={() => void link.refetch()} />}
      {!isUnlinkOpen && <SaveErrorBanner error={write.error} />}

      {current !== undefined &&
        (isLinked ? (
          <dl className="users-roles-worker-link-info">
            <div>
              <dt>{t.workerNo}</dt>
              <dd>{current.workerNo}</dd>
            </div>
            <div>
              <dt>{t.workerName}</dt>
              <dd>{current.workerName}</dd>
            </div>
            <div>
              <dt>{t.department}</dt>
              <dd>{department}</dd>
            </div>
          </dl>
        ) : (
          <p className="users-roles-worker-link-none">{t.none}</p>
        ))}

      {current !== undefined && !isEditing && (
        <div className="users-roles-worker-link-actions">
          <Button
            variant="tonal"
            size="sm"
            disabled={write.isSaving}
            onClick={() => {
              write.reset();
              setIsEditing(true);
            }}
          >
            {isLinked ? t.change : t.assign}
          </Button>
          {isLinked && (
            <Button
              variant="text"
              size="sm"
              disabled={write.isSaving}
              onClick={() => {
                write.reset();
                setIsUnlinkOpen(true);
              }}
            >
              {t.unlink}
            </Button>
          )}
        </div>
      )}

      {isEditing && (
        <div className="users-roles-worker-link-edit">
          <div className="users-roles-worker-link-edit-row">
            <TextField
              size="sm"
              label={isLinked ? t.inputChange : t.inputAssign}
              value={workerNo}
              onChange={(event) => {
                setWorkerNo(event.target.value);
              }}
              disabled={write.isSaving}
              error={localError ?? undefined}
            />
            <Button
              size="sm"
              loading={write.isSaving}
              disabled={write.isSaving}
              onClick={() => void submit()}
            >
              {isLinked ? t.confirmChange : t.confirmAssign}
            </Button>
            <Button
              variant="outlined"
              size="sm"
              disabled={write.isSaving}
              onClick={() => {
                write.reset();
                closeEdit();
              }}
            >
              {messages.common.cancel}
            </Button>
          </div>
          <p className="field-note">{t.immediateNote}</p>
        </div>
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
        <p>{t.unlinkConfirmBody(`${current?.workerNo ?? ''} · ${current?.workerName ?? ''}`)}</p>
        {isUnlinkOpen && <p className="field-note">{t.immediateNote}</p>}
      </Dialog>
    </section>
  );
};
