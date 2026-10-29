import { AlertBanner, Button, Dialog, Icon, TextArea } from '@crefle/web-ui';
import type { components, paths } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useQuery } from '@tanstack/react-query';
import { Fragment, useEffect, useId, useState } from 'react';
import { useNavigate } from 'react-router';

import { useApiClient } from '../../patterns/api-context';
import { SaveErrorBanner, useMasterWrite } from '../../patterns/master';
import { runRequest } from '../../patterns/request';
import { FieldLabel } from '../oqc-inspection/field-label';
import { oqcInspectionKeys } from '../oqc-inspection/queries';
import { pqcInspectionKeys } from '../pqc-inspection/queries';

type ApprovalQuery = NonNullable<paths['/app/approval-requests']['get']['parameters']['query']>;
type WorkOrder = components['schemas']['WorkOrder'];

const t = messages.pqcInspectionRegister.skip;
/** 결재 유형 — 서버 선행 값이다(P-152). 생성 타입의 enum 에 아직 없어 넓혀 보낸다(OQC 생략 구획과 같은 방식). */
const PQC_SKIP = 'PQC_SKIP' as ApprovalQuery['approvalTypeCode'];
/** 결재 대상 유형 — 이것도 서버 선행 값이다(P-152). */
const WORK_ORDER = 'WORK_ORDER' as ApprovalQuery['targetTypeCode'];
const OPEN_OR_SKIPPED: readonly string[] = ['REQUESTED', 'IN_PROGRESS', 'SKIPPED'];

/** 목록(OQC 화면의 질의를 함께 쓴다) 열쇠 아래에 둔다 — 실행 뒤 목록과 함께 다시 부른다. */
const skipApprovalKey = (workOrderId: number) =>
  [...oqcInspectionKeys.all, 'pqc-skip-approval', workOrderId] as const;

export interface PqcSkipPaneProps {
  workOrderId: number;
  /** 의뢰 상태. 생략(SKIPPED)으로 닫혔으면 그 사실만 말한다. */
  requestStatusCode: string;
  /** 생략 근거 — 기본 생략(DEFAULT)이면 결재 없이 처음부터 생략된 것이라 그렇게 말한다. */
  skipBasisCode: string | null;
}

/**
 * W-03-11 의 「PQC 생략」 구획(omf-all-around#212 · 서버 선행 P-152). OQC 생략 구획(`oqc-inspection/skip-pane.tsx`)과 같은 모양이다.
 *
 * ⭐ 요청 → 결재(W-03-09 「특채·한도승인 승인 처리」) → 실행. 이 구획은 요청과 실행만 한다(공유계약 J-8).
 * ⭐ 단위는 작업지시다 — 실행하면 그 작업지시의 열린 PQC 의뢰가 생략되고 검사 대기 생산 LOT 이 정상이 된다.
 * ⛔ 확정 회차가 있는 의뢰에는 세우지 않는다 — 판정이 난 의뢰를 생략으로 덮지 않는다(서버도 400).
 */
