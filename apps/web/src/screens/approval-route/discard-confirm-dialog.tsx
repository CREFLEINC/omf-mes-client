import { Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

const t = messages.approvalRoute;

export interface DiscardConfirmDialogProps {
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * 초안 파기 확인.
 *
 * **친 값이 확인 없이 사라지지 않게 한다.** 「취소」는 고친 값을 서버 값으로 되돌리는
 * 조작이라 눌린 순간 되돌릴 수 없다 — 되돌릴 수 없는 조작 앞에 한 걸음을 둔다.
 *
 * **창 안에 선택칸을 두지 않는다**(#45 · DS `design-system-v2-webui#68`).
 * 여기 필요한 것은 문장 하나와 버튼 둘뿐이다.
 *
 * 모양 · 문구는 사용자 관리(`users-roles`) · 주간 근무일(`plant-working-days`)의 저장 안 한 변경 창과 같다 —
 * 제목 「저장되지 않은 변경 사항」, [계속 편집] [저장하지 않고 나가기], 닫기(X) 없음(사용자 지시 2026-11-25).
 * Esc · 바깥 누르기는 종전대로 「계속 편집」과 같다 — 실수로 닫혀도 초안이 그대로 남아 잃는 것이 없다.
 *
 * 기존 디자인 시스템 컴포넌트의 조합이라 이 화면 슬라이스가 소유한다.
 */
export const DiscardConfirmDialog = ({ onConfirm, onClose }: DiscardConfirmDialogProps) => (
  <Dialog
    className="dialog-icon-undo"
    open
    onClose={onClose}
    size="sm"
    /* 사용자 관리 · 주간 근무일 화면과 같은 창 — 제목만 · 닫기(X) 없음(사용자 지시 2026-11-25). */
    title={t.dialog.discardTitle}
    showCloseButton={false}
    footer={
      <>
        {/* 문구가 「확인/취소」가 아니다 — 무엇을 누르는지 창을 다시 읽지 않아도 알아야 한다. */}
        <Button variant="outlined" onClick={onClose}>
          {t.actions.keepEditing}
        </Button>
        <Button onClick={onConfirm}>{t.actions.discardDraft}</Button>
      </>
    }
  >
    <p>{t.dialog.discardBody}</p>
  </Dialog>
);
