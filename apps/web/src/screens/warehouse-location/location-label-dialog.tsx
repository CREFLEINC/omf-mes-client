import { AlertBanner, Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

export interface LocationLabelPreview {
  documentIssueLogId: number;
  locationCode: string;
  issueSeq: number;
}

export interface LocationLabelDialogProps {
  previews: readonly LocationLabelPreview[];
  baseUrl: string;
  onClose: () => void;
}

/** 서버가 그린 Location 라벨을 그대로 미리 보고 파일로 받는다. 물리 인쇄는 이 화면의 범위가 아니다. */
export const LocationLabelDialog = ({ previews, baseUrl, onClose }: LocationLabelDialogProps) => {
  const [loadedIds, setLoadedIds] = useState<ReadonlySet<number>>(new Set());
  const [failedIds, setFailedIds] = useState<ReadonlySet<number>>(new Set());
  const [retrySeq, setRetrySeq] = useState(0);

  const renditionUrl = (documentIssueLogId: number): string =>
    `${baseUrl}/app/document-issues/${String(documentIssueLogId)}/rendition?format=png`;

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={messages.warehouseLocation.labelPreview.title}
      footer={
        <Button variant="outlined" onClick={onClose}>
          {messages.common.close}
        </Button>
      }
    >
      <AlertBanner variant="info">
        {messages.warehouseLocation.labelPreview.notice(previews.length)}
      </AlertBanner>
      <AlertBanner variant={failedIds.size > 0 ? 'warning' : 'info'}>
        {messages.warehouseLocation.labelPreview.loadSummary(
          loadedIds.size,
          failedIds.size,
          previews.length - loadedIds.size - failedIds.size,
        )}
      </AlertBanner>

      <div className="warehouse-location-label-grid">
        {previews.map((preview) => {
          const failed = failedIds.has(preview.documentIssueLogId);
          const src = renditionUrl(preview.documentIssueLogId);

          return (
            <figure key={preview.documentIssueLogId} className="warehouse-location-label-preview">
              {failed ? (
                <div className="warehouse-location-label-failed">
                  <p>{messages.warehouseLocation.labelPreview.loadFailed}</p>
                  <Button
                    variant="outlined"
                    size="sm"
                    onClick={() => {
                      setFailedIds((current) => {
                        const next = new Set(current);
                        next.delete(preview.documentIssueLogId);
                        return next;
                      });
                      setLoadedIds((current) => {
                        const next = new Set(current);
                        next.delete(preview.documentIssueLogId);
                        return next;
                      });
                      setRetrySeq((current) => current + 1);
                    }}
                  >
                    {messages.common.retry}
                  </Button>
                </div>
              ) : (
                <img
                  key={`${String(preview.documentIssueLogId)}-${String(retrySeq)}`}
                  src={src}
                  alt={messages.warehouseLocation.labelPreview.alt(
                    preview.locationCode,
                    preview.issueSeq,
                  )}
                  onLoad={() => {
                    setLoadedIds((current) => new Set([...current, preview.documentIssueLogId]));
                    setFailedIds((current) => {
                      const next = new Set(current);
                      next.delete(preview.documentIssueLogId);
                      return next;
                    });
                  }}
                  onError={() => {
                    setLoadedIds((current) => {
                      const next = new Set(current);
                      next.delete(preview.documentIssueLogId);
                      return next;
                    });
                    setFailedIds((current) => new Set([...current, preview.documentIssueLogId]));
                  }}
                />
              )}
              <figcaption>
                <span>
                  {messages.warehouseLocation.labelPreview.caption(
                    preview.locationCode,
                    preview.issueSeq,
                  )}
                </span>
                <a href={src} download={`${preview.locationCode}.png`}>
                  {messages.warehouseLocation.labelPreview.download}
                </a>
              </figcaption>
            </figure>
          );
        })}
      </div>
    </Dialog>
  );
};
