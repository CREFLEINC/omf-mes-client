import { Button, Dialog, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import type { LocationFormValues } from './types';
import { ReadOnlyField } from './warehouse-form-pane';

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
  values: LocationFormValues;
  onChange: (patch: Partial<LocationFormValues>) => void;
  fieldErrors: Record<string, string>;
  banner: ReactNode;
  /**
   * 서버가 만든 위치(적치 대기 · 창고 전체)면 참 — 별칭 밖의 칸을 모두 잠근다. 서버는 다른 칸이 바뀌어 오면
   * 칸마다 STATE_LOCKED 로 거부한다(#875).
   */
  systemLocked: boolean;
  /** 사용 중지 · 다시 사용 단추를 둘지. 적치 대기는 끌 수 없어 단추를 숨긴다. */
  canToggleActive: boolean;
  isActive: boolean;
  /** 편집 상세 조회가 끝나 ETag와 현재 상태를 확보했을 때만 쓰기를 허용한다. */
  isReady: boolean;
  onToggleActive: () => void;
  /** 삭제 — 없으면 단추를 두지 않는다(추가할 때 · 서버가 만든 위치). */
  onDelete?: (() => void) | undefined;
  isSaving: boolean;
  onSave: () => void;
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
  values,
  onChange,
  fieldErrors,
  banner,
  systemLocked,
  canToggleActive,
  isActive,
  isReady,
  onToggleActive,
  onDelete,
  isSaving,
  onSave,
  labelSlot,
}: LocationFormDialogProps) => {
  /* 별칭 밖의 칸 — 상세가 오기 전이거나 서버가 만든 위치면 잠근다. */
  const locked = !isReady || systemLocked;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title={mode === 'create' ? (createTitle ?? t.dialog.createTitle) : t.dialog.editTitle}
      footer={
        <>
          {mode === 'edit' && onDelete !== undefined && (
            <Button variant="outlined" disabled={!isReady} onClick={onDelete}>
              {t.deleteLocation.confirm}
            </Button>
          )}
          {mode === 'edit' && canToggleActive && (
            <Button variant="outlined" disabled={!isReady} onClick={onToggleActive}>
              {isActive ? messages.common.deactivate : t.actions.activate}
            </Button>
          )}
          <Button variant="outlined" onClick={onClose}>
            {messages.common.cancel}
          </Button>
          <Button loading={isSaving} disabled={!isReady || isSaving} onClick={onSave}>
            {messages.common.save}
          </Button>
        </>
      }
    >
      {banner}

      <div className="form-grid">
        <ReadOnlyField label={t.fields.warehouse} value={warehouseLabel} />

        <ReadOnlyField
          label={t.fields.parentLocation}
          value={parentLabel}
          error={fieldErrors.parentLocationId}
        />

        {/* 위치 코드는 MES 가 발행한다(사용자 지시 2026-10-29) — 치는 칸도, 안내문도 없다. */}
        <ReadOnlyField
          label={t.fields.locationCode}
          value={values.locationCode}
          error={fieldErrors.locationCode}
        />

        {/* 별칭이 위치의 이름이다 — 위치명 칸은 따로 두지 않는다. */}
        <TextField
          label={t.fields.aliasName}
          value={values.aliasName}
          onChange={(event) => onChange({ aliasName: event.target.value })}
          disabled={!isReady}
          error={fieldErrors.aliasName}
        />
      </div>

      {labelSlot}
    </Dialog>
  );
};
