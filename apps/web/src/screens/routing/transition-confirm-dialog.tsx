import { Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

const t = messages.routing;

export type RoutingTransitionKind = 'confirm' | 'obsolete';

export interface TransitionConfirmDialogProps {
  open: boolean;
  kind: RoutingTransitionKind;
  /** 대상 개정(「Rev N」) — 폐기 확인 제목에 담아 무엇을 폐기하는지 못 박는다(#231). */
  revisionLabel: string;
  onClose: () => void;
  onConfirm: () => void;
  isSaving: boolean;
  /** 실패 배너 슬롯. 창을 닫지 않고 이유를 보여야 사용자가 다음 행동을 정할 수 있다. */
  banner: ReactNode;
}

/**
 * 확정·폐기 확인. 두 전이 모두 **되돌릴 수 없다** — 확정은 그 Rev를 수정 불가로 만들고,
 * 폐기는 그 Rev를 쓸 수 없게 한다. 그래서 확인을 한 단계 두고 **무엇이 일어나는지 먼저 밝힌다.**
 *
 * 스크림 클릭으로 닫히지 않게 한다. 되돌리기 어려운 액션의 확인 창이 실수로 사라지면
 * 사용자는 자기가 무엇을 취소했는지 모른다.
 *
 * 두 전이를 한 부품으로 두는 이유는 다른 것이 문구뿐이기 때문이다 —
 * 창을 둘로 나누면 확인 단계의 규칙이 두 곳에서 갈린다.
 */
export const TransitionConfirmDialog = ({
  open,
  kind,
  revisionLabel,
  onClose,
  onConfirm,
  isSaving,
  banner,
}: TransitionConfirmDialogProps) => (
  <Dialog
    open={open}
    onClose={onClose}
    size="sm"
    title={kind === 'confirm' ? t.dialog.confirmTitle : t.dialog.obsoleteTitle(revisionLabel)}
    closeOnBackdropClick={false}
    /* 폐기 확인은 취소 단추가 닫기라 우상단 X 를 두지 않는다(사용자 지시 · #231). */
    showCloseButton={kind !== 'obsolete'}
    footer={
      <>
        <Button variant="outlined" onClick={onClose}>
          {messages.common.cancel}
        </Button>
        <Button loading={isSaving} disabled={isSaving} onClick={onConfirm}>
          {kind === 'confirm' ? t.actions.confirm : t.actions.obsolete}
        </Button>
      </>
    }
  >
    {banner}
    {kind === 'confirm' ? (
      <p>{t.dialog.confirmDescription}</p>
    ) : (
      /* 폐기 — 결과 한 줄(본문) 아래 보조 설명 한 줄(사용자 시안 · #231). */
      <>
        <p className="routing-obsolete-description">{t.dialog.obsoleteDescription}</p>
        <p className="routing-obsolete-note">{t.dialog.obsoleteNote}</p>
      </>
    )}
  </Dialog>
);
