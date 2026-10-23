import { AlertBanner, Button, Icon, TextArea } from '@crefle/web-ui';
import type { components, paths } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useQuery } from '@tanstack/react-query';
import { Fragment, useEffect, useId, useState } from 'react';

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
  const reasonId = useId();

  useEffect(() => {
    setReason('');
    setNotice(null);
    setTouched(false);
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
        <ol className="oqc-inspection-skip-steps">
          {t.steps.map((step, index) => (
            <Fragment key={step}>
              {index > 0 && <Icon name="arrow_forward" size={16} aria-hidden="true" />}
              <li>{step}</li>
            </Fragment>
          ))}
        </ol>
        <p className="oqc-inspection-skip-result">
          <Icon name="info" size={18} aria-hidden="true" />
          {t.result}
        </p>
      </div>

      {approval.isPending ? (
        <p className="field-note">{t.loading}</p>
      ) : approval.isError ? (
        <AlertBanner variant="error" title={t.loadFailed} />
      ) : status === 'PENDING' ? (
        <AlertBanner variant="info" title={t.pending} />
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

      {!approval.isPending && !approval.isError && canRequest && (
        <>
          {status === 'REJECTED' && <p className="field-note">{t.rejected}</p>}
          <FieldLabel htmlFor={reasonId} label={t.reason} required />
          <TextArea
            id={reasonId}
            placeholder={t.reasonPlaceholder}
            rows={3}
            fullWidth
            showCount
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            error={reasonError ?? requestWrite.fieldErrors.reason}
            disabled={isSaving}
          />
          {/* 요청 단추는 입력칸 오른쪽 아래 — 사유를 쓰고 바로 누른다(#136). */}
          <div className="oqc-inspection-skip-actions">
            <Button variant="outlined" size="md" disabled={isSaving} onClick={submit}>
              {requestWrite.isSaving ? t.requesting : t.request}
            </Button>
          </div>
        </>
      )}

      {notice !== null && <AlertBanner variant="success" title={notice} />}
      <SaveErrorBanner error={requestWrite.error ?? executeWrite.error} />
    </section>
  );
};
