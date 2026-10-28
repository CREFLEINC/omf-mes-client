import { Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect } from 'react';
import { useBlocker } from 'react-router';

const t = messages.erpWorkOrderFlow.process.assign.discard;

export interface DiscardDialogProps {
  onCancel: () => void;
  onConfirm: () => void;
}

/** 저장하지 않은 변경을 두고 떠날 때의 확인(T-W-C 「저장하지 않은 변경」). */
export const DiscardDialog = ({ onCancel, onConfirm }: DiscardDialogProps) => (
  <Dialog
    open
    title={t.title}
    onClose={onCancel}
    footer={
      <>
        <Button variant="outlined" onClick={onCancel}>
          {messages.common.cancel}
        </Button>
        <Button onClick={onConfirm}>{t.confirm}</Button>
      </>
    }
  >
    <p className="dialog-text">{t.body}</p>
  </Dialog>
);

/**
 * 저장하지 않은 변경이 있는 동안 화면을 떠나는 이동([← 작업지시 목록], 브라우저 뒤로가기, 다른 메뉴)을 막고 확인한다.
 * 새로 고침과 탭 닫기는 브라우저 확인(`beforeunload`)으로 막는다. 데이터 라우터(앱의 `createBrowserRouter`,
 * 시험의 `createMemoryRouter`) 안에서만 쓴다.
 */
export const LeaveGuard = ({ when }: { when: boolean }) => {
  const blocker = useBlocker(when);
  useEffect(() => {
    if (!when) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [when]);
  if (blocker.state !== 'blocked') return null;
  return <DiscardDialog onCancel={() => blocker.reset()} onConfirm={() => blocker.proceed()} />;
};
