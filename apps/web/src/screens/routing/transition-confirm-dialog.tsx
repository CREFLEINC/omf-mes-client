import { Button, Dialog, Icon } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

const t = messages.routing;

export type RoutingTransitionKind = 'confirm' | 'obsolete' | 'discard';

export interface TransitionConfirmDialogProps {
  open: boolean;
  kind: RoutingTransitionKind;
  /** 대상 개정(「Rev N」) — 폐기 확인 제목에 담아 무엇을 폐기하는지 못 박는다(#231). */
  revisionLabel: string;
  /** 어느 품목의 Routing인지(「품목코드 · 품목명」) — 대상 상자의 보조 한 줄(#360). */
  itemLabel: string;
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
  itemLabel,
  onClose,
  onConfirm,
  isSaving,
  banner,
}: TransitionConfirmDialogProps) => (
  <Dialog
    open={open}
    onClose={onClose}
    size="sm"
    title={
      kind === 'confirm'
        ? t.dialog.confirmTitle
        : kind === 'obsolete'
          ? t.dialog.obsoleteTitle(revisionLabel)
          : t.dialog.discardTitle(revisionLabel)
    }
    closeOnBackdropClick={false}
    /* 확정 · 폐기 확인 모두 취소 단추가 닫기라 우상단 X 를 두지 않는다(사용자 지시 · #231). */
    showCloseButton={false}
    footer={
      <>
        <Button variant="outlined" onClick={onClose}>
          {messages.common.cancel}
        </Button>
        <Button loading={isSaving} disabled={isSaving} onClick={onConfirm}>
          {kind === 'confirm'
            ? t.actions.confirm
            : kind === 'obsolete'
              ? t.actions.obsolete
              : t.actions.discard}
        </Button>
      </>
    }
  >
    {banner}
    {/* 단말 사용 중지 창과 같은 짜임 — 대상 상자 · 질문 · 안내 줄(#360). 개정을 아직 모르면 상자를 두지 않는다. */}
    <div className="users-roles-worker-dialog">
      {revisionLabel !== '' && (
        <div className="users-roles-worker-block">
          <span className="users-roles-worker-block-caption">
            {kind === 'confirm'
              ? t.dialog.confirmCaption
              : kind === 'obsolete'
                ? t.dialog.obsoleteCaption
                : t.dialog.discardCaption}
          </span>
          <strong>{revisionLabel}</strong>
          <span>{itemLabel}</span>
        </div>
      )}
      <p>
        {kind === 'confirm'
          ? t.dialog.confirmQuestion
          : kind === 'obsolete'
            ? t.dialog.obsoleteQuestion
            : t.dialog.discardQuestion}
      </p>
      {kind === 'confirm' ? (
        <p className="iqc-inspection-action-note users-roles-dialog-note" data-tone="warning">
          <Icon name="warning" size={16} aria-hidden />
          {t.dialog.confirmDescription}
        </p>
      ) : (
        /* 폐기 · 작성 취소 — 결과 한 줄 아래 보조 설명 한 줄(#231), 둘 다 안내 줄로. */
        <>
          <p className="iqc-inspection-action-note users-roles-dialog-note" data-tone="warning">
            <Icon name="warning" size={16} aria-hidden />
            {kind === 'obsolete' ? t.dialog.obsoleteDescription : t.dialog.discardDescription}
          </p>
          <p
            className="iqc-inspection-action-note users-roles-dialog-note"
            data-tone={kind === 'obsolete' ? 'info' : 'warning'}
          >
            <Icon name={kind === 'obsolete' ? 'info' : 'warning'} size={16} aria-hidden />
            {kind === 'obsolete' ? t.dialog.obsoleteNote : t.dialog.discardNote}
          </p>
        </>
      )}
    </div>
  </Dialog>
);
