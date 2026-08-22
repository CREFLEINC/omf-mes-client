import { Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

export interface RetireConfirmDialogProps {
  /** 창의 제목. 무엇을 끄는지 종류가 다르면 제목도 달라야 한다 */
  title: string;
  /**
   * 무엇을 대상으로 하는지 한 줄. **내부 번호가 아니라 사람이 읽는 이름을 담는다.**
   * 문장은 부르는 쪽이 만든다 — 「사용 중지합니다」와 「폐기 처리합니다」가 다르다.
   */
  targetNote: string;
  /**
   * 끄면 무엇이 달라지는지 한 줄. **부르는 쪽이 정한다** —
   * 사용 중지는 남는 기록을, 폐기는 자산이 끝났음을 말한다.
   */
  impactNote: string;
  /**
   * 되돌릴 수 있는지 한 줄. **부르는 쪽이 정한다** — 사용 중지는 「이 화면에 다시 켤 수단이
   * 없다」이고 폐기는 「자산이 끝나 편집이 풀리지 않는다」다. 무게가 다르다.
   */
  reversibilityNote: string;
  /**
   * 무엇이 이 대상에 매여 있는지 한 줄. **계약이 시킨 것이다** —
   * 「참조가 있으면 확인 문구에 건수를 함께 보인 뒤 부른다」(공유계약 B-4).
   */
  referenceNote: string;
  /**
   * 시스템 «밖»에 나가 있는 것 한 줄. 없으면 `null` — 할 말이 없을 때 빈 줄을 세우지 않는다.
   * 참조 건수와 **다른 축**이라 한 줄로 합치지 않는다.
   */
  outsideNote: string | null;
  /**
   * 실행 버튼의 문구. **부르는 쪽이 정한다** — 「확인」이 아니라 «하는 일»을 적어야 하고,
   * 그 일이 사용 중지인지 폐기인지는 창이 알 수 없다.
   */
  confirmLabel: string;
  isSaving: boolean;
  /** 저장 실패 배너 슬롯. 창을 닫지 않고 이유를 보여야 다시 시도할 수 있다. */
  banner: ReactNode;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * 되돌릴 수 없는 처리 앞에 서는 확인 창 — 사용 중지와 폐기가 함께 쓴다.
 *
 * ⭐ **창은 방어를 갖고 말은 부르는 쪽이 갖는다.** 대상·파급·되돌림·실행 문구가 전부
 * prop 인 이유다 — 두 처리의 무게가 다른데 창이 한 벌을 굳히면 그 차이가 사라진다.
 * 창이 아는 것은 「어떻게 새지 않게 하는가」뿐이다.
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
 * ⚠ **되돌릴 수 있는지를 반드시 말한다.** 사용 중지는 계약에 다시 켜는 경로가 없고(`:activate`
 * 없음 — 실측), 폐기는 자산이 끝나 편집이 풀리지 않는다. **문장은 부르는 쪽이 준다** —
 * 둘의 무게가 다르기 때문이다. 감추면 사용자가 가볍게 누른다.
 *
 * **끄면 무엇이 달라지는지는 부르는 쪽이 정한다** — 두 처리가 서로 다른 사실을 말한다.
 * 창이 아는 것은 「무엇을 끄는가」와 「되돌릴 수 없다」 둘뿐이다.
 *
 * ⭐ **매인 것과 나가 있는 것을 각각 한 줄로 말한다.** 계약이 「참조가 있으면 건수를 함께
 * 보인 뒤 부른다」고 시켰고(공유계약 B-4), 라벨은 시스템 밖에 나가 있어 **회수할 수 없는**
 * 다른 축이다. 한 줄로 합치면 사용자가 둘 중 무엇이 걸림돌인지 알 수 없다.
 *
 * 기존 디자인 시스템 컴포넌트의 조합이라 이 화면 슬라이스가 소유한다.
 */
export const RetireConfirmDialog = ({
  title,
  targetNote,
  impactNote,
  reversibilityNote,
  referenceNote,
  outsideNote,
  confirmLabel,
  isSaving,
  banner,
  onClose,
  onConfirm,
}: RetireConfirmDialogProps) => (
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
          {confirmLabel}
        </Button>
      </>
    }
  >
    {banner}
    <p>{targetNote}</p>
    <p>{referenceNote}</p>
    {outsideNote !== null && <p>{outsideNote}</p>}
    <p>{impactNote}</p>
    <p>{reversibilityNote}</p>
  </Dialog>
);
