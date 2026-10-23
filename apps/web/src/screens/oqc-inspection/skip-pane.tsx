import { AlertBanner, Button, Dialog, Icon, TextArea } from '@crefle/web-ui';
import type { components, paths } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useQuery } from '@tanstack/react-query';
import { Fragment, useEffect, useId, useState } from 'react';
import { useNavigate } from 'react-router';

import { useApiClient } from '../../patterns/api-context';
import { SaveErrorBanner, useMasterWrite } from '../../patterns/master';
import { runRequest } from '../../patterns/request';
import { FieldLabel } from './field-label';
import { oqcInspectionKeys } from './queries';

type ApprovalQuery = NonNullable<paths['/app/approval-requests']['get']['parameters']['query']>;
type ShipmentRequest = components['schemas']['ShipmentRequest'];

const t = messages.oqcInspection.skip;
/** 결재 유형 — 서버 선행 값이다(P-83). 생성 타입의 enum 에 아직 없어 넓혀 보낸다(W-03-09 필터와 같은 방식). */
const OQC_SKIP = 'OQC_SKIP' as ApprovalQuery['approvalTypeCode'];
/** 결재 대상 유형 — 이것도 서버 선행 값이다(P-83). */
const SHIPMENT_REQUEST = 'SHIPMENT_REQUEST' as ApprovalQuery['targetTypeCode'];
const OPEN_OR_SKIPPED: readonly string[] = ['REQUESTED', 'IN_PROGRESS', 'SKIPPED'];

const skipApprovalKey = (shipmentRequestId: number) =>
  [...oqcInspectionKeys.all, 'skip-approval', shipmentRequestId] as const;

export interface SkipPaneProps {
  shipmentRequestId: number;
  /** 의뢰 상태. 생략(SKIPPED)으로 닫혔으면 그 사실만 말한다. */
  requestStatusCode: string;
}

/**
 * W-04-03 의 「OQC 생략」 구획(omf-all-around#119 · 서버 선행 P-83 · 결정 D3).
 *
 * ⭐ 요청 → 결재(W-03-09 「특채·한도승인 승인 처리」) → 실행. 이 구획은 요청과 실행만 한다(공유계약 J-8).
 * ⭐ 단위는 출하작업지시다 — 실행하면 그 출하작업지시의 열린 OQC 의뢰가 함께 생략된다(D4).
 * ⛔ 확정 회차가 있는 의뢰에는 세우지 않는다 — 판정이 난 의뢰를 생략으로 덮지 않는다(서버도 400).
 */
export const SkipPane = ({ shipmentRequestId, requestStatusCode }: SkipPaneProps) => {
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
  }, [shipmentRequestId]);

  const approval = useQuery({
    queryKey: skipApprovalKey(shipmentRequestId),
    enabled: requestStatusCode !== 'SKIPPED',
    queryFn: () =>
      runRequest(() =>
        client.GET('/app/approval-requests', {
          params: {
            query: {
              approvalTypeCode: OQC_SKIP,
              targetTypeCode: SHIPMENT_REQUEST,
              targetId: shipmentRequestId,
              page: 1,
              size: 20,
            },
          },
        }),
      ).then((response) => response.items[0] ?? null),
  });

  const requestWrite = useMasterWrite<{ reason: string }, { approvalRequestId: number }>({
    request: (body, headers) =>
      client.POST('/logistics/shipment-requests/{shipmentRequestId}:request-oqc-skip', {
        params: {
          path: { shipmentRequestId },
          header: { 'Idempotency-Key': headers['Idempotency-Key'] },
        },
        body,
      }),
    etagPath: null,
    invalidateKeys: [skipApprovalKey(shipmentRequestId)],
    knownFields: ['reason'],
    keyLifetime: 'until-applied',
    onSuccess: () => {
      setReason('');
      setTouched(false);
      setIsDialogOpen(false);
      setNotice(t.requested);
    },
  });

  const executeWrite = useMasterWrite<Record<string, never>, ShipmentRequest>({
    request: (_body, headers) =>
      client.POST('/logistics/shipment-requests/{shipmentRequestId}:skip-oqc', {
        params: {
          path: { shipmentRequestId },
          header: { 'Idempotency-Key': headers['Idempotency-Key'] },
        },
      }),
    etagPath: null,
    /* 실행은 이 출하작업지시의 의뢰를 함께 닫는다 — 목록·상세를 다시 부른다. */
    invalidateKeys: [oqcInspectionKeys.all],
    knownFields: [],
    keyLifetime: 'until-applied',
    onSuccess: () => setNotice(t.executed),
  });

  /* 끝난(완료·취소) 의뢰에는 세우지 않는다 — 생략할 것이 없다. */
  if (!OPEN_OR_SKIPPED.includes(requestStatusCode)) return null;
  if (requestStatusCode === 'SKIPPED') {
    return (
      <section className="oqc-inspection-section oqc-inspection-skip" aria-label={t.heading}>
        <h3>{t.heading}</h3>
        <AlertBanner variant="info" title={notice ?? t.skipped} />
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
    <section className="oqc-inspection-section oqc-inspection-skip" aria-label={t.heading}>
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
