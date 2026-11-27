import { Button, Dialog, Icon } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

const t = messages.workCalendar.retire;

export interface RetireConfirmDialogProps {
  /** 대상 상자의 이름 · 보조 한 줄(코드). **내부 번호가 아니라 사람이 읽는 이름을 담는다.** */
  target: { name: string; meta: string };
  /**
   * 몇이 이 캘린더를 따르는지 한 줄. **계약이 시킨 것이다** —
   * 「참조가 있으면 확인 문구에 건수를 함께 보인 뒤 부른다」(공유계약 B-4).
   */
  applicationNote: string;
  isSaving: boolean;
  /** 저장 실패 배너 슬롯. 창을 닫지 않고 이유를 보여야 다시 시도할 수 있다. */
  banner: ReactNode;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * 사용 중지 앞에 서는 확인 창.
 *
 * ## 창의 경계
 *
 * - **나가는 길을 바닥 버튼 둘로 좁힌다** — 스크림뿐 아니라 **창 머리의 X 손잡이**도 막는다.
 *   그 손잡이는 진행 상태를 받지 않아 전송 중에도 눌리며, 한쪽 문만 잠그면 잠근 적이 없는
 *   것과 같다.
 * - **Escape 는 막지 못한다.** native `<dialog>` 가 `cancel` 을 내고 디자인 시스템이 그것을
 *   닫기 요청으로 무조건 잇는다. 그래서 이 창의 규율은 「닫히지 않게」가 아니라
 *   **「닫혀도 나가는 요청이 무너지지 않게」**이고, 그 몫은 창을 여닫는 쪽(`resetIfIdle`)에 있다.
 *
 * ## 무엇을 말하는가
 *
 * ⭐ **몇이 따르는지를 반드시 말한다** — 중지가 곧 그 대상들을 상위 층으로 떨어뜨리는 일이라,
 * 건수를 모르고 누르면 무엇이 달라지는지 알 수 없다(계약 주석 · 공유계약 B-4).
 *
 * ⚠ **되돌릴 수 있는지도 말한다.** 계약에 다시 켜는 경로가 없다(`:activate` 없음 — 실측).
 *
 * 기존 디자인 시스템 컴포넌트의 조합이라 이 화면 슬라이스가 소유한다.
 */
export const RetireConfirmDialog = ({
  target,
  applicationNote,
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
    title={t.title}
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
    {/* 단말 사용 중지 창과 같은 짜임 — 대상 상자 · 질문 · 안내 줄(#360). */}
    <div className="users-roles-worker-dialog">
      <div className="users-roles-worker-block">
        <span className="users-roles-worker-block-caption">{t.caption}</span>
        <strong>{target.name}</strong>
        <span>{target.meta}</span>
      </div>
      <p>{t.question}</p>
      <p className="iqc-inspection-action-note users-roles-dialog-note" data-tone="info">
        <Icon name="info" size={16} aria-hidden />
        {applicationNote}
      </p>
      <p className="iqc-inspection-action-note users-roles-dialog-note" data-tone="info">
        <Icon name="info" size={16} aria-hidden />
        {t.impact}
      </p>
      <p className="iqc-inspection-action-note users-roles-dialog-note" data-tone="warning">
        <Icon name="warning" size={16} aria-hidden />
        {t.notReversibleHere}
      </p>
    </div>
  </Dialog>
);
