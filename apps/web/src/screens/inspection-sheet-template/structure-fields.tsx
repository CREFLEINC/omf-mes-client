import { TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import { composeStructure, parseStructure, type StructureParts } from './draft';

const t = messages.inspectionSheetTemplate;

const DIMENSIONS = [
  ['w', 'structureW', 'mm'],
  ['d', 'structureD', 'mm'],
  ['h', 'structureH', 'mm'],
  ['weight', 'structureWeight', 'kg'],
] as const;

/** 숫자만(소수점 하나까지) — 합친 글이 다시 네 칸으로 풀리게 한다. */
const NUMBER = /^\d*\.?\d*$/;

/**
 * 구조 및 중량 — W · D · H(mm) · 중량(kg)을 칸마다 받아 한 글로 합쳐 저장한다(사용자 지시 2026-10-30).
 * 예전에 손으로 쓴 글은 칸으로 못 푸니 그 글을 아래에 보여 주고, 칸에 새로 넣으면 그 글을 바꾼다.
 */
export const StructureFields = ({
  text,
  disabled,
  onChange,
}: {
  text: string;
  disabled: boolean;
  onChange: (text: string) => void;
}) => {
  const parsed = parseStructure(text);
  const [parts, setParts] = useState<StructureParts>(parsed ?? { w: '', d: '', h: '', weight: '' });
  const legacy = parsed === null && text.trim() !== '' ? text : null;
  return (
    <fieldset className="inspection-sheet-template-structure">
      <legend className="field-label">{t.editor.structureText}</legend>
      <div className="inspection-sheet-template-structure-fields">
        {DIMENSIONS.map(([key, label, unit]) => (
          <TextField
            key={key}
            label={`${t.editor[label]} (${unit})`}
            inputMode="decimal"
            value={parts[key]}
            disabled={disabled}
            onChange={(event) => {
              const value = event.target.value.trim();
              if (!NUMBER.test(value)) return;
              const next = { ...parts, [key]: value };
              setParts(next);
              onChange(composeStructure(next));
            }}
          />
        ))}
      </div>
      {legacy !== null && <p className="field-note">{t.editor.structureLegacy(legacy)}</p>}
    </fieldset>
  );
};
