import { AlertBanner, Button, Skeleton, useToast } from '@crefle/web-ui';
import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { SaveErrorBanner, useMasterWrite } from '../../patterns/master';
import { LocationLabelIssueDialog } from './location-label-issue-dialog';
import { locationLabelKeys, useLatestLocationLabel } from './queries';

type DocumentIssueCreate = components['schemas']['DocumentIssueCreate'];
type DocumentIssueBatchResponse = components['schemas']['DocumentIssueBatchResponse'];

export interface LocationLabelSectionProps {
  locationId: number;
  /** 그림 설명 · 내려받는 파일 이름에 쓴다. */
  locationCode: string;
  reasonOptions: { value: string; label: string }[];
}

const t = messages.warehouseLocation.labelSection;

/**
 * 위치 수정 창 안의 라벨(사용자 지시 2026-10-29) — 목록의 「라벨 이미지 생성」을 걷고 위치를 누르면 여기서 본다.
 * 마지막 회차의 서버 그림을 보이고, 없으면 발행 · 있으면 사유를 받아 재발행한다. 물리 인쇄는 이 화면의 범위가 아니다.
 */
export const LocationLabelSection = ({
  locationId,
  locationCode,
  reasonOptions,
}: LocationLabelSectionProps) => {
  const { client, baseUrl } = useApiClient();
  const toast = useToast();
  const latest = useLatestLocationLabel(locationId);
  const [reissueOpen, setReissueOpen] = useState(false);
  const [reasonCode, setReasonCode] = useState('');
  const [imageFailed, setImageFailed] = useState(false);
  const [retrySeq, setRetrySeq] = useState(0);

  /* 발행은 회차를 올리는 되돌릴 수 없는 쓰기다 — 끊긴 뒤 다시 눌러도 한 번만 발행되게 키를 붙들어 둔다. */
  const issueWrite = useMasterWrite<DocumentIssueCreate, DocumentIssueBatchResponse>({
    request: (body, headers) =>
      client.POST('/app/document-issues', {
        params: { header: { 'Idempotency-Key': headers['Idempotency-Key'] } },
        body,
      }),
    etagPath: null,
    invalidateKeys: [locationLabelKeys.of(locationId)],
    knownFields: ['reissueReasonCode'],
    keyLifetime: 'until-applied',
    onSuccess: () => {
      setReissueOpen(false);
      setImageFailed(false);
      toast.show({ variant: 'success', description: t.issued });
    },
  });

  const issue = (reissueReasonCode?: string): void => {
    issueWrite.write({
      documentTypeCode: 'LOCATION_LABEL',
      targets: [{ targetTypeCode: 'LOCATION', targetId: locationId }],
      ...(reissueReasonCode === undefined ? {} : { reissueReasonCode }),
    });
  };

  const body = () => {
    if (latest.isPending) {
      return (
        <div role="status" aria-label={t.loading}>
          <Skeleton variant="rect" height={160} />
        </div>
      );
    }

    if (latest.isError) {
      return (
        <AlertBanner
          variant="error"
          title={t.listFailed}
          action={
            <Button variant="outlined" size="sm" onClick={() => void latest.refetch()}>
              {messages.common.retry}
            </Button>
          }
        />
      );
    }

    const label = latest.data;
    if (label === null) {
      return (
        <div className="location-label-actions">
          <Button
            variant="outlined"
            loading={issueWrite.isSaving}
            disabled={issueWrite.isSaving}
            onClick={() => issue()}
          >
            {t.issue}
          </Button>
        </div>
      );
    }

    const src = `${baseUrl}/app/document-issues/${String(label.documentIssueLogId)}/rendition?format=png`;

    return (
      <>
        <figure className="location-label-image">
          {imageFailed ? (
            <div className="location-label-failed">
              <p>{t.imageFailed}</p>
              <Button
                variant="outlined"
                size="sm"
                onClick={() => {
                  setImageFailed(false);
                  setRetrySeq((current) => current + 1);
                }}
              >
                {messages.common.retry}
              </Button>
            </div>
          ) : (
            <img
              /* 다시 시도는 같은 주소를 새 요소로 다시 받는다. */
              key={`${String(label.documentIssueLogId)}-${String(retrySeq)}`}
              src={src}
              alt={t.alt(locationCode, label.issueSeq)}
              onError={() => setImageFailed(true)}
            />
          )}
        </figure>
        <div className="location-label-actions">
          <a className="location-label-download" href={src} download={`${locationCode}.png`}>
            {t.download}
          </a>
          <Button
            variant="outlined"
            onClick={() => {
              issueWrite.reset();
              setReasonCode('');
              setReissueOpen(true);
            }}
          >
            {t.reissue}
          </Button>
        </div>
      </>
    );
  };

  return (
    <section className="location-label-section" aria-label={t.title}>
      <h3 className="location-label-title">{t.title}</h3>
      {!reissueOpen && <SaveErrorBanner error={issueWrite.error} />}
      {body()}

      {reissueOpen && (
        <LocationLabelIssueDialog
          reasonCode={reasonCode}
          reasonOptions={reasonOptions}
          reasonError={issueWrite.fieldErrors.reissueReasonCode}
          isSaving={issueWrite.isSaving}
          onReasonChange={(value) => {
            setReasonCode(value);
            issueWrite.clearFieldError('reissueReasonCode');
          }}
          onConfirm={() => issue(reasonCode)}
          onClose={() => setReissueOpen(false)}
          banner={<SaveErrorBanner error={issueWrite.error} />}
        />
      )}
    </section>
  );
};
