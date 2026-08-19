import { Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

const t = messages.documentProgress;

export interface ExecuteCancelDialogProps {
  /** 어느 문서인가 — **업무 번호다.** 내부 번호를 창에 들이지 않는다(omf-mes#44). */
  documentNo: string;
  isSaving: boolean;
  /** 실행 실패 배너 슬롯. **창을 닫지 않고** 이유를 보여야 다시 시도할 수 있다(완료 조건 C4-15). */
  banner: ReactNode;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * 취소 실행 확인 창 — ⛔ **이 화면에서 되돌릴 수 없는 정도가 가장 큰 조작 앞의 마지막 층이다.**
 *
 * ## 창이 말하는 세 가지 (완료 조건 C4-9)
 *
 * | # | 무엇 | 왜 |
 * | :-: | --- | --- |
 * | ⓐ | **원장에 무엇이 일어나는가** | 전기된 문서면 역트랜잭션이 생기고 전기 전이면 상태만 바뀐다 |
 * | ⓑ | ⛔ **되돌릴 수 없다** | 취소를 되무르는 경로가 이 화면에도 계약에도 **없다** |
 * | ⓒ | **어느 문서인가** | 고른 뒤 창이 뜨기까지 사이가 있고, 이 화면은 여러 문서를 오가며 본다 |
 *
 * ⚠ **ⓐ를 갈래 없이 단언하지 않는다.** 「원장에서 수량이 되돌아갑니다」는 **전기된 문서일 때만**
 * 참이고, 전기 여부를 화면은 판정하지 않는다(서버가 실행 뒤 `reversed`로 알려 준다). 그래서
 * 창은 **조건을 밝혀** 두 갈래를 함께 말한다 — 늘 무거운 쪽으로 적으면 화면이 확인하지 않은
 * 것을 단언하게 되고, 그 경고를 몇 번 겪은 사용자는 다음 경고도 흘려 읽는다(전례
 * `putaway-rule/activation-dialog.tsx`가 세 갈래를 각각 다른 문장으로 낸 것과 같은 규율).
 *
 * ⚠ **전례와 갈리는 자리가 ⓑ다.** 그 창은 「다시 켤 수 있습니다」라고 되돌릴 수 있음을 함께
 * 말하는데, **여기서는 반대다** — 되돌리는 경로가 없다. 이 한 줄이 두 창의 가장 큰 차이다.
 *
 * ## 창의 경계
 *
 * - **나가는 길을 바닥 버튼 둘로 좁힌다** — 스크림(`closeOnBackdropClick={false}`)뿐 아니라
 *   **창 머리의 X 손잡이**(`showCloseButton={false}`)도 막는다. 그 손잡이는 진행 상태를 받지
 *   않아 전송 중에도 눌리며, 한쪽 문만 잠그면 잠근 적이 없는 것과 같다.
 * - **Escape는 막지 못한다.** native `<dialog>`가 `cancel`을 내고 디자인 시스템이 그것을 닫기
 *   요청으로 무조건 잇는다. 그래서 이 창의 규율은 「닫히지 않게」가 아니라 **「닫혀도 나가는
 *   요청이 무너지지 않게」**이고, 그 몫은 창을 여닫는 쪽(`screen.tsx`)에 있다.
 * - **창 안에 입력칸을 두지 않는다.** 실행에는 본문이 없다(계약) — 고칠 값 자체가 없다.
 *
 * 기존 디자인 시스템 컴포넌트의 조합이라 이 화면 슬라이스가 소유한다.
 */
export const ExecuteCancelDialog = ({
  documentNo,
  isSaving,
  banner,
  onClose,
  onConfirm,
}: ExecuteCancelDialogProps) => (
  <Dialog
    open
    onClose={onClose}
    size="sm"
    closeOnBackdropClick={false}
    showCloseButton={false}
    title={t.executeDialog.title}
    footer={
      <>
        <Button variant="outlined" disabled={isSaving} onClick={onClose}>
          {t.executeDialog.keepEditing}
        </Button>
        {/* 문구가 「확인」이 아니다 — 무엇을 누르는지 창을 다시 읽지 않아도 알아야 한다. */}
        <Button loading={isSaving} disabled={isSaving} onClick={onConfirm}>
          {t.executeDialog.confirm}
        </Button>
      </>
    }
  >
    {banner}

    <p>{t.executeDialog.target(documentNo)}</p>
    <p>{t.executeDialog.ledgerImpact}</p>
    {/* ⛔ 이 줄이 이 창의 요점이다 — 무를 수 있다고 읽히면 사용자가 가볍게 누른다. */}
    <p>{t.executeDialog.irreversible}</p>
  </Dialog>
);
