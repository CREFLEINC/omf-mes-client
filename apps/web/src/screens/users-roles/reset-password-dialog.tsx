import { AlertBanner, Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useEffect, useState } from 'react';

const t = messages.usersRoles.dialog;

export interface ResetPasswordDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isSaving: boolean;
  /** 실패 배너 슬롯. 창을 닫지 않고 이유를 보여야 다시 시도할 수 있다. */
  banner: ReactNode;
}

/**
 * 비밀번호 초기화 확인(W-CO-02 §5-1 · §8-2).
 *
 * 사용 중지 창(`deactivate-dialog.tsx`)과 절차가 같지만 **확인 버튼의 이름이 다르다** — 그 창은
 * 버튼을 「사용 중지」로 박아 두었으므로 빌려 쓰지 않는다.
 *
 * 스크림 클릭으로 닫히지 않게 한다 — 사용 중지 창과 같은 근거다.
 */
export const ResetPasswordDialog = ({
  open,
  onClose,
  onConfirm,
  isSaving,
  banner,
}: ResetPasswordDialogProps) => (
  <Dialog
    open={open}
    onClose={onClose}
    size="sm"
    title={t.resetPasswordTitle}
    closeOnBackdropClick={false}
    /* 오른쪽 위 X 를 두지 않는다(사용자 지시 2026-09-18) — 닫기는 「취소」와 Esc 로 한다. */
    showCloseButton={false}
    footer={
      <>
        <Button variant="outlined" onClick={onClose}>
          {messages.common.cancel}
        </Button>
        <Button loading={isSaving} disabled={isSaving} onClick={onConfirm}>
          {t.resetPasswordConfirm}
        </Button>
      </>
    }
  >
    {banner}
    <p>{t.resetPasswordDescription}</p>
  </Dialog>
);

export interface IssuedPassword {
  /** 누구의 값인지. 응답이 대상 전환 뒤에 와도 헷갈리지 않게 함께 보인다. */
  loginId: string;
  /** 서버가 이번 응답에서 한 번만 준 값. */
  temporaryPassword: string;
}

export interface TemporaryPasswordDialogProps {
  /** `null`이면 창이 닫혀 있다. */
  issued: IssuedPassword | null;
  onClose: () => void;
}

/**
 * 초기화로 받은 임시 비밀번호를 **한 번만** 보여 준다.
 *
 * 단말 등록 코드 창(`terminal-process-map/token-dialog.tsx`)과 달리 **값을 화면에 적는다** —
 * 이 값은 관리자가 읽어 사용자에게 알려 주는 것이라, 보이지 않으면 전달할 길이 없다.
 *
 * ⛔ 값은 부르는 쪽의 상태에만 산다. 창을 닫으면 부르는 쪽이 `null`로 비워 다시 볼 수 없다 —
 * 서버도 해시만 저장하므로 다시 받으려면 새로 초기화해야 한다.
 *
 * 스크림 클릭으로 닫히지 않게 한다 — 실수로 닫히면 그 값을 영영 잃는다.
 */
export const TemporaryPasswordDialog = ({ issued, onClose }: TemporaryPasswordDialogProps) => {
  const [copyResult, setCopyResult] = useState<'copied' | 'failed' | null>(null);

  useEffect(() => {
    setCopyResult(null);
  }, [issued]);

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopyResult('copied');
    } catch {
      setCopyResult('failed');
    }
  };

  /*
   * 값이 없으면 창을 붙이지 않는다 — 디자인 시스템 `Dialog`는 닫혀도 내용이 DOM에 남는다
   * (`screen.tsx`의 사용 중지 창과 같은 사정).
   */
  if (issued === null) return null;

  return (
    <Dialog
      open
      onClose={onClose}
      size="sm"
      title={t.temporaryPasswordTitle}
      closeOnBackdropClick={false}
      /* 오른쪽 위 X 를 두지 않는다(사용자 지시 2026-09-18) — 바닥 「닫기」와 Esc 로 닫는다. */
      showCloseButton={false}
      footer={<Button onClick={onClose}>{messages.common.close}</Button>}
    >
      <div className="temp-password-body">
        <AlertBanner variant="warning">{t.temporaryPasswordLead}</AlertBanner>
        {/* 라벨-값 한 줄씩 — 단말 등록 코드 창과 같은 `.token-meta` 목록이다. */}
        <dl className="token-meta temp-password-facts">
          <dt>{messages.usersRoles.user.fields.loginId}</dt>
          <dd>{issued.loginId}</dd>
          <dt>{t.temporaryPasswordLabel}</dt>
          <dd>
            <code>{issued.temporaryPassword}</code>
          </dd>
        </dl>
        <Button variant="outlined" onClick={() => void copy(issued.temporaryPassword)}>
          {t.temporaryPasswordCopy}
        </Button>
        {copyResult === 'copied' ? <p role="status">{t.temporaryPasswordCopied}</p> : null}
        {copyResult === 'failed' ? (
          <AlertBanner variant="error">{t.temporaryPasswordCopyFailed}</AlertBanner>
        ) : null}
      </div>
    </Dialog>
  );
};
