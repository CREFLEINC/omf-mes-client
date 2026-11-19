import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { PuIcon } from './icon';
import { PuButton } from './layout';

/**
 * 창(규칙 16)과 결과 알림(규칙 13) — #295.
 *
 * ⭐ 창 머리에 닫기(X)가 없다. 아래 오른쪽에 [취소] + [실행] 두 단추만 둔다
 *    (실행이 없는 도움말·선택 창은 [닫기]·[취소] 하나). 같은 일을 두 곳에 두지 않는다.
 */
const t = messages.popUniform;

export const PuDialog = ({
  title,
  children,
  onClose,
  footer,
  wide = false,
  closeLabel,
}: {
  title: ReactNode;
  children: ReactNode;
  /** [취소]·[닫기]·Esc. */
  onClose: () => void;
  /** 아래 단추들. 비우면 [닫기](`closeLabel`) 하나. */
  footer?: ReactNode;
  wide?: boolean;
  closeLabel?: string;
}) => {
  const titleId = useId();

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return createPortal(
    <div className="pu-overlay">
      <div
        className={wide ? 'pu-dialog wide' : 'pu-dialog'}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="pu-dialog-head">
          <h3 id={titleId}>{title}</h3>
        </div>
        <div className="pu-dialog-body">{children}</div>
        <div className="pu-dialog-foot">
          {footer ?? <PuButton onClick={onClose}>{closeLabel ?? t.dialog.close}</PuButton>}
        </div>
      </div>
    </div>,
    document.body,
  );
};

/** 확인 창: [취소] + [실행]. 되돌릴 수 없는 일(폐기·판정 확정)에 쓴다. */
export const PuConfirm = ({
  title,
  children,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  busy = false,
  confirmDisabled = false,
}: {
  title: ReactNode;
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
  confirmDisabled?: boolean;
}) => (
  <PuDialog
    title={title}
    onClose={onCancel}
    footer={
      <>
        <PuButton onClick={onCancel} disabled={busy}>
          {cancelLabel ?? t.dialog.cancel}
        </PuButton>
        <PuButton variant="primary" onClick={onConfirm} disabled={busy || confirmDisabled}>
          {confirmLabel}
        </PuButton>
      </>
    }
  >
    {typeof children === 'string' ? <p className="pu-dialog-text">{children}</p> : children}
  </PuDialog>
);

/** 도움말 단추: 구획 제목 줄 오른쪽의 [?] — 긴 업무 설명은 상시 글 대신 이 창(규칙 14). */
export const PuHelpButton = ({
  title,
  children,
  closeLabel,
}: {
  title: ReactNode;
  children: ReactNode;
  /** 닫기 단추 글 — 없으면 [닫기]. */
  closeLabel?: string;
}) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="pu-btn sm icon"
        aria-label={t.help}
        title={t.help}
        onClick={() => {
          setOpen(true);
        }}
      >
        <PuIcon name="help" />
      </button>
      {open && (
        <PuDialog
          title={title}
          wide
          closeLabel={closeLabel}
          onClose={() => {
            setOpen(false);
          }}
        >
          {children}
        </PuDialog>
      )}
    </>
  );
};

/* ── 결과 알림(토스트) ── */

export type PuToastTone = 'ok' | 'info' | 'warn' | 'bad';

interface ToastState {
  id: number;
  message: string;
  tone: PuToastTone;
}

const listeners = new Set<(toast: ToastState | null) => void>();
let lastId = 0;
let timer: ReturnType<typeof setTimeout> | null = null;

/**
 * 처리 결과를 작업 줄 위 가운데 알림으로 낸다(「기록했습니다」). 2.6초 뒤 사라진다.
 * ⚠ 알림만으로 끝내면 안 되는 오류(저장 실패 사유 등)는 화면 안 오류 안내 줄로도 남긴다.
 */
export const puToast = (message: string, tone: PuToastTone = 'ok'): void => {
  lastId += 1;
  const toast = { id: lastId, message, tone };
  listeners.forEach((listener) => {
    listener(toast);
  });
  if (timer !== null) clearTimeout(timer);
  timer = setTimeout(() => {
    listeners.forEach((listener) => {
      listener(null);
    });
  }, 2600);
};

const TOAST_ICON = { ok: 'ok', info: 'info', warn: 'warn', bad: 'bad' } as const;

/** 알림 자리 — POP 셸에 하나 둔다. */
export const PuToastHost = () => {
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    listeners.add(setToast);
    return () => {
      listeners.delete(setToast);
    };
  }, []);

  return (
    <div aria-live="polite" role="status">
      {toast !== null && (
        <div key={toast.id} className={`pu-toast ${toast.tone}`}>
          <PuIcon name={TOAST_ICON[toast.tone]} />
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
};
