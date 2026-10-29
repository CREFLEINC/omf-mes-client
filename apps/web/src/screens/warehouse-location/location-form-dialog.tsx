import { Button, Checkbox, Dialog, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';
import { useId } from 'react';

import type { LocationFormValues } from './types';
import { ReadOnlyField, SelectField } from './warehouse-form-pane';

export interface LocationFormDialogProps {
  open: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  /** 추가할 때의 제목 — 구역 추가 · 랙 추가. 없으면 「Location 추가」. */
  createTitle?: string;
  /** 어느 창고의 Location인지 — 「창고코드 · 창고명」 */
  warehouseLabel: string;
  /**
   * 상위 위치 선택지. null 이면 상위를 바꿀 수 없어 `parentLabel` 을 글자로 보인다 — 추가는 단추가 상위를 정하고,
   * 구역 · 서버가 만든 위치는 창고 바로 밑이다. 랙 · 층 · 셀을 고칠 때만 한 단계 위의 위치 가운데서 고른다.
   */
  parentOptions: { value: string; label: string }[] | null;
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
  locationTypeOptions: { value: string; label: string }[];
  isActive: boolean;
  /** 편집 상세 조회가 끝나 ETag와 현재 상태를 확보했을 때만 쓰기를 허용한다. */
  isReady: boolean;
  onToggleActive: () => void;
  isSaving: boolean;
  onSave: () => void;
}

const t = messages.warehouseLocation;

export const LocationFormDialog = ({
  open,
  onClose,
  mode,
  createTitle,
  warehouseLabel,
  parentOptions,
  parentLabel,
  values,
  onChange,
  fieldErrors,
  banner,
  systemLocked,
  canToggleActive,
  locationTypeOptions,
  isActive,
  isReady,
  onToggleActive,
  isSaving,
  onSave,
}: LocationFormDialogProps) => {
  const warehouseLabelId = useId();
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
        {/* 값을 보여 주기만 하면 되는 자리는 폼 컨트롤을 잠그지 않고 값 표기로 낸다. */}
        {/* 어느 창고의 Location인지는 값으로 밝히고, 바꿀 수 없다는 사실은 보조 문구로 남긴다. */}
        <div>
          <span className="field-label" id={warehouseLabelId}>
            {t.fields.warehouse}
          </span>
          <p aria-labelledby={warehouseLabelId}>{warehouseLabel}</p>
          <span className="field-note">{t.actionReasons.warehouseFixedInLocation}</span>
        </div>

        {parentOptions === null ? (
          <ReadOnlyField
            label={t.fields.parentLocation}
            value={parentLabel}
            error={fieldErrors.parentLocationId}
          />
        ) : (
          <SelectField
            label={t.fields.parentLocation}
            options={parentOptions}
            value={values.parentLocationId}
            onChange={(value) => onChange({ parentLocationId: value })}
            disabled={locked}
            error={fieldErrors.parentLocationId}
          />
        )}

        {/* 위치 코드는 MES 가 발행한다(사용자 지시 2026-10-29) — 치는 칸이 없다. */}
        <ReadOnlyField
          label={t.fields.locationCode}
          value={values.locationCode}
          error={fieldErrors.locationCode}
          note={
            mode === 'create'
              ? t.actionReasons.locationCodeIssued
              : systemLocked
                ? t.actionReasons.systemLocation
                : undefined
          }
        />

        {/* 별칭이 위치의 이름이다 — 위치명 칸은 따로 두지 않는다. */}
        <TextField
          label={t.fields.aliasName}
          value={values.aliasName}
          onChange={(event) => onChange({ aliasName: event.target.value })}
          disabled={!isReady}
          error={fieldErrors.aliasName}
        />

        <SelectField
          label={t.fields.locationType}
          options={locationTypeOptions}
          value={values.locationTypeCode}
          onChange={(value) => onChange({ locationTypeCode: value })}
          disabled={locked}
          error={fieldErrors.locationTypeCode}
        />

        {/* 간격이 없으면 두 문구가 붙어 「…허용LOT 혼적…」처럼 한 줄로 읽힌다. */}
        <div className="check-group">
          <Checkbox
            checked={values.allowMixedItem}
            onChange={(event) => onChange({ allowMixedItem: event.target.checked })}
            disabled={locked}
          >
            {t.fields.allowMixedItem}
          </Checkbox>
          <Checkbox
            checked={values.allowMixedLot}
            onChange={(event) => onChange({ allowMixedLot: event.target.checked })}
            disabled={locked}
          >
            {t.fields.allowMixedLot}
          </Checkbox>
        </div>
      </div>
    </Dialog>
  );
};
