import { Button, Checkbox, Dialog, Select, TextField } from '@crefle/web-ui';
import type { InspectionLevelCode, ItemInspectionLevel } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useId, useState } from 'react';

import { ItemPickerDialog, type ItemRow } from '../../patterns/item-picker';

const t = messages.inspectionLevel;

export const LEVEL_CODES: readonly InspectionLevelCode[] = [
  'NONE',
  'REDUCED',
  'NORMAL',
  'TIGHTENED',
];

export interface LevelDialogValues {
  itemId: number;
  level: InspectionLevelCode;
  autoSwitchEnabled: boolean;
  reason: string;
}

export interface LevelDialogProps {
  /** 바꾸는 줄. 없으면 새로 지정한다 — 품목을 고르고 자동 전환 사용도 함께 정한다. */
  row: ItemInspectionLevel | null;
  /** 서버가 돌려준 칸 오류. 로컬 검증 결과가 덮는다 */
  fieldErrors: Record<string, string>;
  /** 저장 실패 배너 슬롯 */
  banner: ReactNode;
  isSaving: boolean;
  onClose: () => void;
  onSave: (values: LevelDialogValues) => void;
}

/** 검사 수준 지정·수동 변경 창. 사유는 둘 다 필수다 — 이력에 남는다. */
export const LevelDialog = ({
  row,
  fieldErrors,
  banner,
  isSaving,
  onClose,
  onSave,
}: LevelDialogProps) => {
  const levelId = useId();
  const reasonId = useId();
  const [item, setItem] = useState<Pick<ItemRow, 'itemId' | 'itemCode' | 'itemName'> | null>(row);
  const [level, setLevel] = useState<InspectionLevelCode>(row?.inspectionLevelCode ?? 'NORMAL');
  const [autoSwitchEnabled, setAutoSwitchEnabled] = useState(true);
  const [reason, setReason] = useState('');
  const [picking, setPicking] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const shown = { ...fieldErrors, ...errors };

  const save = () => {
    const found: Record<string, string> = {};
    if (item === null) found.itemId = t.dialog.noItem;
    if (row !== null && level === row.inspectionLevelCode)
      found.inspectionLevelCode = t.dialog.sameLevel;
    if (reason.trim() === '') found.reason = t.dialog.reasonRequired;
    setErrors(found);
    if (Object.keys(found).length > 0 || item === null) return;
    onSave({ itemId: item.itemId, level, autoSwitchEnabled, reason: reason.trim() });
  };

  return (
    <>
      <Dialog
        open
        onClose={onClose}
        title={row === null ? t.dialog.addTitle : t.dialog.changeTitle(row.itemCode)}
        footer={
          <>
            <Button variant="outlined" onClick={onClose}>
              {messages.common.cancel}
            </Button>
            <Button disabled={isSaving} loading={isSaving} onClick={save}>
              {messages.common.save}
            </Button>
          </>
        }
      >
        {banner}

        <div className="form-grid">
          <div className="field-cell">
            <span className="field-label">{t.dialog.item}</span>
            <p>{item === null ? '—' : `${item.itemCode} · ${item.itemName}`}</p>
            {row === null && (
              <Button variant="outlined" size="sm" onClick={() => setPicking(true)}>
                {t.dialog.pickItem}
              </Button>
            )}
            {shown.itemId && <span className="field-error">{shown.itemId}</span>}
          </div>

          <div className="field-cell">
            <label className="field-label" htmlFor={levelId}>
              {t.dialog.level}
            </label>
            <Select
              id={levelId}
              options={LEVEL_CODES.map((code) => ({ value: code, label: t.levels[code] ?? code }))}
              value={level}
              onChange={(value) => {
                setLevel(value as InspectionLevelCode);
                setErrors((prev) => ({ ...prev, inspectionLevelCode: '' }));
              }}
            />
            {shown.inspectionLevelCode && (
              <span className="field-error">{shown.inspectionLevelCode}</span>
            )}
          </div>

          {row === null && (
            <div className="field-cell">
              <Checkbox
                checked={autoSwitchEnabled}
                onChange={(event) => setAutoSwitchEnabled(event.target.checked)}
              >
                {t.dialog.autoSwitch}
              </Checkbox>
            </div>
          )}

          <div className="field-cell">
            <label className="field-label" htmlFor={reasonId}>
              {t.dialog.reason}
            </label>
            <TextField
              id={reasonId}
              value={reason}
              maxLength={500}
              onChange={(event) => setReason(event.target.value)}
              error={shown.reason || undefined}
              aria-required
            />
          </div>
        </div>
      </Dialog>

      {picking && (
        <ItemPickerDialog
          multiple={false}
          showAvailability={false}
          confirmLabel={t.dialog.pickConfirm}
          onClose={() => setPicking(false)}
          onConfirm={([picked]) => {
            setPicking(false);
            if (picked === undefined) return;
            setItem(picked);
            setErrors((prev) => ({ ...prev, itemId: '' }));
          }}
        />
      )}
    </>
  );
};
