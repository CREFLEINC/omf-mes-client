import { Button, Dialog, Icon } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

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
  /** 위치를 끄고 켤 때 — 대상 코드와 함께 바뀌는 위치 수(그 위치와 밑의 위치)를 보인다. */
  location?: { target: Pick<Location, 'locationCode' | 'aliasName'>; count: number } | undefined;
  /**
   * 창고를 끄고 켤 때 — 대상 창고 코드 · 창고명. 창고의 사용 중지는 창고 행만 바꾸고 위치는 그대로 두어(서버 main
   * 32b9af16) 위치 수 줄이 없다.
   */
  warehouse?: { code: string; name: string } | undefined;
  /** 대상 아래에 덧붙일 것(창고를 끄기 전 남은 재고). */
  notice?: ReactNode;
  /** 확인을 잠근다 — 남은 재고를 묻는 동안. */
  confirmDisabled?: boolean;
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
  warehouse,
  notice,
  confirmDisabled = false,
}: DeactivateConfirmDialogProps) => {
  const deactivating = mode === 'deactivate';
  const copy = deactivating ? t : messages.warehouseLocation.activate;
  const hasTarget = location !== undefined || warehouse !== undefined;
  const tone = deactivating ? 'warning' : 'info';
  /*
   * 대상 상자 · 질문 · 안내 줄 — 창고와 위치가 같은 짜임에 말만 다르다(#360).
   * 다시 사용의 정보 줄은 질문과 같은 말이라 두지 않는다 — 함께 바뀌는 위치가 여럿일 때만 건수를 보인다(사용자 지시 · #360).
   */
  const body =
    warehouse !== undefined
      ? {
          code: warehouse.code,
          name: warehouse.name,
          question: copy.warehouseQuestion,
          note: deactivating ? t.warehouseLine : null,
        }
      : location !== undefined
        ? {
            code: location.target.locationCode,
            name: location.target.aliasName,
            question: copy.question,
            note: deactivating || location.count > 1 ? copy.count(location.count) : null,
          }
        : null;
  const note = body === null ? (deactivating ? t.description : null) : body.note;
  /* 별칭이 없으면 null 이다 — 종전 대상 줄(ConfirmTarget)과 같이 비운 것으로 본다. */
  const alias = body?.name?.trim() ?? '';

  return (
    <Dialog
      className={`location-dialog ${deactivating ? 'dialog-icon-block' : 'dialog-icon-restart'}`}
      open={open}
      onClose={onClose}
      size="sm"
      title={warehouse === undefined ? copy.title : copy.warehouseTitle}
      closeOnBackdropClick={false}
      footer={
        <>
          <Button variant="outlined" onClick={onClose}>
            {messages.common.cancel}
          </Button>
          <Button
            leadingIcon={
              !hasTarget ? undefined : (
                <Icon name={deactivating ? 'block' : 'restart_alt'} size={18} />
              )
            }
            loading={isSaving}
            disabled={isSaving || confirmDisabled}
            onClick={onConfirm}
          >
            {copy.confirm}
          </Button>
        </>
      }
    >
      {banner}
      {/* 단말 사용 중지 창과 같은 짜임 — 대상 상자 · 질문 · 안내 줄(#360). */}
      <div className="users-roles-worker-dialog">
        {body !== null && (
          <div className="users-roles-worker-block">
            <span className="users-roles-worker-block-caption">{copy.caption}</span>
            <strong>{body.code}</strong>
            {alias !== '' && <span>{alias}</span>}
            {warehouse !== undefined && notice}
          </div>
        )}
        <p>{body === null ? copy.question : body.question}</p>
        {note !== null && (
          <p className="iqc-inspection-action-note users-roles-dialog-note" data-tone={tone}>
            <Icon name={tone} size={16} aria-hidden />
            {note}
          </p>
        )}
      </div>
    </Dialog>
  );
};
