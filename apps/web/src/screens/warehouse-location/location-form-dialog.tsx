import { Button, Dialog, Icon } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import {
  DialogSection,
  type LocationFact,
  LocationFacts,
  LocationIdentity,
  type LocationIdentityProps,
} from './location-identity';
import type { LocationFormValues } from './types';

export interface LocationFormDialogProps {
  open: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  /** 추가할 때의 제목 — 구역 추가 · 랙 추가. 없으면 「Location 추가」. */
  createTitle?: string;
  /** 어느 창고의 Location인지 — 「창고코드 · 창고명」 */
  warehouseLabel: string;
  /** 상위 위치 — 별칭, 없으면 코드. 구역이면 창고. 바꿀 수 없어 글자로만 보인다. */
  parentLabel: string;
  /** 머리의 단계 아이콘 · 단계 이름 — 고칠 때는 그 위치, 추가할 때는 만들 단계. */
  subject: LocationIdentityProps['subject'];
  values: LocationFormValues;
  onChange: (patch: Partial<LocationFormValues>) => void;
  fieldErrors: Record<string, string>;
  banner: ReactNode;
  /**
   * 서버가 만든 위치(적치 대기 · 창고 전체)면 참 — 별칭 밖의 칸을 모두 잠근다. 서버는 다른 칸이 바뀌어 오면
   * 칸마다 STATE_LOCKED 로 거부한다(#875).
   */
  systemLocked: boolean;
  /**
   * 사용 중지 · 다시 사용 단추를 둘지 — 구역 단위로 끈다(사용자 지시 2026-10-29). 층 · 셀은 랙에서, 적치 대기는
   * 끌 수 없어 숨긴다.
   */
  canToggleActive: boolean;
  isActive: boolean;
  /** 편집 상세 조회가 끝나 ETag와 현재 상태를 확보했을 때만 쓰기를 허용한다. */
  isReady: boolean;
  onToggleActive: () => void;
  /** 삭제 — 없으면 단추를 두지 않는다(추가할 때 · 서버가 만든 위치). */
  onDelete?: (() => void) | undefined;
  isSaving: boolean;
  onSave: () => void;
  /** 고칠 때 바꾼 것이 있는가 — 없으면 저장을 막는다. 추가할 때는 보지 않는다. */
  isDirty?: boolean;
  /** 고칠 때 기본 정보와 라벨 사이에 두는 보관 품목(맨 아래 위치만). */
  itemsSlot?: ReactNode;
  /** 고칠 때 칸 아래에 두는 라벨(사용자 지시 2026-10-29). */
  labelSlot?: ReactNode;
}

const t = messages.warehouseLocation;

export const LocationFormDialog = ({
  open,
  onClose,
  mode,
  createTitle,
  warehouseLabel,
  parentLabel,
  subject,
  values,
  onChange,
  fieldErrors,
  banner,
  canToggleActive,
  isActive,
  isReady,
  onToggleActive,
  onDelete,
  isSaving,
  onSave,
  isDirty = true,
  itemsSlot,
  labelSlot,
}: LocationFormDialogProps) => {
  /* 구역 · 서버가 만든 자리는 창고 바로 밑이다 — 상위가 창고와 같아 창고 한 줄만 보인다. */
  const facts: LocationFact[] =
    values.parentLocationId === ''
      ? [{ label: t.fields.warehouse, value: warehouseLabel, error: fieldErrors.parentLocationId }]
      : [
          { label: t.fields.warehouse, value: warehouseLabel },
          {
            label: t.fields.parentLocation,
            value: parentLabel,
            error: fieldErrors.parentLocationId,
          },
        ];
  const showStateActions = mode === 'edit' && (onDelete !== undefined || canToggleActive);

  return (
    <Dialog
      className="location-dialog"
      open={open}
      onClose={onClose}
      size="lg"
      title={mode === 'create' ? (createTitle ?? t.dialog.createTitle) : t.dialog.editTitle}
      footer={
        <>
          {/* 지우기 · 끄기는 왼쪽에 따로 — 저장과 섞이지 않게. */}
          {showStateActions && (
            <div className="location-dialog-footer-start">
              {onDelete !== undefined && (
                <Button
                  variant="outlined"
                  className="location-danger-button"
                  leadingIcon={<Icon name="delete" size={18} />}
                  disabled={!isReady}
                  onClick={onDelete}
                >
                  {t.deleteLocation.confirm}
                </Button>
              )}
              {canToggleActive && (
                <Button
                  variant="text"
                  className="location-state-button"
                  leadingIcon={<Icon name={isActive ? 'block' : 'restart_alt'} size={18} />}
                  disabled={!isReady}
                  onClick={onToggleActive}
                >
                  {isActive ? messages.common.deactivate : t.actions.activate}
                </Button>
              )}
            </div>
          )}
          <Button variant="outlined" onClick={onClose}>
            {messages.common.cancel}
          </Button>
          <Button
            loading={isSaving}
            disabled={!isReady || isSaving || (mode === 'edit' && !isDirty)}
            onClick={onSave}
          >
            {messages.common.save}
          </Button>
        </>
      }
    >
      {banner}

      <div className="location-dialog-body">
        {/* 위치 코드는 MES 가 발행한다(사용자 지시 2026-10-29) — 치는 칸 없이 머리에 크게. */}
        <LocationIdentity
          subject={subject}
          code={values.locationCode}
          alias={values.aliasName}
          isActive={mode === 'edit' ? isActive : undefined}
        />
        {fieldErrors.locationCode !== undefined && (
          <span className="field-error">{fieldErrors.locationCode}</span>
        )}
        {/* 별칭은 창고 · 상위 위치와 같은 줄에 — 연필을 눌러 그 자리에서 고친다(사용자 지시 2026-10-29). */}
        <LocationFacts
          facts={[
            ...facts,
            {
              label: t.fields.aliasName,
              value: values.aliasName,
              error: fieldErrors.aliasName,
              edit: { onChange: (aliasName) => onChange({ aliasName }), disabled: !isReady },
            },
          ]}
        />

        {itemsSlot}
        {labelSlot}
      </div>
    </Dialog>
  );
};
