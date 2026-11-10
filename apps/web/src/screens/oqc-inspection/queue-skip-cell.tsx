import { Button } from '@crefle/web-ui';
import type { paths } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import {
  SkipApproveDialog,
  SkipExecuteForm,
  SkipRequestForm,
} from '../iqc-inspection/queue-skip-dialogs';
import { oqcInspectionKeys, useInspectionRounds } from './queries';

type ApprovalQuery = NonNullable<paths['/app/approval-requests']['get']['parameters']['query']>;

const t = messages.oqcInspection.skip;
const d = messages.oqcInspection.skipDialog;
const q = messages.iqcInspection.queue;

export interface OqcQueueSkipCellProps {
  inspectionRequestId: number;
  shipmentRequestId: number;
}

/**
 * 목록 「생략」 칸(사용자 지시 2026-11-09 · IQC #225 와 같다) — 상세에 있던 OQC 생략 구획(#119)을 줄로 옮겼다. 단위는 출하작업지시다.
 * 마지막 OQC_SKIP 결재로 단추 하나를 세운다: 없음 · 반려 → 생략 요청, 결재 중 → 승인 처리, 승인 → 생략 실행.
 * ⛔ 확정 회차가 있는 의뢰에는 세우지 않는다 — 판정이 난 의뢰를 생략으로 덮지 않는다(서버도 400).
 */
export const OqcQueueSkipCell = ({
  inspectionRequestId,
  shipmentRequestId,
}: OqcQueueSkipCellProps) => {
  const { client } = useApiClient();
  const [open, setOpen] = useState<'request' | 'approve' | 'execute' | null>(null);
  const rounds = useInspectionRounds(inspectionRequestId);
  const approvalKey = [...oqcInspectionKeys.all, 'skip-approval', shipmentRequestId] as const;
  const approval = useQuery({
    queryKey: approvalKey,
    queryFn: () =>
      runRequest(() =>
        client.GET('/app/approval-requests', {
          params: {
            query: {
              approvalTypeCode: 'OQC_SKIP' as ApprovalQuery['approvalTypeCode'],
              targetTypeCode: 'SHIPMENT_REQUEST' as ApprovalQuery['targetTypeCode'],
              targetId: shipmentRequestId,
              page: 1,
              size: 20,
            },
          },
        }),
      ).then((response) => response.items[0] ?? null),
  });

  if (approval.isPending || rounds.isPending) {
    return (
      <span className="field-note" title={t.loading}>
        …
      </span>
    );
  }
  if (
    approval.isError ||
    rounds.isError ||
    rounds.data.some((row) => row.statusCode === 'CONFIRMED')
  ) {
    return <span title={approval.isError ? t.loadFailed : undefined}>{q.emptyValue}</span>;
  }

  const latest = approval.data;
  const status = latest?.statusCode ?? null;
  const close = (): void => setOpen(null);
  const label =
    status === 'PENDING' ? q.skipApprove : status === 'APPROVED' ? q.skipExecute : q.skipRequest;
  const action = status === 'PENDING' ? 'approve' : status === 'APPROVED' ? 'execute' : 'request';

  return (
    <>
      <Button
        type="button"
        variant={status === 'APPROVED' ? 'filled' : 'outlined'}
        size="sm"
        title={
          status === 'PENDING'
            ? t.pending
            : status === 'APPROVED'
              ? t.approved
              : status === 'REJECTED'
                ? t.rejected
                : undefined
        }
        onClick={() => setOpen(action)}
      >
        {label}
      </Button>
      {open === 'request' && (
        <SkipRequestForm
          texts={t}
          resultText={t.result}
          approvalKey={approvalKey}
          onClose={close}
          send={(body, headers) =>
            client.POST('/logistics/shipment-requests/{shipmentRequestId}:request-oqc-skip', {
              params: {
                path: { shipmentRequestId },
                header: { 'Idempotency-Key': headers['Idempotency-Key'] },
              },
              body,
            })
          }
        />
      )}
      {open === 'approve' && latest !== null && (
        <SkipApproveDialog
          approvalRequestId={latest.approvalRequestId}
          approvalKey={approvalKey}
          onClose={close}
          copy={d}
        />
      )}
      {open === 'execute' && (
        <SkipExecuteForm
          texts={t}
          copy={d}
          onClose={close}
          invalidateKeys={[oqcInspectionKeys.all]}
          send={(_body, headers) =>
            client.POST('/logistics/shipment-requests/{shipmentRequestId}:skip-oqc', {
              params: {
                path: { shipmentRequestId },
                header: { 'Idempotency-Key': headers['Idempotency-Key'] },
              },
            })
          }
        />
      )}
    </>
  );
};
