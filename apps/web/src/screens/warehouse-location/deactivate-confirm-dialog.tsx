import { Button, Dialog, Icon } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { ConfirmTarget } from './location-identity';
import type { Location } from './types';

const t = messages.warehouseLocation.deactivate;

export interface DeactivateConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isSaving: boolean;
  /** 저장 실패 배너 슬롯. 다이얼로그를 닫지 않고 이유를 보여야 다시 시도할 수 있다. */
  banner: ReactNode;
  mode?: 'deactivate' | 'activate';
  /** 위치를 끄고 켤 때 — 대상 코드와 함께 바뀌는 위치 수(그 위치와 밑의 위치)를 보인다. 창고는 없다. */
  location?: { target: Pick<Location, 'locationCode' | 'aliasName'>; count: number } | undefined;
}

/**
 * 사용 중지 확인. 기존 DS 컴포넌트의 조합이므로 이 화면 슬라이스가 소유한다 —
 * 세 번째 사용처가 생기면 그때 공용 부품으로 올릴지 판단한다.
 *
 * 스크림 클릭으로 닫히지 않게 한다. 되돌리기 어려운 액션의 확인 창이 실수로 사라지면
 * 사용자는 자기가 무엇을 취소했는지 모른다.
 */
export const DeactivateConfirmDialog = ({
  open,
  onClose,
  onConfirm,
  isSaving,
  banner,
  mode = 'deactivate',
  location,
}: DeactivateConfirmDialogProps) => {
  const deactivating = mode === 'deactivate';
  const copy = deactivating ? t : messages.warehouseLocation.activate;

  return (
    <Dialog
      className="location-dialog"
      open={open}
      onClose={onClose}
      size="sm"
      title={copy.title}
      closeOnBackdropClick={false}
      footer={
        <>
          <Button variant="outlined" onClick={onClose}>
            {messages.common.cancel}
          </Button>
          <Button
            leadingIcon={
              location === undefined ? undefined : (
                <Icon name={deactivating ? 'block' : 'restart_alt'} size={18} />
              )
            }
            loading={isSaving}
            disabled={isSaving}
            onClick={onConfirm}
          >
            {copy.confirm}
          </Button>
        </>
      }
    >
      {banner}
      {location === undefined ? (
        <p>{copy.description}</p>
      ) : (
        <ConfirmTarget
          tone={deactivating ? 'warning' : 'success'}
          icon={deactivating ? 'warning' : 'restart_alt'}
          target={location.target}
          line={copy.count(location.count)}
        />
      )}
    </Dialog>
  );
};
