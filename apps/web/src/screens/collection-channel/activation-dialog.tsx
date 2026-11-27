import { Button, Dialog, Icon } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

const t = messages.collectionChannel.activation;

export interface ActivationDialogProps {
  /** 어느 방향인가. 두 처리의 무게가 달라 말이 갈린다 */
  mode: 'deactivate' | 'resume';
  channelKey: string;
  /** 대상의 지금 상태를 아직 받지 못했으면 참. 그동안 실행을 잠근다 */
  isLoadingTarget: boolean;
  isSaving: boolean;
  /** 저장 실패 배너 슬롯. 창을 닫지 않고 이유를 보여야 다시 시도할 수 있다 */
  banner: ReactNode;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * 사용 여부를 바꾸기 전에 서는 확인 창.
 *
 * ⭐ **양방향이 같은 창을 쓰되 말은 각자 갖는다** — 끄는 것과 켜는 것은 무게가 다르다.
 *
 * ⛔ **대상의 지금 상태를 받기 전에는 실행을 잠근다.** 이 화면의 사용 여부는 전용 경로가
 * 아니라 **수정 요청**으로 바뀌고, 그 요청은 지금 값을 통째로 되보낸다 — 지금 값을 모르는 채
 * 보내면 **이름·단위·이어 둔 항목이 함께 지워진다.**
 *
 * ⭐ **스크림과 창 머리 X 를 함께 막는다** — 한쪽만 잠그면 잠근 적이 없는 것과 같다.
 * Escape 는 막지 못하며(native `<dialog>` 의 `cancel`), 그 몫은 창을 여닫는 쪽에 있다.
 */
export const ActivationDialog = ({
  mode,
  channelKey,
  isLoadingTarget,
  isSaving,
  banner,
  onClose,
  onConfirm,
}: ActivationDialogProps) => {
  const isDeactivate = mode === 'deactivate';

  return (
    <Dialog
      open
      onClose={onClose}
      closeOnBackdropClick={false}
      showCloseButton={false}
      size="sm"
      title={isDeactivate ? t.deactivateTitle : t.resumeTitle}
      footer={
        <>
          <Button variant="outlined" onClick={onClose} disabled={isSaving}>
            {messages.common.cancel}
          </Button>
          <Button onClick={onConfirm} loading={isSaving} disabled={isLoadingTarget}>
            {isDeactivate ? t.deactivateAction : t.resumeAction}
          </Button>
        </>
      }
    >
      {banner}

      {/* 단말 사용 중지 창과 같은 짜임 — 대상 상자 · 질문 · 안내 줄(#360). 채널은 이름이 없어 키 한 줄이다. */}
      <div className="users-roles-worker-dialog">
        <div className="users-roles-worker-block">
          <span className="users-roles-worker-block-caption">
            {isDeactivate ? t.deactivateCaption : t.resumeCaption}
          </span>
          <strong>{channelKey}</strong>
        </div>
        <p>{isDeactivate ? t.deactivateQuestion : t.resumeQuestion}</p>
        <p className="iqc-inspection-action-note users-roles-dialog-note" data-tone="info">
          <Icon name="info" size={16} aria-hidden />
          {isDeactivate ? t.deactivateImpact : t.resumeImpact}
        </p>
        {isDeactivate && (
          <p className="iqc-inspection-action-note users-roles-dialog-note" data-tone="info">
            <Icon name="info" size={16} aria-hidden />
            {t.deactivateReversible}
          </p>
        )}
        {/* 모르면 잠근다 — 잠긴 까닭 문장은 걷었다(사용자 지시 · #360). */}
      </div>
    </Dialog>
  );
};
