import { Button, Dialog, Icon } from '@crefle/web-ui';
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

const t = messages.warehouseLocation;

const renditionUrl = (baseUrl: string, documentIssueLogId: number): string =>
  `${baseUrl}/app/document-issues/${String(documentIssueLogId)}/rendition?format=png`;

/**
 * 라벨 그림만 인쇄한다 — 화면을 통째로 찍지 않게 숨긴 틀에 그림만 한 장에 하나씩 놓고 그 틀을 인쇄한다.
 * 그림을 다 받은 뒤 인쇄해야 빈 장이 나오지 않는다.
 */
const printLabelImages = (sources: readonly { src: string; alt: string }[]): void => {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.tabIndex = -1;
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;';
  document.body.appendChild(frame);

  const frameDocument = frame.contentDocument;
  const frameWindow = frame.contentWindow;
  if (frameDocument === null || frameWindow === null) {
    frame.remove();
    return;
  }

  const style = frameDocument.createElement('style');
  style.textContent = [
    '@page { margin: 0; }',
    'html, body { margin: 0; }',
    'img { display: block; max-width: 100%; max-height: 100vh; margin: 0 auto; break-after: page; }',
    'img:last-child { break-after: auto; }',
  ].join('\n');
  frameDocument.head.appendChild(style);

  const images = sources.map(({ src, alt }) => {
    const image = frameDocument.createElement('img');
    image.src = src;
    image.alt = alt;
    frameDocument.body.appendChild(image);
    return image;
  });

  void Promise.all(
    images.map(
      (image) =>
        new Promise<void>((resolve) => {
          if (image.complete) {
            resolve();
            return;
          }
          image.addEventListener('load', () => resolve(), { once: true });
          image.addEventListener('error', () => resolve(), { once: true });
        }),
    ),
  ).then(() => {
    frameWindow.addEventListener('afterprint', () => frame.remove(), { once: true });
    frameWindow.focus();
    frameWindow.print();
  });
};

/** 라벨 일괄 출력 — 서버가 그린 라벨을 모아 보고, 한 장씩 내려받거나 그림만 인쇄한다. */
export const LocationLabelDialog = ({ previews, baseUrl, onClose }: LocationLabelDialogProps) => {
  const [failedIds, setFailedIds] = useState<ReadonlySet<number>>(new Set());
  const [retrySeq, setRetrySeq] = useState(0);

  const sources = previews.map((preview) => ({
    src: renditionUrl(baseUrl, preview.documentIssueLogId),
    alt: t.labelSection.alt(preview.locationCode, preview.issueSeq),
  }));

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={t.labelPreview.title}
      footer={
        <>
          <Button variant="outlined" onClick={onClose}>
            {messages.common.close}
          </Button>
          <Button
            leadingIcon={<Icon name="print" size={18} />}
            disabled={previews.length === 0}
            onClick={() => printLabelImages(sources)}
          >
            {t.labelPreview.print}
          </Button>
        </>
      }
    >
      <div className="location-label-grid">
        {previews.map((preview, index) => {
          const failed = failedIds.has(preview.documentIssueLogId);
          const { src, alt } = sources[index]!;

          return (
            <figure key={preview.documentIssueLogId} className="location-label-card">
              {failed ? (
                <div className="location-label-failed">
                  <p>{t.labelSection.imageFailed}</p>
                  <Button
                    variant="outlined"
                    size="sm"
                    onClick={() => {
                      setFailedIds((current) => {
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
                  /* 다시 시도는 같은 주소를 새 요소로 다시 받는다. */
                  key={`${String(preview.documentIssueLogId)}-${String(retrySeq)}`}
                  src={src}
                  alt={alt}
                  onError={() =>
                    setFailedIds((current) => new Set([...current, preview.documentIssueLogId]))
                  }
                />
              )}
              <figcaption>
                <span className="location-label-card-code">{preview.locationCode}</span>
                <span className="location-label-card-seq">
                  {t.labelPreview.seq(preview.issueSeq)}
                </span>
                <a
                  className="location-label-card-download"
                  href={src}
                  download={`${preview.locationCode}.png`}
                  aria-label={t.labelSection.download}
                  title={t.labelSection.download}
                >
                  <Icon name="download" size={20} />
                </a>
              </figcaption>
            </figure>
          );
        })}
      </div>
    </Dialog>
  );
};
