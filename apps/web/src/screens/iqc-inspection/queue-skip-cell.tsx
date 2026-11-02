import { Button, Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { StatusBadge, StatusTone } from '../oqc-inspection/status-badge';
import { iqcInspectionKeys } from './queries';
import { SkipApproveDialog, SkipExecuteDialog, SkipRequestDialog } from './queue-skip-dialogs';

const t = messages.iqcInspection.skip;
const q = messages.iqcInspection.queue;

export interface QueueSkipCellProps {
  lotId: number;
  /** 계정에 연결된 작업자의 사번 — 요청이 함께 보낸다(서버가 사번을 요구한다). 없으면 요청 단추가 잠긴다. */
  workerNo: string | null;
  /** 생략 실행 뒤 함께 새로 읽을 다른 화면의 목록 — 부품 IQC 화면(#225). */
  alsoInvalidate?: readonly (readonly unknown[])[];
}

/**
 * 그 LOT 의 마지막 IQC_SKIP 결재 — 「생략」 칸과 「상태」 칸이 같은 열쇠로 한 번만 읽는다(#225).
 * 상세 구획과 같은 열쇠라 부품 IQC 화면과 캐시를 나눠 쓴다.
 */
const useSkipApproval = (lotId: number) => {
  const { client } = useApiClient();
  const approvalKey = [...iqcInspectionKeys.all, 'skip-approval', 'IQC_SKIP', lotId] as const;
  const approval = useQuery({
    queryKey: approvalKey,
    queryFn: () =>
      runRequest(() =>
        client.GET('/app/approval-requests', {
          params: {
            query: {
              approvalTypeCode: 'IQC_SKIP',
              targetTypeCode: 'INBOUND_LOT',
              targetId: lotId,
              page: 1,
              size: 20,
            },
          },
        }),
      ).then((response) => response.items[0] ?? null),
  });
  return { approvalKey, approval };
};

const SKIP_STATUS_TONE: Record<string, StatusTone> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'error',
};

/**
 * 「상태」 칸(사용자 지시 2026-11-02 · #225) — 생략 결재가 걸린 대기·진행 의뢰는 의뢰 상태 대신
 * 결재 단계(결재 대기·승인·반려)를 보인다. 결재가 없거나 아직 못 읽었으면 의뢰 상태 그대로다. 표시만 바꾼다.
 */
export const QueueStatusCell = ({ lotId, fallback }: { lotId: number; fallback: StatusBadge }) => {
  const { approval } = useSkipApproval(lotId);
  const code = approval.data?.statusCode;
  const label = code === undefined ? undefined : q.skipStatus[code];
  const badge: StatusBadge =
    code !== undefined && label !== undefined
      ? { label, tone: SKIP_STATUS_TONE[code] ?? 'idle' }
      : fallback;

  return (
    <Chip variant="status" size="sm" status={badge.tone}>
      {badge.label}
    </Chip>
  );
};

/**
 * 검사 대기 목록 「생략」 칸(omf-all-around#225) — 상세에 있던 IQC 생략 구획(#212)을 줄로 옮겼다.
 * 그 LOT 의 마지막 IQC_SKIP 결재 상태로 단추 하나를 세우고, 누르면 그 자리에서 창으로 처리한다:
 * 없음·반려 → 「생략 요청」, 결재 중 → 「승인 처리」(승인·반려), 승인 → 「생략 실행」(한 번 묻고 실행).
 */
export const QueueSkipCell = ({ lotId, workerNo, alsoInvalidate }: QueueSkipCellProps) => {
  const [open, setOpen] = useState<'request' | 'approve' | 'execute' | null>(null);

  const { approvalKey, approval } = useSkipApproval(lotId);

  if (approval.isPending) {
    return (
      <span className="field-note" title={t.loading}>
        …
      </span>
    );
  }
  if (approval.isError) {
    return (
      <span className="field-note" title={t.loadFailed}>
        {q.emptyValue}
      </span>
    );
  }

  const latest = approval.data;
  const status = latest?.statusCode ?? null;
  const close = (): void => setOpen(null);

  if (status === 'PENDING' && latest !== null) {
    return (
      <>
        <Button
          type="button"
          variant="outlined"
          size="sm"
          title={t.pending}
          onClick={() => setOpen('approve')}
        >
          {q.skipApprove}
        </Button>
        {open === 'approve' && (
          <SkipApproveDialog
            approvalRequestId={latest.approvalRequestId}
            approvalKey={approvalKey}
            onClose={close}
          />
        )}
      </>
    );
  }

  if (status === 'APPROVED') {
    return (
      <>
        <Button
          type="button"
          variant="filled"
          size="sm"
          title={t.approved}
          onClick={() => setOpen('execute')}
        >
          {q.skipExecute}
        </Button>
        {open === 'execute' && (
          <SkipExecuteDialog lotId={lotId} onClose={close} alsoInvalidate={alsoInvalidate} />
        )}
      </>
    );
  }

  /* 결재가 없거나 반려됐다 — 다시 요청할 수 있다. */
  return (
    <>
      <Button
        type="button"
        variant="outlined"
        size="sm"
        disabled={workerNo === null}
        title={
          workerNo === null ? t.workerNotLinked : status === 'REJECTED' ? t.rejected : undefined
        }
        onClick={() => setOpen('request')}
      >
        {q.skipRequest}
      </Button>
      {open === 'request' && workerNo !== null && (
        <SkipRequestDialog
          lotId={lotId}
          approvalKey={approvalKey}
          workerNo={workerNo}
          onClose={close}
        />
      )}
    </>
  );
};
