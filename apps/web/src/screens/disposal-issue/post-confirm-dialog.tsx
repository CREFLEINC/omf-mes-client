import { Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

const t = messages.disposalIssue;

/**
 * 확인 창이 되보일 상신 사유 — **두 갈래**다.
 *
 * 「읽었다」와 「못 읽었다」를 값 하나로 접지 않는다. 빈 문자열로 접으면 **사유가 비어 온 요청**과
 * **결재 진행을 못 읽은 것**이 같은 모양이 되고, 창은 둘 중 어느 사실도 정확히 말할 수 없다.
 */
export type PostReasonSummary = { kind: 'known'; firstLine: string } | { kind: 'unread' };

/** 처리 확인 창이 보일 것 전부. **내부 번호는 하나도 담기지 않는다**(`omf-mes#44`). */
export interface PostSummary {
  goodsIssueNo: string;
  lineCount: number;
  /** 「45 SAMPLE-UOM-EA」 · 단위가 섞이면 화면이 합계를 내지 않고 그 사실을 적어 넘긴다 */
  totalQtyText: string;
  reason: PostReasonSummary;
  /** 승인 완료 자리표시가 **비어 있는가**. 비면 판정하지 못했다는 사실을 창이 다시 적는다 */
  isJudgePending: boolean;
  /** 이 전표에 **이미 원장에 간 줄이 있는가**(값 유무로 판정 — 상태 코드가 아니다) */
  hasPostedLine: boolean;
}

export interface PostConfirmDialogProps {
  summary: PostSummary;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * 기타출고 처리 확인 — **이 화면에서 재고를 움직이는 유일한 창이다.**
 *
 * 상신 확인 창과 **갈라 둔다.** 그 창은 「이 문장이 결재함 요약이 된다」처럼 **보낼 내용**을
 * 확인시키지만, 여기서 확인할 것은 **무엇이 얼마나 장부에서 빠지는가**와 **화면이 확인하지
 * 못한 것**이다 — 줄과 사유는 이미 서버에 있고 이 화면이 고칠 수 없다.
 *
 * ### 화면이 확인하지 못한 것을 확인 직전에 다시 적는다 (계획 결정 14)
 *
 * | 조건부 문장 | 언제 | 왜 |
 * | --- | --- | --- |
 * | 승인 판정 불가 | 승인 완료 자리표시가 **비어 있다** | 구획의 상시 안내를 읽고 지나쳤어도 확인 직전에 다시 만난다 |
 * | 결재 진행 미확인 | 403·404·네트워크·부르는 중 | 막지 않되 **무엇을 모르고 누르는지**는 밝힌다 |
 * | 이미 전기된 줄 | 라인에 원장 라인 번호가 있다 | 막지 않는 대신 **한 번 더 움직일 수 있다**는 사실을 적는다 |
 *
 * **셋 다 잠그지 않고 밝히기만 한다.** 잠금의 정본은 서버이고, 화면이 지어낸 잠금은 정당한
 * 조작까지 막는다(승인 기록 §13-2 안 1).
 *
 * **스크림·X로 닫히지 않는다**(감지기 M69). 되돌릴 수 없는 조작의 확인이 스치는 클릭에
 * 사라지면 확인이 형식이 된다 — Escape는 디자인 시스템이 막을 수단을 주지 않으므로 그쪽의
 * 규율은 `resetIfIdle`이 맡는다(`omf-mes#96`).
 *
 * **창 안에 선택칸을 두지 않는다**(`omf-mes#45`) — 글자와 버튼뿐이다.
 *
 * 기존 디자인 시스템 컴포넌트의 조합이라 이 화면 슬라이스가 소유한다.
 */
export const PostConfirmDialog = ({ summary, onConfirm, onClose }: PostConfirmDialogProps) => (
  <Dialog
    open
    onClose={onClose}
    size="md"
    closeOnBackdropClick={false}
    showCloseButton={false}
    title={t.dialog.postTitle}
    footer={
      <>
        <Button variant="outlined" onClick={onClose}>
          {t.actions.keepReviewing}
        </Button>
        <Button onClick={onConfirm}>{t.actions.confirmPost}</Button>
      </>
    }
  >
    <p>{t.dialog.postLead}</p>

    <dl className="filter-bar">
      <div className="field-cell">
        <dt className="field-label">{t.issueSummary.goodsIssueNo}</dt>
        <dd>{summary.goodsIssueNo}</dd>
      </div>
      <div className="field-cell">
        <dt className="field-label">{t.issueLineTable.issueQty}</dt>
        <dd>{summary.totalQtyText}</dd>
      </div>
    </dl>

    <p>{t.dialog.lineCount(summary.lineCount)}</p>

    {/*
     * 사유는 **결재 진행에서 읽은 값이다** — 못 읽었으면 낼 것이 없고, 그 사실을 아래에서
     * 따로 적는다. 빈 자리를 만들어 두면 「사유가 비어 있는 요청」으로 잘못 읽힌다.
     */}
    {summary.reason.kind === 'known' && (
      <section aria-label={t.dialog.postReasonFirstLine}>
        <p className="field-label">{t.dialog.postReasonFirstLine}</p>
        <p>{summary.reason.firstLine}</p>
      </section>
    )}

    {/* 무엇이 일어나는지가 확인 버튼 바로 위에 선다. */}
    <p>{t.dialog.postDeducts}</p>
    <p>{t.dialog.postNoUndo}</p>

    {summary.isJudgePending && <p className="field-note">{t.dialog.postJudgePending}</p>}
    {summary.reason.kind === 'unread' && (
      <p className="field-note">{t.dialog.postProgressUnread}</p>
    )}
    {summary.hasPostedLine && <p className="field-note">{t.dialog.postAlreadyPosted}</p>}
  </Dialog>
);
