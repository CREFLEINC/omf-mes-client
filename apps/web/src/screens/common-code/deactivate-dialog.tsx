import { Button, Dialog, Icon } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

const t = messages.commonCode.dialog;

export interface DeactivateDialogProps {
  open: boolean;
  /** 어느 자원을 중지하는지. 세 자원이 같은 틀에 제목 · 설명만 바꿔 쓴다(사용자 지시 2026-11-26). */
  title: string;
  /** 제목 아래 묻는 문장 — 제목은 짧은 이름이고 묻는 말은 본문에 둔다(#360). */
  question: string;
  /** 중지하면 무엇이 달라지는지 — 자원 이름만 다르다. */
  description: string;
  onClose: () => void;
  onConfirm: () => void;
  isSaving: boolean;
  /** 확인을 아직 누를 수 없을 때(예: 잠금 토큰을 줄 상세를 받는 중). 「취소」는 잠그지 않는다. */
  confirmDisabled?: boolean;
  /** 저장 실패 배너 슬롯. 창을 닫지 않고 이유를 보여야 다시 시도할 수 있다. */
  banner: ReactNode;
}

/**
 * 사용 중지 확인. 기존 디자인 시스템 컴포넌트의 조합이므로 이 화면 슬라이스가 소유한다 —
 * 조합물을 미리 디자인 시스템으로 올리지 않는다.
 *
 * **참조 건수를 내지 않는다**(결정 10). 화면이 쓸 수 있는 건수(`editability.referenceCount`)는
 * 「코드 필드를 고칠 수 있는지」의 근거이지 「이 행을 참조하는 자료의 수」가 아니다 —
 * 두 뜻을 섞으면 화면이 지어낸다. 건수를 내려면 계약에 그 값을 담을 자리가 먼저 필요하다.
 *
 * **되돌리는 경로가 없다는 사실을 마지막 주의 줄이 밝힌다.** 계약에 되살리는 오퍼레이션이 없고
 * 수정 본문에도 사용 여부가 없다.
 *
 * 스크림 클릭으로 닫히지 않게 한다. 되돌릴 수 없는 액션의 확인 창이 실수로 사라지면
 * 사용자는 자기가 무엇을 취소했는지 모른다.
 *
 * 모양은 결재선 정의의 사용 전환 확인 창(`approval-route/activation-dialog.tsx`)과 같다 — 닫기(X) 없이 바닥 단추
 * 둘로만 나가고, 전송 중에는 「취소」도 잠근다(사용자 지시 2026-11-25). Esc 는 종전대로 닫는다.
 */
export const DeactivateDialog = ({
  open,
  title,
  question,
  description,
  onClose,
  onConfirm,
  isSaving,
  confirmDisabled = false,
  banner,
}: DeactivateDialogProps) => (
  <Dialog
    open={open}
    onClose={onClose}
    size="sm"
    title={title}
    className="dialog-icon-block"
    closeOnBackdropClick={false}
    showCloseButton={false}
    footer={
      <>
        {/* [취소]는 중립색 — 빨간색은 [사용 중지]만(사용자 지시 2026-11-26 · 사용자 관리 화면과 같은 방식). */}
        <Button
          variant="outlined"
          className="app-button-neutral"
          disabled={isSaving}
          onClick={onClose}
        >
          {messages.common.cancel}
        </Button>
        <Button loading={isSaving} disabled={isSaving || confirmDisabled} onClick={onConfirm}>
          {messages.common.deactivate}
        </Button>
      </>
    }
  >
    {banner}
    {/*
     * 단말 사용 중지 창과 같은 짜임 — 질문 · 안내 줄(#360). 대상 상자는 두지 않는다 —
     * 제목 아래 대상 줄 없이 쓰라는 앞선 지시(사용자 지시 2026-11-26)를 지킨다.
     */}
    <div className="users-roles-worker-dialog">
      <p>{question}</p>
      <p className="iqc-inspection-action-note users-roles-dialog-note" data-tone="info">
        <Icon name="info" size={16} aria-hidden />
        {description}
      </p>
      <p className="iqc-inspection-action-note users-roles-dialog-note" data-tone="warning">
        <Icon name="warning" size={16} aria-hidden />
        {t.deactivateWarning}
      </p>
    </div>
  </Dialog>
);
