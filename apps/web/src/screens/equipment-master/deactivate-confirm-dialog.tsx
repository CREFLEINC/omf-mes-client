import { Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

const t = messages.equipmentMaster.deactivate;

export interface DeactivateConfirmDialogProps {
  /** 창의 제목. 무엇을 끄는지 종류가 다르면 제목도 달라야 한다 */
  title: string;
  /** 무엇을 끄는지. **내부 번호가 아니라 사람이 읽는 이름이다.** */
  targetLabel: string;
  /**
   * 끄면 무엇이 달라지는지 한 줄. **부르는 쪽이 정한다** —
   * 그룹은 소속 설비 대수를, 설비는 남는 기록을 말한다.
   */
  impactNote: string;
  isSaving: boolean;
  /** 저장 실패 배너 슬롯. 창을 닫지 않고 이유를 보여야 다시 시도할 수 있다. */
  banner: ReactNode;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * 사용 중지 확인.
 *
 * ## 창의 경계
 *
 * - **나가는 길을 바닥 버튼 둘로 좁힌다** — 스크림뿐 아니라 **창 머리의 X 손잡이**도 막는다.
 *   그 손잡이는 진행 상태를 받지 않아 전송 중에도 눌리며, 한쪽 문만 잠그면 잠근 적이 없는
 *   것과 같다.
 * - **Escape는 막지 못한다.** native `<dialog>`가 `cancel`을 내고 디자인 시스템이 그것을
 *   닫기 요청으로 무조건 잇는다. 그래서 이 창의 규율은 「닫히지 않게」가 아니라
 *   **「닫혀도 나가는 요청이 무너지지 않게」**이고, 그 몫은 창을 여닫는 쪽(`screen.tsx`의
 *   `resetIfIdle`)에 있다.
 * - **창 안에 선택칸을 두지 않는다** — 창 본문이 펼침 목록을 자르는 결함이 아직 있다.
 *
 * ## 무엇을 말하는가
 *
 * ⚠ **계약에 다시 켜는 경로가 없다**(`:activate` 없음 — 실측). 사용 중지가 삭제가 아니라는
 * 사실과 함께, **이 화면에서 되돌릴 수 없다**는 사실도 밝힌다. 감추면 사용자가 가볍게 누른다.
 *
 * **끄면 무엇이 달라지는지는 부르는 쪽이 정한다** — 그룹과 설비가 서로 다른 사실을 말한다.
 * 창이 아는 것은 「무엇을 끄는가」와 「되돌릴 수 없다」 둘뿐이다.
 *
 * 기존 디자인 시스템 컴포넌트의 조합이라 이 화면 슬라이스가 소유한다.
 */
export const DeactivateConfirmDialog = ({
  title,
  targetLabel,
  impactNote,
  isSaving,
  banner,
  onClose,
  onConfirm,
}: DeactivateConfirmDialogProps) => (
  <Dialog
    open
    onClose={onClose}
    size="sm"
    closeOnBackdropClick={false}
    showCloseButton={false}
    title={title}
    footer={
      <>
        <Button variant="outlined" disabled={isSaving} onClick={onClose}>
          {messages.common.cancel}
        </Button>
        {/* 문구가 「확인」이 아니다 — 무엇을 누르는지 창을 다시 읽지 않아도 알아야 한다. */}
        <Button loading={isSaving} disabled={isSaving} onClick={onConfirm}>
          {t.confirm}
        </Button>
      </>
    }
  >
    {banner}
    <p>{t.target(targetLabel)}</p>
    <p>{impactNote}</p>
    <p>{t.notReversibleHere}</p>
  </Dialog>
);
