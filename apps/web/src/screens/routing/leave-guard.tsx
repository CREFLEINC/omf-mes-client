import { Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect } from 'react';
import { useBlocker } from 'react-router';

const t = messages.routing.discard;

export interface DiscardDialogProps {
  onStay: () => void;
  onLeave: () => void;
}

/** 저장하지 않은 편집을 두고 떠날 때의 확인. */
export const DiscardDialog = ({ onStay, onLeave }: DiscardDialogProps) => (
  <Dialog
    open
    title={t.title}
    onClose={onStay}
    footer={
      <>
        <Button variant="outlined" onClick={onStay}>
          {t.stay}
        </Button>
        <Button onClick={onLeave}>{t.confirm}</Button>
      </>
    }
  >
    <p className="dialog-text">{t.body}</p>
  </Dialog>
);

export interface LeaveGuardProps {
  when: boolean;
  /**
   * 같은 화면 안에서도 바뀌면 편집 대상이 바뀌는 질의 이름(예: 품목·Rev). 「뒤로」로 그 값만 바뀌어도
   * 편집이 사라지므로 막는다.
   */
  watchedParams?: readonly string[];
  /** 화면이 이미 물어 확인받은 이동 — 이번 한 번은 막지 않는다. 이동이 끝나면 화면이 되돌린다. */
  bypassRef?: { current: boolean };
}

/**
 * 저장하지 않은 변경이 있는 동안 다른 화면으로 가거나 편집 대상(질의)이 바뀌는 이동(메뉴·뒤로가기)을
 * 확인하고, 새로 고침·탭 닫기는 브라우저 확인으로 막는다. 데이터 라우터 안에서만 쓴다.
 */
export const LeaveGuard = ({ when, watchedParams = [], bypassRef }: LeaveGuardProps) => {
  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    if (!when || bypassRef?.current === true) return false;
    if (currentLocation.pathname !== nextLocation.pathname) return true;
    const current = new URLSearchParams(currentLocation.search);
    const next = new URLSearchParams(nextLocation.search);
    return watchedParams.some((name) => current.get(name) !== next.get(name));
  });
  useEffect(() => {
    if (!when) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [when]);
  if (blocker.state !== 'blocked') return null;
  return <DiscardDialog onStay={() => blocker.reset()} onLeave={() => blocker.proceed()} />;
};
