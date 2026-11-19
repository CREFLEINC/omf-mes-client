import { messages } from '@omf-mes/i18n';
import { useEffect, useState, type ReactNode } from 'react';

import { PuButton, PuDialog, PuNote } from '../../patterns/pop-uniform';

const t = messages.repackLabelIssue.preview;

export interface PreviewDialogProps {
  open: boolean;
  /**
   * `preview` 는 발행된 라벨을 보여 주는 창, `reason` 은 그림 없이 재인쇄 사유만 고르는 창이다
   * ([발번·인쇄]에서 사유가 필요할 때 · 사용자 지시 2026-09-17).
   */
  mode: 'preview' | 'reason';
  /** 재인쇄 사유 칸. 두 창 모두 사유를 고른 뒤 [재인쇄]가 열린다(사용자 지시 2026-09-17). */
  reasonField: ReactNode;
  /** 사유를 골랐는가 — 안 골랐으면 [재인쇄]를 잠근다. */
  canPrint: boolean;
  /** 서버가 그린 라벨. 아직 못 받았으면 `null` */
  imageUrl: string | null;
  isPrinting: boolean;
  onPrint: () => void;
  onClose: () => void;
}

/**
 * 미리보기·재인쇄 창 — **서버가 그린 것을 그대로 보인다**(결정 18 · K-5).
 *
 * ⚠ **발행 «뒤에» 선다.** 그리기 경로가 발행 기록 번호를 받으므로 발행 전 미리보기는 계약에
 * 없다. [취소]는 창만 닫고 아무것도 보내지 않는다 — 새 기록은 [재인쇄]가 사유와 함께 재발행할 때만.
 *
 * ⛔ **화면이 라벨을 다시 그리지 않는다.** 받은 바이트를 그대로 걸고, 인쇄도 같은 바이트를 보낸다.
 * ⛔ 창 머리에 X 가 없고 바깥을 눌러도 닫히지 않는다 — 닫는 길은 아래 [취소]다(규칙 16).
 */
export const PreviewDialog = ({
  open,
  mode,
  reasonField,
  canPrint,
  imageUrl,
  isPrinting,
  onPrint,
  onClose,
}: PreviewDialogProps) => {
  /*
   * ⛔ **받았다고 그려지는 것은 아니다.** 응답이 200 이어도 내용이 이미지가 아니면 깨진 아이콘이
   * 남는다 — 「못 받았다」와 구분이 안 되므로 말로 대신한다.
   */
  const [isBroken, setIsBroken] = useState(false);

  useEffect(() => {
    setIsBroken(false);
  }, [imageUrl]);

  if (!open) return null;

  return (
    <PuDialog
      title={mode === 'reason' ? t.reasonTitle : t.title}
      wide={mode === 'preview'}
      onClose={onClose}
      footer={
        <>
          <PuButton onClick={onClose}>{t.close}</PuButton>
          <PuButton variant="primary" onClick={onPrint} disabled={!canPrint || isPrinting}>
            {t.print}
          </PuButton>
        </>
      }
    >
      <div className="rpk-dialog">
        {mode === 'preview' && imageUrl === null && <PuNote>{t.loading}</PuNote>}
        {imageUrl !== null && isBroken && <PuNote tone="bad">{t.notDrawable}</PuNote>}
        {/* ⛔ `hidden` 으로 감추지 않는다 — 깨진 아이콘이 남는다(실측). 아예 걷어 낸다. */}
        {imageUrl !== null && !isBroken && (
          <img
            className="rpk-preview-image"
            src={imageUrl}
            alt={t.alt}
            onError={() => {
              setIsBroken(true);
            }}
          />
        )}
        {reasonField}
      </div>
    </PuDialog>
  );
};