export const PqcSkipPane = ({
  workOrderId,
  requestStatusCode,
  skipBasisCode,
}: PqcSkipPaneProps) => {
  const { client } = useApiClient();
  const [reason, setReason] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const reasonId = useId();
  const navigate = useNavigate();

  useEffect(() => {
    setReason('');
    setNotice(null);
    setTouched(false);
    setIsDialogOpen(false);
  }, [workOrderId]);

  const approval = useQuery({
    queryKey: skipApprovalKey(workOrderId),
    enabled: requestStatusCode !== 'SKIPPED',
    queryFn: () =>
      runRequest(() =>
        client.GET('/app/approval-requests', {
          params: {
            query: {
              approvalTypeCode: PQC_SKIP,
              targetTypeCode: WORK_ORDER,
              targetId: workOrderId,
              page: 1,
              size: 20,
            },
          },
        }),
      ).then((response) => response.items[0] ?? null),
  });

  const requestWrite = useMasterWrite<{ reason: string }, { approvalRequestId: number }>({
    request: (body, headers) =>
      client.POST('/production/work-orders/{workOrderId}:request-pqc-skip', {
        params: {
          path: { workOrderId },
          header: { 'Idempotency-Key': headers['Idempotency-Key'] },
        },
        body,
      }),
    etagPath: null,
    invalidateKeys: [skipApprovalKey(workOrderId)],
    knownFields: ['reason'],
    keyLifetime: 'until-applied',
    onSuccess: () => {
      setReason('');
      setTouched(false);
      setIsDialogOpen(false);
      setNotice(t.requested);
    },
  });

  const executeWrite = useMasterWrite<Record<string, never>, WorkOrder>({
    request: (_body, headers) =>
      client.POST('/production/work-orders/{workOrderId}:skip-pqc', {
        params: {
          path: { workOrderId },
          header: { 'Idempotency-Key': headers['Idempotency-Key'] },
        },
      }),
    etagPath: null,
    /* 실행은 이 작업지시의 의뢰를 닫는다 — 목록(OQC 질의)과 상세(PQC 질의)를 다시 부른다. */
    invalidateKeys: [oqcInspectionKeys.all, pqcInspectionKeys.all],
    knownFields: [],
    keyLifetime: 'until-applied',
    onSuccess: () => setNotice(t.executed),
  });

  /* 끝난(완료·취소) 의뢰에는 세우지 않는다 — 생략할 것이 없다. */
  if (!OPEN_OR_SKIPPED.includes(requestStatusCode)) return null;
  if (requestStatusCode === 'SKIPPED') {
    return (
      <section
        className="oqc-inspection-section oqc-inspection-skip pqc-web-skip"
        aria-label={t.heading}
      >
        <h3>{t.heading}</h3>
        <AlertBanner
          variant="info"
          title={notice ?? (skipBasisCode === 'DEFAULT' ? t.skippedDefault : t.skipped)}
        />
      </section>
    );
  }

  const latest = approval.data ?? null;
  const status = latest?.statusCode ?? null;
  const canRequest = status === null || status === 'REJECTED';
  const isSaving = requestWrite.isSaving || executeWrite.isSaving;
  const reasonError = touched && reason.trim() === '' ? t.reasonRequired : undefined;
  /** 지금 단계(0 요청 · 1 승인 · 2 실행). 결재 상태를 아직 모르면 어느 것도 가리키지 않는다(#136). */
  const currentStep =
    approval.isPending || approval.isError ? null : canRequest ? 0 : status === 'PENDING' ? 1 : 2;

  /* 창을 닫으면 쓰던 사유는 남긴다 — 다시 열면 이어 쓴다. 필수 표시만 거둔다. */
  const closeDialog = (): void => {
    /* 요청이 나가 있는 동안에는 닫지 않는다 — 실패하면 그 사유가 창 안에 선다. */
    if (requestWrite.isSaving) return;
    setIsDialogOpen(false);
    setTouched(false);
  };

  const submit = (): void => {
    setTouched(true);
    if (reason.trim() === '') return;
    setNotice(null);
    requestWrite.write({ reason: reason.trim() });
  };

  return (
    <section
      className="oqc-inspection-section oqc-inspection-skip pqc-web-skip"
      aria-label={t.heading}
    >
      <h3>{t.heading}</h3>
      {/* 요청 → 승인 → 실행 단계와 실행 결과(#136). */}
      <div className="oqc-inspection-skip-guide">
        <div className="oqc-inspection-skip-steps-row">
          <ol className="oqc-inspection-skip-steps">
            {t.steps.map((step, index) => (
              <Fragment key={step}>
                {index > 0 && <Icon name="arrow_forward" size={16} aria-hidden="true" />}
                <li
                  aria-current={index === currentStep ? 'step' : undefined}
                  title={index === currentStep ? t.currentStep : undefined}
                >
                  {step}
                </li>
              </Fragment>
            ))}
          </ol>
          {!approval.isPending && !approval.isError && canRequest && (
            <Button
              type="button"
              variant="outlined"
              size="md"
              onClick={() => {
                setNotice(null);
                setIsDialogOpen(true);
              }}
            >
              {t.openRequest}
            </Button>
          )}
        </div>
      </div>

      {approval.isPending ? (
        <p className="field-note">{t.loading}</p>
      ) : approval.isError ? (
        <AlertBanner variant="error" title={t.loadFailed} />
      ) : status === 'PENDING' && latest !== null ? (
        <>
          <AlertBanner variant="info" title={t.pending} />
          {/* 요청한 그 건을 골라 결재 화면을 연다 — 「특채·한도승인 승인 처리」(#136). */}
          <div className="oqc-inspection-skip-actions">
            <Button
              type="button"
              variant="outlined"
              size="md"
              onClick={() =>
                void navigate(
                  `/quality/approvals?approvalRequestId=${String(latest.approvalRequestId)}`,
                )
              }
            >
              {t.openApproval}
            </Button>
          </div>
        </>
      ) : status === 'APPROVED' ? (
        <>
          <AlertBanner variant="info" title={t.approved} />
          <div className="oqc-inspection-skip-actions">
            <Button
              variant="filled"
              size="md"
              disabled={isSaving}
              onClick={() => {
                setNotice(null);
                executeWrite.write({});
              }}
            >
              {executeWrite.isSaving ? t.executing : t.execute}
            </Button>
          </div>
        </>
      ) : null}

      {!approval.isPending && !approval.isError && status === 'REJECTED' && (
        <p className="field-note">{t.rejected}</p>
      )}

      {/* 사유 입력과 요청은 창에서(#136) — 구획에는 단계와 「생략 요청」 단추만 둔다. */}
      <Dialog
        open={isDialogOpen}
        onClose={closeDialog}
        showCloseButton={false}
        title={t.heading}
        footer={
          <>
            <Button
              variant="outlined"
              className="app-button-neutral"
              disabled={requestWrite.isSaving}
              onClick={closeDialog}
            >
              {t.cancel}
            </Button>
            <Button variant="filled" disabled={isSaving} onClick={submit}>
              {requestWrite.isSaving ? t.requesting : t.request}
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
          {/* 글자 수 — DS 기본 표시는 숫자뿐이라 「N자」로 직접 둔다. 상한은 없다(계약 · #136). */}
          <p className="oqc-inspection-skip-count">{t.reasonCount(reason.length)}</p>
          <SaveErrorBanner error={requestWrite.error} />
        </div>
      </Dialog>

      {notice !== null && <AlertBanner variant="success" title={notice} />}
      <SaveErrorBanner error={executeWrite.error} />
    </section>
  );
};
