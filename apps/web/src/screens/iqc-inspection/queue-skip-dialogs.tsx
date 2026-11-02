import { AlertBanner, Button, Dialog, TextArea, useToast } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { useApiClient } from '../../patterns/api-context';
import { INSPECTION_HUB_COUNTS_KEY } from '../../patterns/inspection-hub-counts';
import { SaveErrorBanner, useMasterWrite } from '../../patterns/master';
import { FieldLabel } from '../oqc-inspection/field-label';
import {
  qualityApprovalKeys,
  requestDetailPath,
  useApprovalRequestDetail,
} from '../quality-approval/queries';
import type { ApprovalRequestDetail } from '../quality-approval/types';
import { iqcSkipApprovalKeys } from '../iqc-skip-approval/queries';
import { iqcInspectionKeys } from './queries';

const t = messages.iqcInspection.skip;
const d = messages.iqcInspection.queue.skipDialog;

/**
 * 창은 문서 맨 끝에 그린다 — 표 칸 안에 두면 칸의 정렬·말줄임·넘침 숨김을 물려받아 창이 잘린다(#225).
 */
const Floating = ({ children }: { children: ReactNode }) => createPortal(children, document.body);

export interface SkipDialogProps {
  lotId: number;
  /** 그 LOT 의 생략 결재 조회 열쇠 — 처리 뒤 줄의 단추를 다시 정한다. */
  approvalKey: readonly unknown[];
  onClose: () => void;
}

/** 「생략 요청」 창 — 사유를 받아 사번과 함께 요청한다(상세 구획 #212 와 같은 요청). */
export const SkipRequestDialog = ({
  lotId,
  approvalKey,
  workerNo,
  onClose,
}: SkipDialogProps & { workerNo: string }) => {
  const { client } = useApiClient();
  const toast = useToast();
  const reasonId = useId();
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);

  const write = useMasterWrite<{ reason: string }, unknown>({
    request: (body, headers) =>
      client.POST('/trace/lots/{lotId}:request-iqc-skip', {
        params: {
          path: { lotId },
          header: { 'Idempotency-Key': headers['Idempotency-Key'], 'X-Worker-No': workerNo },
        },
        body,
      }),
    etagPath: null,
    invalidateKeys: [approvalKey, qualityApprovalKeys.all, iqcSkipApprovalKeys.all],
    knownFields: ['reason'],
    keyLifetime: 'until-applied',
    onSuccess: () => {
      toast.show({ variant: 'success', description: t.requested });
      onClose();
    },
  });

  const close = (): void => {
    if (!write.isSaving) onClose();
  };
  const submit = (): void => {
    setTouched(true);
    if (reason.trim() === '') return;
    write.write({ reason: reason.trim() });
  };

  return (
    <Floating>
      <Dialog
        open
        onClose={close}
        showCloseButton={false}
        title={t.heading}
        footer={
          <>
            <Button
              variant="outlined"
              className="app-button-neutral"
              disabled={write.isSaving}
              onClick={close}
            >
              {t.cancel}
            </Button>
            <Button variant="filled" disabled={write.isSaving} onClick={submit}>
              {write.isSaving ? t.requesting : t.request}
            </Button>
          </>
        }
      >
        <div className="oqc-inspection-skip-dialog">
          <p className="oqc-inspection-skip-result">{d.requestResult}</p>
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
            error={
              (touched && reason.trim() === '' ? t.reasonRequired : undefined) ??
              write.fieldErrors.reason
            }
            disabled={write.isSaving}
          />
          <p className="oqc-inspection-skip-count">{t.reasonCount(reason.length)}</p>
          <SaveErrorBanner error={write.error} />
        </div>
      </Dialog>
    </Floating>
  );
};

type Decision = { action: 'approve' | 'reject'; comment: string };

/**
 * 「승인 처리」 창 — 품질 승인 처리 화면(W-03-09)으로 옮기지 않고 그 자리에서 승인·반려한다(#225).
 * 결재 API·버전 확인(If-Match)·차례 확인은 그 화면과 같다 — 내 차례가 아니면 처리 단추를 잠근다.
 */
