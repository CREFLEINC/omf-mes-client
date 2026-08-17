import { Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

const t = messages.poRegister;

export interface DiscardConfirmDialogProps {
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * 초안 버리기 확인 — **서버를 부르지 않는다.** 보내기 전 복귀이고, 만들어진 전표를 되돌리는
 * 것이 아니다.
 *
 * **무엇이 사라지는지 적는다.** 이 화면의 「취소」는 친 글자만 지우는 것이 아니라 **승계된 라인
 * 1행까지 되세운다**(수명 표 9행) — 「파기할까요?」만으로는 어디까지 돌아가는지 알 수 없다.
 *
 * **스크림 클릭으로 닫히는 것을 막지 않는다**(계획 결정 15 개정 — 전례 우선 판정).
 * 실수로 닫혀도 **아무것도 버리지 않는다**: 친 값과 승계 초안이 그대로 남아 잃는 것이 없다.
 * 이 저장소의 버리기 창 **여섯이 모두** 두 prop을 지정하지 않아 같은 형태이고, **그중 넷이**
 * 「닫힘 = 버리지 않음」을 짝 감지기로 고정한다(실측 — `disposal-issue`·`over-receipt-split`에는
 * 그 감지기가 없다). 규칙이 「막는다」가 아니라 **「되돌릴 수 없는 창은 막고 버리기 창은 연다」**로
 * 읽혀야 한다.
 * **등록 확인 창과 갈리는 자리다**(그쪽은 되돌릴 수 없는 조작이라 스크림·X를 막는다).
 *
 * **X 손잡이도 같은 논리로 남긴다** — 스크림과 마찬가지로 닫기는 「계속 입력」과 같은 뜻이고,
 * 나가는 길을 반쪽만 전례에 맞추면 규율이 어느 쪽인지 다시 알 수 없게 된다.
 *
 * **창 안에 선택칸을 두지 않는다**(`omf-mes#45`) — 문장 하나와 버튼 둘뿐이다.
 *
 * 기존 디자인 시스템 컴포넌트의 조합이라 이 화면 슬라이스가 소유한다.
 */
export const DiscardConfirmDialog = ({ onConfirm, onClose }: DiscardConfirmDialogProps) => (
  <Dialog
    open
    onClose={onClose}
    size="sm"
    title={t.dialog.discardTitle}
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
    <p>{t.dialog.discardLead}</p>
  </Dialog>
);
