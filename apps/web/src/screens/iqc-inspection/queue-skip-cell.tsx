import { Button, Dialog, TextArea, useToast } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useQuery } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { useNavigate } from 'react-router';

import { useApiClient } from '../../patterns/api-context';
import { INSPECTION_HUB_COUNTS_KEY } from '../../patterns/inspection-hub-counts';
import { SaveErrorBanner, useMasterWrite } from '../../patterns/master';
import { runRequest } from '../../patterns/request';
import { FieldLabel } from '../oqc-inspection/field-label';
import { iqcInspectionKeys } from './queries';

const t = messages.iqcInspection.skip;
const q = messages.iqcInspection.queue;

export interface QueueSkipCellProps {
  lotId: number;
  /** 계정에 연결된 작업자의 사번 — 요청이 함께 보낸다(서버가 사번을 요구한다). 없으면 요청 단추가 잠긴다. */
  workerNo: string | null;
}

/**
 * 검사 대기 목록 「생략」 칸(omf-all-around#225) — 상세에 있던 IQC 생략 구획(#212)을 줄로 옮겼다.
 * 그 LOT 의 마지막 IQC_SKIP 결재 상태로 단추 하나를 세운다: 없음·반려 → 「생략 요청」, 결재 중 → 「승인 처리」,
 * 승인 → 「생략 실행」. 요청·실행 API 와 결재 조회는 상세 구획(`inspection-skip/skip-pane.tsx`)과 같다.
 */
export const QueueSkipCell = ({ lotId, workerNo }: QueueSkipCellProps) => {
  const { client } = useApiClient();
  const toast = useToast();
  const navigate = useNavigate();
  const reasonId = useId();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const [isExecuteErrorOpen, setIsExecuteErrorOpen] = useState(false);

  /* 상세 구획과 같은 열쇠 — 부품 IQC 화면의 구획과 캐시를 나눠 쓴다. */
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

  const requestWrite = useMasterWrite<{ reason: string }, unknown>({
    request: (body, headers) =>
      client.POST('/trace/lots/{lotId}:request-iqc-skip', {
        params: {
          path: { lotId },
          header: { 'Idempotency-Key': headers['Idempotency-Key'], 'X-Worker-No': workerNo ?? '' },
        },
        body,
      }),
    etagPath: null,
    invalidateKeys: [approvalKey],
    knownFields: ['reason'],
    keyLifetime: 'until-applied',
    onSuccess: () => {
      setReason('');
      setTouched(false);
      setIsDialogOpen(false);
      toast.show({ variant: 'success', description: t.requested });
    },
  });

  const executeWrite = useMasterWrite<Record<string, never>, unknown>({
    request: (_body, headers) =>
      client.POST('/trace/lots/{lotId}:skip-iqc', {
        params: { path: { lotId }, header: { 'Idempotency-Key': headers['Idempotency-Key'] } },
      }),
    etagPath: null,
    invalidateKeys: [iqcInspectionKeys.all, INSPECTION_HUB_COUNTS_KEY],
    knownFields: [],
    keyLifetime: 'until-applied',
    onSuccess: () => toast.show({ variant: 'success', description: t.executed }),
  });

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

  if (status === 'PENDING' && latest !== null) {
    return (
      <Button
        type="button"
        variant="outlined"
        size="sm"
        title={t.pending}
        onClick={() =>
          void navigate(`/quality/approvals?approvalRequestId=${String(latest.approvalRequestId)}`)
        }
      >
        {q.skipApprove}
      </Button>
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
          disabled={executeWrite.isSaving}
          onClick={() => {
            executeWrite.write({});
            /* 실패 사유는 줄에 둘 자리가 없어 창으로 보인다 — 창은 오류가 있을 때만 선다. */
            setIsExecuteErrorOpen(true);
          }}
        >
          {executeWrite.isSaving ? t.executing : q.skipExecute}
        </Button>
        {isExecuteErrorOpen && executeWrite.error !== null && (
          <Dialog
            open
            onClose={() => setIsExecuteErrorOpen(false)}
            title={t.heading}
            footer={
              <Button variant="outlined" onClick={() => setIsExecuteErrorOpen(false)}>
                {t.cancel}
              </Button>
            }
          >
            <SaveErrorBanner error={executeWrite.error} />
          </Dialog>
        )}
      </>
    );
  }

  /* 결재가 없거나 반려됐다 — 다시 요청할 수 있다. */
  const isSaving = requestWrite.isSaving;
  const reasonError = touched && reason.trim() === '' ? t.reasonRequired : undefined;
  const closeDialog = (): void => {
    if (isSaving) return;
    setIsDialogOpen(false);
    setTouched(false);
  };
  const submit = (): void => {
    setTouched(true);
    if (reason.trim() === '') return;
    requestWrite.write({ reason: reason.trim() });
  };

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
        onClick={() => setIsDialogOpen(true)}
      >
        {q.skipRequest}
      </Button>
      {/* 닫힌 창은 그리지 않는다 — 줄마다 창이 있어 열린 하나만 남긴다. */}
      {isDialogOpen && (
        <Dialog
          open
          onClose={closeDialog}
          showCloseButton={false}
          title={t.heading}
          footer={
            <>
              <Button
                variant="outlined"
                className="app-button-neutral"
                disabled={isSaving}
                onClick={closeDialog}
              >
                {t.cancel}
              </Button>
              <Button variant="filled" disabled={isSaving} onClick={submit}>
                {isSaving ? t.requesting : t.request}
              </Button>
            </>
          }
        >
          <div className="oqc-inspection-skip-dialog">
            <p className="oqc-inspection-skip-result">{t.result}</p>
            <FieldLabel htmlFor={reasonId} label={t.reason} required />
            <TextArea
              id={reasonId}
              containerClassName={
                reason.trim() === ''
                  ? 'oqc-inspection-skip-reason is-required-empty'
                  : 'oqc-inspection-skip-reason'
              }
              placeholder={t.reasonPlaceholder}
              rows={4}
              fullWidth
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              error={reasonError ?? requestWrite.fieldErrors.reason}
              disabled={isSaving}
            />
            <p className="oqc-inspection-skip-count">{t.reasonCount(reason.length)}</p>
            <SaveErrorBanner error={requestWrite.error} />
          </div>
        </Dialog>
      )}
    </>
  );
};
