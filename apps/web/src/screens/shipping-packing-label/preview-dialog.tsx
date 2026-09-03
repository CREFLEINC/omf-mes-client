import { AlertBanner, Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { popTouchClass } from '../../patterns/pop-touch';
import type { IssuedLabel } from './mutations';

const t = messages.shippingPackingLabel.preview;

export interface PreviewDialogProps {
  labels: IssuedLabel[];
  isPrinting: boolean;
  canPrint: boolean;
  onPrint: () => void;
  onClose: () => void;
}

/**
 * 미리보기 — **발행 «뒤»에 온다.**
 *
 * 그리기 경로(`GET …/rendition`)가 발행 기록 번호를 받으므로 **발행 전 미리보기는 이번
 * 계약에 없다**(착수 이슈 §6 · 요구서 §3-4). 그래서 화면 순서가 「발행 → 미리보기 → 인쇄」다.
 *
 * ⛔ **닫는다고 발행이 없던 일이 되지 않는다.** 계약에 발행 취소 경로가 없다 — 기록 전용이라
 * 지우지 않는다(공유계약 B-3 · K-1). 그 사실을 창 안에서 밝힌다.
 *
 * ⛔ **화면이 라벨을 다시 그리지 않는다.** 서버가 그린 바이트를 그대로 보인다 — 여기서
 * 그리면 **본 것과 프린터로 나가는 것이 달라진다.**
 *
 * 기존 디자인 시스템 컴포넌트의 조합이라 이 화면 슬라이스가 소유한다.
 */
export const PreviewDialog = ({
  labels,
  isPrinting,
  canPrint,
  onPrint,
  onClose,
}: PreviewDialogProps) => (
  <Dialog
    open
    onClose={onClose}
    size="lg"
    title={t.title}
    footer={
      <>
        <Button className={popTouchClass('normal')} variant="outlined" size="xl" onClick={onClose}>
          {t.close}
        </Button>
        <Button
          className={popTouchClass('critical')}
          size="2xl"
          disabled={!canPrint}
          loading={isPrinting}
          onClick={onPrint}
        >
          {t.print}
        </Button>
      </>
    }
  >
    <AlertBanner variant="info">{t.notice}</AlertBanner>

    <div className="pop-slabel-previews">
      {labels.map((label) => (
        <figure key={label.issue.documentIssueLogId} className="pop-slabel-preview">
          <img
            src={label.previewUrl}
            alt={t.alt(label.issue.displayName, label.issue.issueSeq)}
            className="pop-slabel-preview-image"
          />
          <figcaption className="field-note">
            {label.issue.displayName} · {label.issue.issueSeq}
          </figcaption>
        </figure>
      ))}
    </div>
  </Dialog>
);
