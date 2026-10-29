import { AlertBanner, Button, Dialog, Icon, TextArea } from '@crefle/web-ui';
import type { paths } from '@omf-mes/api-client';
import { useQuery } from '@tanstack/react-query';
import { Fragment, useEffect, useId, useState } from 'react';
import { useNavigate } from 'react-router';

import { useApiClient } from '../../patterns/api-context';
import { SaveErrorBanner, useMasterWrite, type MasterWriteOptions } from '../../patterns/master';
import { runRequest } from '../../patterns/request';
import { FieldLabel } from '../oqc-inspection/field-label';

type ApprovalQuery = NonNullable<paths['/app/approval-requests']['get']['parameters']['query']>;

/** 구획 문구 — PQC·IQC 가 같은 모양의 묶음을 낸다(`pqcInspectionRegister.skip` · `iqcInspection.skip`). */
export interface InspectionSkipTexts {
  heading: string;
  steps: readonly string[];
  result: string;
  reason: string;
  reasonPlaceholder: string;
  openApproval: string;
  currentStep: string;
  reasonCount: (count: number) => string;
  reasonRequired: string;
  openRequest: string;
  cancel: string;
  request: string;
  requesting: string;
  execute: string;
  executing: string;
  requested: string;
  pending: string;
  approved: string;
  rejected: string;
  executed: string;
  skipped: string;
  skippedDefault: string;
  loading: string;
  loadFailed: string;
}

const OPEN_OR_SKIPPED: readonly string[] = ['REQUESTED', 'IN_PROGRESS', 'SKIPPED'];

export interface InspectionSkipPaneProps {
  texts: InspectionSkipTexts;
  /** 결재 유형·대상 — 서버 선행 값이 있어 생성 타입의 enum 보다 넓혀 받는다(OQC 생략 구획과 같은 방식). */
  approvalTypeCode: string;
  targetTypeCode: string;
  /** 생략 단위 — PQC 는 작업지시, IQC 는 입하 LOT. 결재를 찾고 요청·실행을 보내는 대상이다. */
  targetId: number;
  /** 의뢰 상태. 생략(SKIPPED)으로 닫혔으면 그 사실만 말한다. */
  requestStatusCode: string;
  /** 생략 근거 — 기본 생략(DEFAULT)이면 결재 없이 처음부터 생략된 것이라 그렇게 말한다. */
  skipBasisCode: string | null;
  requestSkip: MasterWriteOptions<{ reason: string }, unknown>['request'];
  executeSkip: MasterWriteOptions<Record<string, never>, unknown>['request'];
  /** 결재 상태 캐시 열쇠의 앞머리 — 실행 뒤 목록과 함께 무효화된다. */
  queryKeyRoot: readonly unknown[];
  /** 실행 뒤 다시 부를 목록·상세. */
  invalidateKeys: readonly (readonly unknown[])[];
  /** 요청을 못 하는 사유(예: 계정에 연결된 작업자 없음). 있으면 「생략 요청」 단추 대신 이 안내가 선다. */
  requestBlockedReason?: string | null;
}

/**
 * 검사 생략 구획 — 요청 → 결재(W-03-09 「특채·한도승인 승인 처리」) → 실행(omf-all-around#212 · 서버 선행 P-152).
 * OQC 생략 구획(`oqc-inspection/skip-pane.tsx` · #136)과 같은 모양이다. PQC(작업지시)·IQC(입하 LOT)가 쓴다.
 * ⛔ 확정 회차가 있는 의뢰에는 세우지 않는다 — 판정이 난 의뢰를 생략으로 덮지 않는다(서버도 400). 거르는 것은 부르는 화면 몫이다.
 */
export const InspectionSkipPane = ({
  texts: t,
  approvalTypeCode,
  targetTypeCode,
  targetId,
  requestStatusCode,
  skipBasisCode,
  requestSkip,
  executeSkip,
  queryKeyRoot,
  invalidateKeys,
  requestBlockedReason = null,
}: InspectionSkipPaneProps) => {
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
  }, [targetId]);

  const approvalKey = [...queryKeyRoot, 'skip-approval', approvalTypeCode, targetId] as const;
  const approval = useQuery({
    queryKey: approvalKey,
    enabled: requestStatusCode !== 'SKIPPED',
    queryFn: () =>
      runRequest(() =>
        client.GET('/app/approval-requests', {
          params: {
            query: {
              approvalTypeCode: approvalTypeCode as ApprovalQuery['approvalTypeCode'],
              targetTypeCode: targetTypeCode as ApprovalQuery['targetTypeCode'],
              targetId,
              page: 1,
              size: 20,
            },
          },
        }),
      ).then((response) => response.items[0] ?? null),
  });

  const requestWrite = useMasterWrite<{ reason: string }, unknown>({
    request: requestSkip,
    etagPath: null,
    invalidateKeys: [approvalKey],
    knownFields: ['reason'],
    keyLifetime: 'until-applied',
    onSuccess: () => {
      setReason('');
      setTouched(false);
      setIsDialogOpen(false);
      setNotice(t.requested);
    },
  });

  const executeWrite = useMasterWrite<Record<string, never>, unknown>({
    request: executeSkip,
    etagPath: null,
    invalidateKeys,
    knownFields: [],
    keyLifetime: 'until-applied',
    onSuccess: () => setNotice(t.executed),
  });

  /* 끝난(완료·취소) 의뢰에는 세우지 않는다 — 생략할 것이 없다. */
  if (!OPEN_OR_SKIPPED.includes(requestStatusCode)) return null;
  if (requestStatusCode === 'SKIPPED') {
    return (
      <section
        className="oqc-inspection-section oqc-inspection-skip inspection-skip-section"
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
      className="oqc-inspection-section oqc-inspection-skip inspection-skip-section"
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
          {!approval.isPending &&
            !approval.isError &&
            canRequest &&
            requestBlockedReason === null && (
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
          {/* 요청한 그 건을 골라 결재 화면을 연다 — 단계 상자 안 오른쪽, 「생략 요청」 단추 자리(#136 · 담당자 지시 2026-10-29). */}
          {!approval.isPending && !approval.isError && status === 'PENDING' && latest !== null && (
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

      {!approval.isPending && !approval.isError && canRequest && requestBlockedReason !== null && (
        <p className="field-note">{requestBlockedReason}</p>
      )}

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
