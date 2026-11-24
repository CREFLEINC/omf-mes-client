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

/**
 * 지금 떠 있는 `PuDialog` 들의 차례 번호. 나중에 그린 창(겹친 안쪽 창 포함)일수록 크다 — Esc 는 가장 큰
 * 번호(맨 위) 창만 받는다.
 */
let dialogSeq = 0;
const openDialogs = new Set<number>();

export const PuDialog = ({
  title,
  children,
  onClose,
  footer,
  wide = false,
  closeLabel,
  ariaLabel,
  keyboard,
}: {
  /** 비우면 머리줄 없이 본문만 — 읽어 주는 이름은 `ariaLabel`. */
  title?: ReactNode;
  children: ReactNode;
  /** [취소]·[닫기]·Esc. */
  onClose: () => void;
  /** 아래 단추들. 비우면 [닫기](`closeLabel`) 하나. */
  footer?: ReactNode;
  wide?: boolean;
  closeLabel?: string;
  /** 제목이 없는 창의 읽어 주는 이름. */
  ariaLabel?: string;
  /**
   * 화면 아래 **키패드 판**에 띄울 글자판 · 숫자 키패드(사용자 지시 2026-11-24).
   *
   * ⭐ 창 안에 두지 않는다 — 글자판(넓다)과 숫자 키패드(좁다)가 바뀔 때마다 창 크기가 바뀌어 어색했다.
   *    판은 화면 아래 고정 높이 띠이고, 창은 그 위 남은 자리 가운데에 같은 크기로 있다.
   * - `undefined`: 판이 없는 창.
   * - `null` · `false`: 지금은 띄울 것이 없지만 판 자리는 비워 둔다 — 칸을 눌러 판이 열려도 창이 움직이지 않는다.
   * ⚠ 판은 창(`role="dialog"`) 안에 그린다(자리만 화면 아래) — 화면 낭독 · 초점이 창 안에 머문다.
   */
  keyboard?: ReactNode;
}) => {
  const titleId = useId();
  const hasTitle = title !== undefined && title !== null;

  /* 겹쳐 뜬 창 중 맨 위 창만 Esc 로 닫는다 — 아래 창까지 한꺼번에 닫히지 않게. */
  const [seq] = useState(() => {
    dialogSeq += 1;
    return dialogSeq;
  });
  useEffect(() => {
    openDialogs.add(seq);
    return () => {
      openDialogs.delete(seq);
    };
  }, [seq]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && Math.max(...openDialogs) === seq) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose, seq]);

  const hasKeyboard = keyboard !== undefined;
  const showKeyboard = hasKeyboard && keyboard !== null && keyboard !== false;

  return createPortal(
    <div className={hasKeyboard ? 'pu-overlay has-keyboard' : 'pu-overlay'}>
      <div
        className={[
          'pu-dialog',
          wide && 'wide',
          !hasTitle && 'no-head',
          hasKeyboard && 'has-keyboard',
        ]
          .filter(Boolean)
          .join(' ')}
        role="dialog"
        aria-modal="true"
        aria-labelledby={hasTitle ? titleId : undefined}
        aria-label={hasTitle ? undefined : ariaLabel}
      >
        {hasTitle && (
          <div className="pu-dialog-head">
            <h3 id={titleId}>{title}</h3>
          </div>
        )}
        <div className="pu-dialog-body">{children}</div>
        <div className="pu-dialog-foot">
          {footer ?? <PuButton onClick={onClose}>{closeLabel ?? t.dialog.close}</PuButton>}
        </div>
        {showKeyboard && (
          /* 판의 빈 곳 · 꺼진 키를 눌러도 칸에서 초점이 빠지지 않게 한다 — 스캐너 · 실물 자판이 계속 그 칸에 친다. */
          <div
            className="pu-kbd-dock"
            onMouseDown={(event) => {
              event.preventDefault();
            }}
          >
            <div className="pu-kbd-dock-inner">{keyboard}</div>
          </div>
        )}
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
