import { Button, Dialog, Icon } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

const t = messages.inspectionStandard;

export type PlanActionKind = 'deactivate' | 'activate';

const TEXT: Record<
  PlanActionKind,
  {
    title: string;
    caption: string;
    question: string;
    action: string;
    description: string;
    tone: 'warning' | 'info';
  }
> = {
  deactivate: {
    title: t.dialog.deactivateTitle,
    caption: t.dialog.deactivateCaption,
    question: t.dialog.deactivateQuestion,
    action: messages.common.deactivate,
    description: t.dialog.deactivateDescription,
    tone: 'warning',
  },
  activate: {
    title: t.dialog.activateTitle,
    caption: t.dialog.activateCaption,
    question: t.dialog.activateQuestion,
    /* 단추 이름은 제목과 같은 말로(#360). */
    action: t.actions.activateConfirm,
    description: t.dialog.activateDescription,
    tone: 'info',
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
  /** 대상 상자 — 기준명 · 기준코드. 상세를 받기 전이면 상자를 두지 않는다(#360). */
  target?: { name: string; meta: string } | null;
}

/**
 * 사용 중지 · 다시 사용(사용자 지시 2026-11-04) 확인. 승인은 걷었다(omf-all-around#357).
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
  target = null,
}: PlanActionDialogProps) => (
  <Dialog
    className={kind === 'deactivate' ? 'dialog-icon-block' : 'dialog-icon-restart'}
    open={open}
    onClose={onClose}
    /* 사용 중지 창은 넓힌다(사용자 시안 · #258). 다시 사용 창도 같은 크기로(#360). */
    size="md"
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
    {/* 단말 사용 중지 창과 같은 짜임 — 대상 상자 · 질문 · 안내 줄(#360). */}
    <div className="users-roles-worker-dialog">
      {target !== null && (
        <div className="users-roles-worker-block">
          <span className="users-roles-worker-block-caption">{TEXT[kind].caption}</span>
          <strong>{target.name}</strong>
          <span>{target.meta}</span>
        </div>
      )}
      <p>{TEXT[kind].question}</p>
      <p className="iqc-inspection-action-note users-roles-dialog-note" data-tone={TEXT[kind].tone}>
        <Icon name={TEXT[kind].tone} size={16} aria-hidden />
        {TEXT[kind].description}
      </p>
    </div>
  </Dialog>
);
