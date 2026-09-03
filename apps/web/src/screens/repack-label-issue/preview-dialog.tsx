import { Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useState } from 'react';

const t = messages.repackLabelIssue.preview;

export interface PreviewDialogProps {
  open: boolean;
  /** 서버가 그린 라벨. 아직 못 받았으면 `null` */
  imageUrl: string | null;
  isPrinting: boolean;
  onPrint: () => void;
  onClose: () => void;
}

/**
 * 미리보기 — **서버가 그린 것을 그대로 보인다**(결정 18 · K-5 · DS 매핑 G-4).
 *
 * ⚠ **발행 «뒤에» 선다.** 그리기 경로가 발행 기록 번호를 받으므로 발행 전 미리보기는 계약에
 * 없다(착수 이슈 §6). 그래서 이 창이 열렸다는 것은 **이미 회차가 하나 올랐다**는 뜻이고,
 * 닫아도 그 기록은 남는다 — 그 사실을 창 안에서 말한다.
 *
 * ⛔ **화면이 라벨을 다시 그리지 않는다.** 받은 바이트를 그대로 걸고, 인쇄도 같은 바이트를
 * 보낸다 — 두 번 받으면 서버가 두 번 그리고, 그 사이 값이 달라지면 본 것과 나온 것이 갈린다.
 */
export const PreviewDialog = ({
  open,
  imageUrl,
  isPrinting,
  onPrint,
  onClose,
}: PreviewDialogProps) => {
  /*
   * ⛔ **받았다고 그려지는 것은 아니다.** 응답이 200 이고 `image/png` 여도 내용이 이미지가
   * 아니면 브라우저는 **깨진 아이콘**을 놓는다 — 실측으로 그 상태가 화면에 그대로 남았다.
   * 사용자에게는 「못 받았다」와 구분이 안 되므로 말로 대신한다.
   */
  const [isBroken, setIsBroken] = useState(false);

  useEffect(() => {
    setIsBroken(false);
  }, [imageUrl]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t.title}
      size="lg"
      footer={
        <>
          <Button variant="outlined" size="lg" onClick={onClose}>
            {t.close}
          </Button>
          <Button
            variant="filled"
            size="lg"
            onClick={onPrint}
            loading={isPrinting}
            disabled={imageUrl === null}
          >
            {t.print}
          </Button>
        </>
      }
    >
      {imageUrl === null && <p className="pop-empty-note">{t.loading}</p>}
      {imageUrl !== null && isBroken && <p className="pop-repack-error">{t.notDrawable}</p>}
      {imageUrl !== null && (
        <img
          className="pop-repack-preview-image"
          src={imageUrl}
          alt={t.alt}
          hidden={isBroken}
          onError={() => {
            setIsBroken(true);
          }}
        />
      )}
      <p className="pop-repack-preview-note">{t.closeNote}</p>
    </Dialog>
  );
};
