import { Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState, type ReactNode } from 'react';

const t = messages.common.deselectConfirm;

/**
 * 고른 줄을 다시 눌러 풀 때(사용자 지시 2026-11-27 · omf-all-around#360 「2번 클릭하면 선택 해제」) 적던 입력이 사라지는
 * 화면의 확인 팝업 — 「입력한 내용이 사라집니다. 선택을 해제할까요?」 [취소] [해제].
 * 입력이 없으면 묻지 않고 바로 푼다. 푸는 일은 화면의 기존 해제 함수가 한다(여기는 묻기만).
 */
export const DeselectConfirmDialog = ({
  onConfirm,
  onClose,
}: {
  onConfirm: () => void;
  onClose: () => void;
}) => (
  <Dialog
    open
    size="sm"
    title={t.title}
    onClose={onClose}
    footer={
      <>
        <Button variant="outlined" onClick={onClose}>
          {t.cancel}
        </Button>
        <Button onClick={onConfirm}>{t.confirm}</Button>
      </>
    }
  >
    <p>{t.body}</p>
  </Dialog>
);

export interface DeselectConfirm {
  /** 풀려는 순간 부른다 — 입력이 있으면 팝업을 띄우고 [해제]에서 `deselect` 를, 없으면 곧바로 `deselect` 를 부른다. */
  request: (hasInput: boolean, deselect: () => void) => void;
  /** 화면 아무 곳에나 둔다. 묻는 중이 아니면 `null`. */
  dialog: ReactNode;
}

/**
 * 화면에 이미 입력 버리기 확인 팝업이 있으면 `renderDialog` 로 그것을 쓴다(같은 화면 · 같은 문구).
 */
export const useDeselectConfirm = (
  renderDialog?: (props: { onConfirm: () => void; onClose: () => void }) => ReactNode,
): DeselectConfirm => {
  const [pending, setPending] = useState<{ deselect: () => void } | null>(null);

  const request = (hasInput: boolean, deselect: () => void): void => {
    if (hasInput) setPending({ deselect });
    else deselect();
  };

  const props = {
    onConfirm: () => {
      const current = pending;
      setPending(null);
      current?.deselect();
    },
    onClose: () => setPending(null),
  };

  return {
    request,
    dialog:
      pending === null ? null : (renderDialog?.(props) ?? <DeselectConfirmDialog {...props} />),
  };
};
