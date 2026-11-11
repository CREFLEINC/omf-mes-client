import { Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

const t = messages.inspectionStandard;

export type VersionTransitionKind = 'confirm' | 'obsolete' | 'reactivate' | 'discard';

const TEXT: Record<
  VersionTransitionKind,
  { title: string | ((version: number) => string); action: string; description: string }
> = {
  confirm: {
    title: t.dialog.confirmTitle,
    action: t.actions.confirm,
    description: t.dialog.confirmDescription,
  },
  obsolete: {
    title: t.dialog.obsoleteTitle,
    action: t.actions.obsolete,
    description: t.dialog.obsoleteDescription,
  },
  reactivate: {
    title: t.dialog.reactivateVersionTitle,
    action: t.actions.reactivate,
    description: t.dialog.reactivateVersionDescription,
  },
  discard: {
    title: t.dialog.discardTitle,
    action: t.actions.discard,
    description: t.dialog.discardDescription,
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
  /** 대상 버전 번호 — 사용 중지 창 제목에 넣는다(「버전 1을 사용 중지하시겠습니까?」 · 사용자 시안 #258). */
  planVersion: number;
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
}: VersionTransitionDialogProps) => {
  const { title } = TEXT[kind];
  return (
    <Dialog
      open={open}
      onClose={onClose}
      /* 사용 중지 창은 제목 · 설명이 한 줄에 가깝게 서도록 넓힌다(사용자 시안 · #258). */
      size={kind === 'obsolete' ? 'md' : 'sm'}
      title={typeof title === 'function' ? title(planVersion) : title}
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
};
