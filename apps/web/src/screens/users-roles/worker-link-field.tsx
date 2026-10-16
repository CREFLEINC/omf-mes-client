import { Button, Chip, Dialog, TextField, useToast } from '@crefle/web-ui';
import type { AppUserWorker } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { SaveErrorBanner, useMasterWrite } from '../../patterns/master';
import { runRequest } from '../../patterns/request';
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
 * 계정 ↔ 작업자 지정 — 사용자 정보 카드 안의 한 줄(omf-all-around#104 · 서버 선행 P-38 · 담당자 지시 2026-10-16).
 *
 * 관리웹 IQC 판정은 계정에 지정된 작업자를 검사자로 남긴다 — 지정이 없으면 저장이 막힌다.
 *
 * **지정 상태가 한눈에 보여야 한다**(담당자 지시) — 지정됨이면 배지와 사번·이름·소속을, 미지정이면 배지와
 * 지정 안내를 낸다. 지정·해제는 폼의 저장과 따로 바로 서버에 나가므로 그 사실을 밝히고, 성공하면 알림을 띄운다.
 *
 * **사번으로 지정한다.** 재직자 중 그 사번을 찾아 그 작업자로 치환한다 — 목록에서 고르게 하면
 * 사업부 전체 작업자를 한 번에 내려받아야 한다. 한 작업자가 다른 계정에 이미 지정돼 있으면 서버가 400 으로 막는다.
 */
export const WorkerLinkField = ({ appUserId, departmentLabel }: WorkerLinkFieldProps) => {
  const { client } = useApiClient();
  const queryClient = useQueryClient();
  const toast = useToast();
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

  /* 소속은 연결 응답에 없다 — 지정된 작업자의 상세에서 부서를 읽는다. */
  const detail = useQuery({
    queryKey: workerDetailKey(linkedId ?? 0),
    enabled: linkedId !== null,
    queryFn: () =>
      runRequest(() =>
        client.GET('/mdm/workers/{workerId}', { params: { path: { workerId: linkedId ?? 0 } } }),
      ),
  });

  const departmentOf = (): string => {
    const departmentId = detail.data?.worker.departmentId ?? null;

    return departmentId === null ? t.noDepartment : departmentLabel(departmentId);
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
      setWorkerNo('');
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

  const connect = async (): Promise<void> => {
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
    <div className="users-roles-worker-link" role="group" aria-label={t.label}>
      {link.isError && <LoadErrorBanner error={link.error} onRetry={() => void link.refetch()} />}
      {!isUnlinkOpen && <SaveErrorBanner error={write.error} />}

      <div className="users-roles-worker-link-status">
        <span className="field-label">{t.label}</span>
        {current !== undefined && (
          <Chip variant="status" size="sm" status={isLinked ? 'success' : 'warning'}>
            {isLinked ? t.linked : t.unlinked}
          </Chip>
        )}
        {isLinked && (
          <strong>
            {t.summary(current.workerNo ?? '', current.workerName ?? '', departmentOf())}
          </strong>
        )}
        {/* 해제는 상태 바로 옆에 둔다 — 어디서 푸는지 묻지 않게(담당자 지시 2026-10-16). 확인 창을 거친다. */}
        {isLinked && (
          <Button
            variant="outlined"
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
      {current !== undefined && !isLinked && <p className="field-note">{t.unlinkedGuide}</p>}

      <div className="users-roles-worker-link-edit">
        <TextField
          label={t.workerNo}
          value={workerNo}
          onChange={(event) => {
            setWorkerNo(event.target.value);
          }}
          disabled={write.isSaving}
          error={localError ?? undefined}
        />
        <Button loading={write.isSaving} disabled={write.isSaving} onClick={() => void connect()}>
          {isLinked ? t.change : t.link}
        </Button>
      </div>
      <p className="field-note">{t.immediateNote}</p>

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
      </Dialog>
    </div>
  );
};
