import { Button, Dialog, Icon } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

const t = messages.inspectionStandard;

export type VersionTransitionKind = 'confirm' | 'obsolete' | 'reactivate' | 'discard';

const TEXT: Record<
  VersionTransitionKind,
  {
    title: string;
    caption: string;
    question: string;
    action: string;
    description: string;
    tone: 'warning' | 'info';
    /** 제목 앞 아이콘(app.css `dialog-icon-*` · #360). */
    icon: string;
  }
> = {
  confirm: {
    title: t.dialog.confirmTitle,
    caption: t.dialog.confirmCaption,
    question: t.dialog.confirmQuestion,
    action: t.actions.confirm,
    description: t.dialog.confirmDescription,
    tone: 'warning',
    icon: 'dialog-icon-check',
  },
  obsolete: {
    title: t.dialog.obsoleteTitle,
    caption: t.dialog.obsoleteCaption,
    question: t.dialog.obsoleteQuestion,
    action: t.actions.obsolete,
    description: t.dialog.obsoleteDescription,
    tone: 'warning',
    icon: 'dialog-icon-block',
  },
  reactivate: {
    title: t.dialog.reactivateVersionTitle,
    caption: t.dialog.reactivateVersionCaption,
    question: t.dialog.reactivateVersionQuestion,
    action: t.actions.reactivate,
    description: t.dialog.reactivateVersionDescription,
    tone: 'info',
    icon: 'dialog-icon-restart',
  },
  discard: {
    title: t.dialog.discardTitle,
    caption: t.dialog.discardCaption,
    question: t.dialog.discardQuestion,
    action: t.actions.discard,
    description: t.dialog.discardDescription,
    tone: 'warning',
    icon: 'dialog-icon-undo',
  },
};

export interface VersionTransitionDialogProps {
  open: boolean;
  kind: VersionTransitionKind;
  onClose: () => void;
  onConfirm: () => void;
  isSaving: boolean;
  /** 실패 배너 슬롯. 창을 닫지 않고 이유를 보여야 사용자가 다음 행동을 정할 수 있다. */
  banner: ReactNode;
  /** 대상 버전 번호 — 대상 상자에 「버전 N」으로 담는다(#258 · #360). 0 이면(아직 모름) 상자를 두지 않는다. */
  planVersion: number;
  /** 대상 상자의 보조 한 줄 — 어느 기준의 버전인지(「기준코드 · 기준명」). */
  planLabel?: string;
}

/**
 * 확정·사용 중지·재사용·작성 취소 확인 — 확정은 그 버전을 수정 불가로 만들고, 사용 중지는 그 버전을
 * 새 검사에 쓸 수 없게 하고(재사용으로 되돌린다 · omf-all-around#258), 작성 취소는 그 버전을 지운다.
 * 그래서 확인을 한 단계 두고 **무엇이 일어나는지 먼저 밝힌다.**
 *
 * 스크림 클릭으로 닫히지 않게 한다. 되돌리기 어려운 액션의 확인 창이 실수로 사라지면
 * 사용자는 자기가 무엇을 취소했는지 모른다.
 */
export const VersionTransitionDialog = ({
  open,
  kind,
  onClose,
  onConfirm,
  isSaving,
  banner,
  planVersion,
  planLabel = '',
}: VersionTransitionDialogProps) => {
  const text = TEXT[kind];
  return (
    <Dialog
      className={text.icon}
      open={open}
      onClose={onClose}
      size="sm"
      title={text.title}
      closeOnBackdropClick={false}
      showCloseButton={false}
      footer={
        <>
          <Button variant="outlined" disabled={isSaving} onClick={onClose}>
            {messages.common.cancel}
          </Button>
          <Button loading={isSaving} disabled={isSaving} onClick={onConfirm}>
            {text.action}
          </Button>
        </>
      }
    >
      {banner}
      {/* 단말 사용 중지 창과 같은 짜임 — 대상 상자 · 질문 · 안내 줄(#360). */}
      <div className="users-roles-worker-dialog">
        {planVersion > 0 && (
          <div className="users-roles-worker-block">
            <span className="users-roles-worker-block-caption">{text.caption}</span>
            <strong>{t.values.version(planVersion)}</strong>
            <span>{planLabel}</span>
          </div>
        )}
        <p>{text.question}</p>
        <p className="iqc-inspection-action-note users-roles-dialog-note" data-tone={text.tone}>
          <Icon name={text.tone} size={16} aria-hidden />
          {text.description}
        </p>
      </div>
    </Dialog>
  );
};