export const SkipApproveDialog = ({
  approvalRequestId,
  approvalKey,
  onClose,
}: Omit<SkipDialogProps, 'lotId'> & { approvalRequestId: number }) => {
  const { client } = useApiClient();
  const toast = useToast();
  const commentId = useId();
  const detail = useApprovalRequestDetail(approvalRequestId);
  const [comment, setComment] = useState('');
  const [touched, setTouched] = useState(false);
  const sent = useRef<Decision['action'] | null>(null);

  const write = useMasterWrite<Decision, ApprovalRequestDetail>({
    request: (variables, headers) => {
      const params = {
        path: { approvalRequestId },
        header: {
          'Idempotency-Key': headers['Idempotency-Key'],
          'If-Match': headers['If-Match'] ?? '',
        },
      };
      return variables.action === 'approve'
        ? client.POST('/app/approval-requests/{approvalRequestId}:approve', {
            params,
            body: { comment: variables.comment },
          })
        : client.POST('/app/approval-requests/{approvalRequestId}:reject', {
            params,
            body: { comment: variables.comment },
          });
    },
    etagPath: requestDetailPath(approvalRequestId),
    invalidateKeys: [approvalKey, qualityApprovalKeys.all, iqcSkipApprovalKeys.all],
    knownFields: ['comment'],
    keyLifetime: 'until-applied',
    onSuccess: () => {
      toast.show({
        variant: 'success',
        description: sent.current === 'reject' ? d.rejected : d.approved,
      });
      onClose();
    },
  });

  const request = detail.data?.request;
  const isMyTurn = request?.isMyTurn === true;
  const isLocked = write.isSaving || !isMyTurn;
  const close = (): void => {
    if (!write.isSaving) onClose();
  };
  const decide = (action: Decision['action']): void => {
    setTouched(true);
    if (comment.trim() === '') return;
    sent.current = action;
    write.write({ action, comment: comment.trim() });
  };

  return (
    <Floating>
      <Dialog
        open
        onClose={close}
        showCloseButton={false}
        title={d.approveTitle}
        footer={
          <>
            <Button
              variant="outlined"
              className="app-button-neutral"
              disabled={write.isSaving}
              onClick={close}
            >
              {t.cancel}
            </Button>
            <Button variant="outlined" disabled={isLocked} onClick={() => decide('reject')}>
              {d.reject}
            </Button>
            <Button variant="filled" disabled={isLocked} onClick={() => decide('approve')}>
              {d.approve}
            </Button>
          </>
        }
      >
        <div className="oqc-inspection-skip-dialog">
          {detail.isPending ? (
            <p className="field-note">{d.loading}</p>
          ) : detail.isError || request === undefined ? (
            <AlertBanner variant="error" title={d.loadFailed} />
          ) : (
            <>
              <dl className="iqc-inspection-skip-approval-summary">
                <dt>{d.requestNo}</dt>
                <dd>{request.approvalRequestNo}</dd>
                <dt>{d.requester}</dt>
                <dd>{request.requestedByName ?? messages.iqcInspection.queue.emptyValue}</dd>
                <dt>{d.reason}</dt>
                <dd>{request.reason}</dd>
              </dl>
              {!isMyTurn && <p className="field-note">{d.notMyTurn}</p>}
              <FieldLabel htmlFor={commentId} label={d.comment} required />
              <TextArea
                id={commentId}
                containerClassName={
                  isMyTurn && comment.trim() === ''
                    ? 'oqc-inspection-skip-reason is-required-empty'
                    : 'oqc-inspection-skip-reason'
                }
                placeholder={d.commentPlaceholder}
                rows={4}
                fullWidth
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                error={
                  (touched && comment.trim() === '' ? d.commentRequired : undefined) ??
                  write.fieldErrors.comment
                }
                disabled={isLocked}
              />
            </>
          )}
          <SaveErrorBanner error={write.error} />
        </div>
      </Dialog>
    </Floating>
  );
};

/** 「생략 실행」 창 — 바로 실행하지 않고 한 번 묻는다(되돌릴 수 없다 · #225). 실행 API 는 상세 구획(#212)과 같다. */
export const SkipExecuteDialog = ({ lotId, onClose }: Omit<SkipDialogProps, 'approvalKey'>) => {
  const { client } = useApiClient();
  const toast = useToast();

  const write = useMasterWrite<Record<string, never>, unknown>({
    request: (_body, headers) =>
      client.POST('/trace/lots/{lotId}:skip-iqc', {
        params: { path: { lotId }, header: { 'Idempotency-Key': headers['Idempotency-Key'] } },
      }),
    etagPath: null,
    invalidateKeys: [
      iqcInspectionKeys.all,
      INSPECTION_HUB_COUNTS_KEY,
      qualityApprovalKeys.all,
      iqcSkipApprovalKeys.all,
    ],
    knownFields: [],
    keyLifetime: 'until-applied',
    onSuccess: () => {
      toast.show({ variant: 'success', description: t.executed });
      onClose();
    },
  });

  const close = (): void => {
    if (!write.isSaving) onClose();
  };

  return (
    <Floating>
      <Dialog
        open
        onClose={close}
        showCloseButton={false}
        size="lg"
        title={d.executeTitle}
        footer={
          <>
            <Button
              variant="outlined"
              className="app-button-neutral"
              disabled={write.isSaving}
              onClick={close}
            >
              {t.cancel}
            </Button>
            <Button variant="filled" disabled={write.isSaving} onClick={() => write.write({})}>
              {write.isSaving ? t.executing : d.execute}
            </Button>
          </>
        }
      >
        <div className="oqc-inspection-skip-dialog">
          <p className="oqc-inspection-skip-result">{d.executeBody}</p>
          <SaveErrorBanner error={write.error} />
        </div>
      </Dialog>
    </Floating>
  );
};
