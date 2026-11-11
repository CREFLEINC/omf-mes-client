import { Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

const t = messages.inspectionStandard;

export type PlanActionKind = 'deactivate' | 'activate' | 'approve';

const TEXT: Record<PlanActionKind, { title: string; action: string; description: string }> = {
  deactivate: {
    title: t.dialog.deactivateTitle,
    action: messages.common.deactivate,
    description: t.dialog.deactivateDescription,
  },
  activate: {
    title: t.dialog.activateTitle,
    action: t.actions.reactivate,
    description: t.dialog.activateDescription,
  },
  /* 승인(사용자 지시 · omf-all-around#258) — 계약에 승인 해제가 없어 되돌릴 수 없다. */
  approve: {
    title: t.dialog.approveTitle,
    action: t.actions.approve,
    description: t.dialog.approveDescription,
  },
};

export interface PlanActionDialogProps {
  open: boolean;
  kind: PlanActionKind;
  onClose: () => void;
  onConfirm: () => void;
  isSaving: boolean;
  /** 실패 배너 슬롯. 창을 닫지 않고 이유를 보여야 사용자가 다음 행동을 정할 수 있다. */
  banner: ReactNode;
}

/**
 * 사용 중지 · 다시 사용(사용자 지시 2026-11-04) · 승인(#208 에서 걷었다가 되살림 · 사용자 지시 omf-all-around#258) 확인.
 *
 * **되돌릴 수 없다** — 물리 삭제가 없어 사용 중지가 마지막 상태다.
 * 그래서 확인을 한 단계 두고 **무엇이 일어나는지 먼저 밝힌다.**
 *
 * 스크림 클릭으로 닫히지 않게 한다. 되돌리기 어려운 액션의 확인 창이 실수로 사라지면
 * 사용자는 자기가 무엇을 취소했는지 모른다.
 */
export const PlanActionDialog = ({
  open,
  kind,
  onClose,
  onConfirm,
  isSaving,
  banner,
}: PlanActionDialogProps) => (
  <Dialog
    open={open}
    onClose={onClose}
    /* 사용 중지 창은 설명이 두 줄 안에 들도록 넓힌다(사용자 시안 · #258). */
    size={kind === 'deactivate' ? 'md' : 'sm'}
    title={TEXT[kind].title}
    closeOnBackdropClick={false}
    showCloseButton={false}
    footer={
      <>
        <Button variant="outlined" disabled={isSaving} onClick={onClose}>
          {messages.common.cancel}
        </Button>
        <Button loading={isSaving} disabled={isSaving} onClick={onConfirm}>
          {TEXT[kind].action}
        </Button>
      </>
    }
  >
    {banner}
    <p>{TEXT[kind].description}</p>
  </Dialog>
);
