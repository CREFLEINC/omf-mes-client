import { Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { DecisionSubjectSummary } from './decision-subject';
import type { DecisionSubject } from './types';

const t = messages.iqcSkipApproval;

export interface RejectDialogProps {
  /** 창이 다시 보이는 **대상 요약 다섯 값**. 승인 창과 같은 부품이 그린다. */
  subject: DecisionSubject;
  /**
   * **보낼 의견 그대로.** 반려는 의견이 필수라 이 값이 빈 문자열일 수 없다 —
   * 빈 값이면 창이 열리기 전에 걸린다(버튼 잠금과 보내는 자리의 재판정, 두 겹).
   */
  comment: string;
  isSaving: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * 반려 확인 창 — **입력받지 않고 확인만 한다.**
 *
 * 의견은 아래 구획에서 이미 적었고, 여기서는 **그 말이 그대로 기록에 남는다**는 사실과
 * **되돌릴 수 없다**는 사실을 말한다. 계약이 반려 의견을 필수로 둔 이유가 그것이다 —
 * 사유가 없으면 상신자가 같은 요청을 그대로 다시 올린다.
 *
 * **승인 창과 갈라 둔다.** 문장 하나가 다른 것이 아니라 **의견의 지위가 다르다**
 * (승인은 선택이라 「없음」 갈래가 있고, 반려는 필수라 그 갈래가 없다). 창 하나로 묶으면
 * 그 차이가 조건문 안에 숨고, 「반려에도 의견 없음 갈래가 있다」는 오해가 코드에 남는다.
 * **대상 요약은 같은 부품이 그린다** — 갈린 것은 의견의 지위이지 무엇을 결재하는가가 아니다.
 *
 * 창 안에 선택칸이 없다는 것, 나가는 길을 바닥 버튼 둘로 좁힌다는 것, Escape는 막지 못하므로
 * 규율이 「닫혀도 나가는 요청이 무너지지 않게」라는 것은 승인 창과 같다.
 *
 * 기존 디자인 시스템 컴포넌트의 조합이라 이 화면 슬라이스가 소유한다.
 */
export const RejectDialog = ({
  subject,
  comment,
  isSaving,
  onClose,
  onConfirm,
}: RejectDialogProps) => (
  <Dialog
    open
    onClose={onClose}
    size="sm"
    closeOnBackdropClick={false}
    showCloseButton={false}
    title={t.dialog.rejectTitle}
    footer={
      <>
        <Button variant="outlined" disabled={isSaving} onClick={onClose}>
          {messages.common.cancel}
        </Button>
        <Button loading={isSaving} disabled={isSaving} onClick={onConfirm}>
          {t.decision.reject}
        </Button>
      </>
    }
  >
    <DecisionSubjectSummary subject={subject} />

    <p className="field-label">{t.dialog.commentHeading}</p>
    {/* 보낼 값 그대로다 — 여기 보이는 것과 나가는 것이 갈리면 확인의 뜻이 없다. */}
    <p>{comment}</p>
    <p className="field-note">{t.dialog.commentRecorded}</p>

    <p>{t.dialog.irreversible}</p>
  </Dialog>
);
