import { Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useContext } from 'react';
import { UNSAFE_DataRouterContext, useBlocker } from 'react-router';

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

const RouterLeaveGuard = ({ when }: { when: boolean }) => {
  const blocker = useBlocker(when);
  if (blocker.state !== 'blocked') return null;
  return <DiscardDialog onCancel={() => blocker.reset()} onConfirm={() => blocker.proceed()} />;
};

/**
 * 화면을 떠나는 이동([← 작업함], 브라우저 뒤로가기, 다른 메뉴)을 막고 확인한다. 데이터 라우터에서만 막을 수 있어
 * 그 밖(시험의 메모리 라우터)에서는 그리지 않는다.
 */
export const LeaveGuard = ({ when }: { when: boolean }) => {
  const dataRouter = useContext(UNSAFE_DataRouterContext);
  return dataRouter === null ? null : <RouterLeaveGuard when={when} />;
};
