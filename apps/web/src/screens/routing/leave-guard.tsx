import { Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useContext, useEffect } from 'react';
import { UNSAFE_DataRouterContext, useBlocker } from 'react-router';

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

/** 다른 화면으로 가는 이동만 막는다 — 같은 화면 안의 Rev·품목 선택은 화면이 따로 묻는다. */
const RouteBlocker = ({ when }: { when: boolean }) => {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      when && currentLocation.pathname !== nextLocation.pathname,
  );
  if (blocker.state !== 'blocked') return null;
  return <DiscardDialog onStay={() => blocker.reset()} onLeave={() => blocker.proceed()} />;
};

/**
 * 저장하지 않은 변경이 있는 동안 다른 화면으로 가는 이동(메뉴·뒤로가기)을 확인하고, 새로 고침·탭
 * 닫기는 브라우저 확인으로 막는다.
 *
 * ⚠ 화면 이동을 막는 것은 데이터 라우터에서만 된다 — 그 밖(일부 시험의 `MemoryRouter`)에서는
 *   브라우저 확인만 건다.
 */
export const LeaveGuard = ({ when }: { when: boolean }) => {
  const hasDataRouter = useContext(UNSAFE_DataRouterContext) !== null;
  useEffect(() => {
    if (!when) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [when]);
  return hasDataRouter ? <RouteBlocker when={when} /> : null;
};
