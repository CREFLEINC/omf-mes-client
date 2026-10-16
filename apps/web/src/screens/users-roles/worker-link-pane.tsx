import { Button, TextField } from '@crefle/web-ui';
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

export interface WorkerLinkPaneProps {
  appUserId: number;
}

/**
 * 계정 ↔ 작업자(사번) 연결 구획(omf-all-around#104 · 서버 선행 P-38).
 *
 * 관리웹 IQC 판정은 계정에 연결된 작업자를 검사자로 남긴다 — 연결이 없으면 저장이 막힌다.
 * 연결 편집 자리가 없어 DB 에 직접 넣어 왔던 것을 사용자 관리로 옮긴다.
 *
 * **사번으로 연결한다.** 재직자 중 그 사번을 찾아 그 작업자로 치환한다 — 목록에서 고르게 하면
 * 사업부 전체 작업자를 한 번에 내려받아야 한다. 한 작업자가 다른 계정에 이미 연결돼 있으면 서버가 400 으로 막는다.
 */
export const WorkerLinkPane = ({ appUserId }: WorkerLinkPaneProps) => {
  const { client } = useApiClient();
  const queryClient = useQueryClient();
  const [workerNo, setWorkerNo] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const link = useQuery({
    queryKey: workerLinkKey(appUserId),
    queryFn: () =>
      runRequest(() =>
        client.GET('/app/users/{appUserId}/worker', { params: { path: { appUserId } } }),
      ),
  });

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

  const current = link.data;
  const isLinked = current !== undefined && current.workerId !== null;

  return (
    <section className="pane" aria-label={t.heading}>
      <h3>{t.heading}</h3>
      <p className="field-note">{t.note}</p>
      {link.isError && <LoadErrorBanner error={link.error} onRetry={() => void link.refetch()} />}
      <SaveErrorBanner error={write.error} />
      <dl>
        <dt className="field-label">{t.current}</dt>
        <dd>{isLinked ? `${current.workerNo ?? ''} · ${current.workerName ?? ''}` : t.none}</dd>
      </dl>
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
        {t.link}
      </Button>
      {isLinked && (
        <Button
          variant="outlined"
          disabled={write.isSaving}
          onClick={() => {
            write.write(null);
          }}
        >
          {t.unlink}
        </Button>
      )}
    </section>
  );
};
