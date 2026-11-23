import { Button, useToast } from '@crefle/web-ui';
import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { requireIfMatch, SaveErrorBanner, useMasterWrite } from '../../patterns/master';
import { runRequest } from '../../patterns/request';
import { dispositionTypeLabel } from './disposition-codes';
import { dispositionKeys, nonconformanceDetailPath } from './queries';

export type DispositionApproval = components['schemas']['DispositionApproval'];
type DispositionApprovalApplied = components['schemas']['DispositionApprovalApplied'];

const t = messages.dispositionDecision.approval;
const PENDING = 'PENDING';

/** 이 부적합의 폐기 · 선별 처분 결재(omf-all-around#352) — 최근 것이 앞이다. */
export const useDispositionApprovals = (nonconformanceId: number | null) => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: [...dispositionKeys.all, 'disposition-approvals', nonconformanceId ?? 0] as const,
    enabled: nonconformanceId !== null,
    queryFn: () =>
      runRequest(() =>
        client.GET('/quality/nonconformances/{nonconformanceId}/disposition-approvals', {
          params: { path: { nonconformanceId: nonconformanceId as number } },
        }),
      ).then((data) => data.items),
  });
};

/** 적용 전 처분 결재 — 있으면 처분 판정 자리에 아래 상자만 선다(특채와 같다). */
export const pendingDispositionApprovalOf = (
  rows: readonly DispositionApproval[] | undefined,
): DispositionApproval | undefined => rows?.find((row) => row.statusCode === PENDING);

export interface PendingDispositionApprovalBoxProps {
  approval: DispositionApproval;
}

/**
 * 처분 판정 상자의 「적용 전 처분 결재」 줄 — 결재 대기면 안내만, 승인이면 [처분 적용], 반려면 [반려 확인](적용 경로가 반려를 닫는다).
 * 특채의 `PendingConcessionBox` 와 같은 모양이다(omf-all-around#352).
 */
export const PendingDispositionApprovalBox = ({ approval }: PendingDispositionApprovalBoxProps) => {
  const { client } = useApiClient();
  const toast = useToast();
  const applyWrite = useMasterWrite<{ dispositionApprovalId: number }, DispositionApprovalApplied>({
    request: ({ dispositionApprovalId }, headers) =>
      client.POST('/quality/disposition-approvals/{dispositionApprovalId}:apply', {
        params: {
          path: { dispositionApprovalId },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'If-Match': requireIfMatch(headers),
          },
        },
      }),
    /* 잠그는 대상은 부적합이다 — 판정 저장과 같은 토큰을 담는다. */
    etagPath: nonconformanceDetailPath(approval.nonconformanceId),
    invalidateKeys: [dispositionKeys.all],
    knownFields: [],
    keyLifetime: 'until-applied',
    /* 적용하면 이 상자가 사라진다(대기 행이 없어진다) — 결과는 상자 밖 알림으로 알린다. */
    onSuccess: (data) =>
      toast.show({
        variant: 'success',
        description: data.dispositionApproval.statusCode === 'REJECTED' ? t.rejected : t.applied,
      }),
  });
  const status = approval.approvalStatusCode;
  const decided = status === 'APPROVED' || status === 'REJECTED';
  const typeLabel = dispositionTypeLabel(approval.dispositionTypeCode);

  return (
    <div
      className="iqc-inspection-action-note disposition-pending-concession"
      data-tone={status === 'APPROVED' ? 'success' : 'warning'}
      role="status"
    >
      <span>
        {status === 'APPROVED'
          ? t.approvedBanner(typeLabel)
          : status === 'REJECTED'
            ? t.rejectedBanner(typeLabel)
            : t.pendingBanner(typeLabel)}
      </span>
      {decided ? (
        <Button
          size="sm"
          variant={status === 'APPROVED' ? 'filled' : 'outlined'}
          loading={applyWrite.isSaving}
          onClick={() =>
            applyWrite.write({ dispositionApprovalId: approval.dispositionApprovalId })
          }
        >
          {status === 'APPROVED' ? t.apply : t.close}
        </Button>
      ) : null}
      <SaveErrorBanner error={applyWrite.error} />
    </div>
  );
};
