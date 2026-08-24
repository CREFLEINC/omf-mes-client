import { AlertBanner, Button, Dialog, Switch, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import type { CodeOption } from './code-options';
import { newDraftRow, selectableItems, type RowErrors } from './inspection-assignment';
import { SelectField } from './select-field';
import type { AssignmentDraftRow, EquipmentInspectionItem } from './types';

const t = messages.equipmentMaster.inspection;

export interface InspectionAssignDialogProps {
  /** 무엇에 부여하는지 — 창 머리에 남긴다 */
  targetLabel: string;
  rows: AssignmentDraftRow[];
  onChangeRows: (rows: AssignmentDraftRow[]) => void;
  /** 고를 수 있는 마스터 항목. 이미 부여한 것은 빠져 있지 않다 — 이 창이 뺀다 */
  master: EquipmentInspectionItem[];
  masterLoadFailed: boolean;
  cycleOptions: CodeOption[];
  /** 줄마다의 오류. 키는 점검 항목 식별자다 */
  rowErrors: Map<number, RowErrors>;
  banner: ReactNode;
  isSaving: boolean;
  onSave: () => void;
  onClose: () => void;
}

/**
 * 점검 항목 부여 창.
 *
 * ⛔ **묶음 통째 교체다**(계약의 `PUT … /inspection-items`). 한 줄만 고치는 경로가 없어,
 * 이 창이 들고 있는 것이 곧 저장 뒤의 전부가 된다 — **지운 줄은 부여가 풀린다.** 그 사실을
 * 창 머리에 적는다: 적지 않으면 사용자는 더한 것만 반영된다고 읽는다.
 */
export const InspectionAssignDialog = ({
  targetLabel,
  rows,
  onChangeRows,
  master,
  masterLoadFailed,
  cycleOptions,
  rowErrors,
  banner,
  isSaving,
  onSave,
  onClose,
}: InspectionAssignDialogProps) => {
  const selectable = selectableItems(master, rows);

  const patchRow = (
    equipmentInspectionItemId: number,
    patch: Partial<AssignmentDraftRow>,
  ): void => {
    onChangeRows(
      rows.map((row) =>
        row.equipmentInspectionItemId === equipmentInspectionItemId ? { ...row, ...patch } : row,
      ),
    );
  };

  const addRow = (value: string): void => {
    const picked = selectable.find((item) => String(item.equipmentInspectionItemId) === value);

    if (picked === undefined) return;

    onChangeRows([...rows, newDraftRow(picked)]);
  };

  /*
   * ⭐ **고를 것이 없는 것과 못 받은 것은 다르다.** 앞엣것은 「다 부여했다」이거나 「마스터가
   * 비었다」이고, 뒤엣것은 조회가 실패한 것이다 — 셋을 같은 문구로 덮으면 사용자는 무엇을
   * 해야 할지 알 수 없다(G-9).
   */
  const addNote = (): string | undefined => {
    if (masterLoadFailed) return t.masterLoadFailed;
    if (master.length === 0) return t.masterEmpty;

    return selectable.length === 0 ? t.allAssigned : undefined;
  };

  return (
    <Dialog open onClose={onClose} title={t.dialogTitle} size="lg">
      <p className="dialog-lead">{targetLabel}</p>
      {/* ⛔ 묶음 통째 교체라는 사실을 감추지 않는다. */}
      <div className="banner-slot">
        <AlertBanner variant="warning">{t.dialogLead}</AlertBanner>
      </div>
      {banner}

      <div className="form-grid">
        <SelectField
          label={t.addLabel}
          options={selectable.map((item) => ({
            value: String(item.equipmentInspectionItemId),
            label: `${item.itemCode} · ${item.itemName}`,
          }))}
          value=""
          onChange={addRow}
          placeholder={t.addPlaceholder}
          disabled={selectable.length === 0}
          /*
           * ⭐ **잠긴 칸에서는 사유가 안내를 대신한다**(`SelectField` 의 규율). 둘 중 하나만
           * 주면 잠긴 순간 문구가 사라져, 왜 고를 수 없는지 말하지 않는 칸이 된다.
           */
          disabledReason={addNote()}
          note={addNote()}
        />
      </div>

      <ul className="assignment-rows">
        {rows.map((row) => {
          const errors = rowErrors.get(row.equipmentInspectionItemId) ?? {};

          return (
            <li key={row.equipmentInspectionItemId} className="assignment-row">
              <p className="assignment-row-title">
                {row.itemCode} · {row.itemName}
              </p>

              <div className="form-grid">
                <SelectField
                  label={t.fields.cycleType}
                  required
                  options={cycleOptions}
                  value={row.cycleTypeCode}
                  onChange={(value) =>
                    patchRow(row.equipmentInspectionItemId, { cycleTypeCode: value })
                  }
                  error={errors.cycleTypeCode}
                />
                <TextField
                  label={t.fields.cycleInterval}
                  required
                  value={row.cycleInterval}
                  onChange={(event) =>
                    patchRow(row.equipmentInspectionItemId, { cycleInterval: event.target.value })
                  }
                  error={errors.cycleInterval}
                />
                <TextField
                  label={t.fields.cycleBaseDate}
                  type="date"
                  value={row.cycleBaseDate}
                  onChange={(event) =>
                    patchRow(row.equipmentInspectionItemId, { cycleBaseDate: event.target.value })
                  }
                  helperText={t.baseDateNote}
                />
                <div className="field-cell">
                  <Switch
                    label={t.fields.activation}
                    checked={row.isActive}
                    onChange={(event) =>
                      patchRow(row.equipmentInspectionItemId, {
                        isActive: event.target.checked,
                      })
                    }
                  />
                </div>
              </div>

              <div className="assignment-row-actions">
                <Button
                  variant="outlined"
                  size="sm"
                  onClick={() =>
                    onChangeRows(
                      rows.filter(
                        (other) =>
                          other.equipmentInspectionItemId !== row.equipmentInspectionItemId,
                      ),
                    )
                  }
                  aria-label={t.removeLabel(row.itemName)}
                >
                  {t.removeAction}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      <footer className="dialog-actions">
        <Button variant="outlined" onClick={onClose}>
          {messages.common.cancel}
        </Button>
        <Button onClick={onSave} disabled={isSaving}>
          {messages.common.save}
        </Button>
      </footer>
    </Dialog>
  );
};
