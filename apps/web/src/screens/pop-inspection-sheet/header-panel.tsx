import { Button, Checkbox, TextField } from '@crefle/web-ui';
import type {
  InspectionSheet,
  InspectionSheetHeaderUpdate,
  InspectionSheetJudgment,
} from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import { PopSelect as Select } from '../../patterns/pop-select';

const t = messages.popInspectionSheet.header;

type TextKey = Exclude<keyof InspectionSheetHeaderUpdate, 'rohsFlag' | 'overallResultCode'>;

const TEXT_FIELDS: readonly { key: TextKey; max: number; ppOnly?: true }[] = [
  { key: 'modelText', max: 200 },
  { key: 'specText', max: 200 },
  { key: 'destinationText', max: 200 },
  { key: 'fwProductionVersion', max: 50 },
  { key: 'fwQualityVersion', max: 50 },
  { key: 'materialText', max: 500 },
  { key: 'structureText', max: 500 },
  { key: 'productNameText', max: 200, ppOnly: true },
  { key: 'powerText', max: 200, ppOnly: true },
  { key: 'motorText', max: 200, ppOnly: true },
  { key: 'tempPackNote', max: 500 },
];

/** 머리 LOT 칸 — 칸마다 W/O 투입 LOT 후보가 따로 온다. */
const LOT_FIELDS = [
  { key: 'pcbLotNo', candidates: 'pcb' },
  { key: 'sdLotNo', candidates: 'sd' },
  { key: 'stapleLotNo', candidates: 'staple' },
] as const;

const headerOf = (sheet: InspectionSheet): InspectionSheetHeaderUpdate => ({
  modelText: sheet.modelText,
  specText: sheet.specText,
  destinationText: sheet.destinationText,
  pcbLotNo: sheet.pcbLotNo,
  sdLotNo: sheet.sdLotNo,
  stapleLotNo: sheet.stapleLotNo,
  fwProductionVersion: sheet.fwProductionVersion,
  fwQualityVersion: sheet.fwQualityVersion,
  materialText: sheet.materialText,
  structureText: sheet.structureText,
  rohsFlag: sheet.rohsFlag,
  productNameText: sheet.productNameText,
  powerText: sheet.powerText,
  motorText: sheet.motorText,
  tempPackNote: sheet.tempPackNote,
  overallResultCode: sheet.overallResultCode,
});

const trimmed = (header: InspectionSheetHeaderUpdate): InspectionSheetHeaderUpdate =>
  Object.fromEntries(
    Object.entries(header).map(([key, value]) => [
      key,
      typeof value === 'string' ? value.trim() || null : value,
    ]),
  ) as InspectionSheetHeaderUpdate;

export interface HeaderPanelProps {
  sheet: InspectionSheet;
  disabled: boolean;
  isSaving: boolean;
  onSave: (header: InspectionSheetHeaderUpdate) => void;
}

/** 머리 값 — 서버가 만들 때 자동으로 채운 값을 사람이 고친다(담당자 결정 ①). 보낸 값으로 통째로 바뀐다. */
export const HeaderPanel = ({ sheet, disabled, isSaving, onSave }: HeaderPanelProps) => {
  const [header, setHeader] = useState<InspectionSheetHeaderUpdate>(() => headerOf(sheet));
  const set = (patch: Partial<InspectionSheetHeaderUpdate>) =>
    setHeader((prev) => ({ ...prev, ...patch }));
  const pp = sheet.formLayoutCode === 'PP';
  const changed = JSON.stringify(trimmed(header)) !== JSON.stringify(trimmed(headerOf(sheet)));

  return (
    <section className="pane pop-inspection-sheet-header" aria-label={t.heading}>
      <h2 className="pane-title">{t.heading}</h2>
      <p className="field-note">{t.note}</p>
      <div className="form-grid">
        {LOT_FIELDS.map(({ key, candidates }) => {
          const options = sheet.lotCandidates[candidates];
          return options.length > 1 ? (
            <div className="field-cell" key={key}>
              <span className="field-label">{t[key]}</span>
              <Select
                aria-label={t[key]}
                placeholder={t.candidates(options.length)}
                options={options.map((lotNo) => ({ value: lotNo, label: lotNo }))}
                value={header[key] ?? null}
                disabled={disabled}
                onChange={(value) => set({ [key]: value })}
              />
            </div>
          ) : (
            <TextField
              key={key}
              label={t[key]}
              size="lg"
              maxLength={100}
              value={header[key] ?? ''}
              disabled={disabled}
              onChange={(event) => set({ [key]: event.target.value })}
            />
          );
        })}
        {TEXT_FIELDS.filter((field) => pp || !field.ppOnly).map(({ key, max }) => (
          <TextField
            key={key}
            label={t[key]}
            size="lg"
            maxLength={max}
            value={header[key] ?? ''}
            disabled={disabled}
            onChange={(event) => set({ [key]: event.target.value })}
          />
        ))}
        <Checkbox
          checked={header.rohsFlag}
          disabled={disabled}
          onChange={(event) => set({ rohsFlag: event.target.checked })}
        >
          {t.rohsFlag}
        </Checkbox>
        <div className="field-cell">
          <span className="field-label">{t.overallResult}</span>
          <Select
            aria-label={t.overallResult}
            options={[
              { value: '', label: t.overallNone },
              { value: 'OK', label: 'OK' },
              { value: 'NG', label: 'NG' },
            ]}
            value={header.overallResultCode ?? ''}
            disabled={disabled}
            onChange={(value) =>
              set({ overallResultCode: value === '' ? null : (value as InspectionSheetJudgment) })
            }
          />
        </div>
      </div>
      <div className="form-actions">
        <Button
          size="lg"
          variant="outlined"
          disabled={disabled || isSaving || !changed}
          onClick={() => onSave(trimmed(header))}
        >
          {isSaving ? messages.popInspectionSheet.saving : t.save}
        </Button>
      </div>
    </section>
  );
};
