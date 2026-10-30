import type {
  InspectionSheetLayoutCode,
  InspectionSheetLotSlot,
  InspectionSheetMethodCode,
  InspectionSheetStepCode,
  InspectionSheetTemplate,
  InspectionSheetTemplateUpdate,
} from '@omf-mes/api-client';
import { ko, messages, vi } from '@omf-mes/i18n';

const t = messages.inspectionSheetTemplate;

/** 출력 양식이 칸을 가진 단계 — 서버도 같은 목록으로 막는다(장부 P-102). */
export const LAYOUT_STEPS: Record<InspectionSheetLayoutCode, readonly InspectionSheetStepCode[]> = {
  OP: ['PROCESS_1', 'PROCESS_2', 'PROCESS_3', 'PROCESS_4', 'PROCESS_5', 'SHIPMENT', 'CROSS_CHECK'],
  PP: ['PROCESS_1', 'PROCESS_2', 'PROCESS_3', 'SHIPMENT', 'CROSS_CHECK', 'SAMPLING'],
};

export const LOT_SLOTS: readonly InspectionSheetLotSlot[] = ['PCB', 'SD', 'STAPLE'];

export interface ItemDraft {
  /** 화면 안에서만 쓰는 줄 열쇠 — 줄을 빼도 다른 줄의 입력이 섞이지 않게. */
  key: string;
  checkItemCode: string;
  nameKo: string;
  nameVi: string;
  methodCode: InspectionSheetMethodCode;
}

export interface StepDraft {
  stepCode: InspectionSheetStepCode;
  enabled: boolean;
  nameKo: string;
  nameVi: string;
  signRequired: boolean;
  items: ItemDraft[];
}

export interface LotSourceDraft {
  slotCode: InspectionSheetLotSlot;
  itemId: number;
  label: string;
}

export interface TemplateDraft {
  itemId: number | null;
  itemLabel: string;
  businessUnitId: number | null;
  formLayoutCode: InspectionSheetLayoutCode;
  materialText: string;
  structureText: string;
  rohsFlag: boolean;
  productNameText: string;
  powerText: string;
  motorText: string;
  remarks: string;
  lotSources: LotSourceDraft[];
  steps: StepDraft[];
}

let keySeed = 0;
export const nextKey = (): string => `row-${(keySeed += 1)}`;

/**
 * 양식의 단계 전부를 줄로 둔다 — 쓰지 않는 단계는 꺼 둔다. 서명은 양식의 서명 칸이 있는 단계가 기본으로 켜진다
 * (두 양식 모두 판정 줄마다 서명 칸이 있다 · 담당자 결정 ③).
 */
export const layoutSteps = (
  layout: InspectionSheetLayoutCode,
  kept: readonly StepDraft[] = [],
): StepDraft[] =>
  LAYOUT_STEPS[layout].map(
    (stepCode) =>
      kept.find((step) => step.stepCode === stepCode) ?? {
        stepCode,
        enabled: false,
        nameKo: ko.inspectionSheetTemplate.steps[stepCode] ?? stepCode,
        nameVi: vi.inspectionSheetTemplate.steps[stepCode] ?? '',
        signRequired: true,
        items: [],
      },
  );

/** 새 기준의 재료 기본 글 — 검사표에 그대로 찍히는 글이라 화면 언어와 상관없이 이 글이다(사용자 지시 2026-10-30). */
export const DEFAULT_MATERIAL_TEXT =
  '프레임 및 기타 금속 부품은 통상 상태에서 위험하지 않은 재료를 사용하고 방청 처리함';

export const emptyDraft = (businessUnitId: number | null): TemplateDraft => ({
  itemId: null,
  itemLabel: '',
  businessUnitId,
  formLayoutCode: 'OP',
  materialText: DEFAULT_MATERIAL_TEXT,
  structureText: '',
  rohsFlag: true,
  productNameText: '',
  powerText: '',
  motorText: '',
  remarks: '',
  lotSources: [],
  /* 새 기준은 공정검사1을 켠 채로 시작한다(사용자 지시 2026-10-30). */
  steps: layoutSteps('OP').map((step) =>
    step.stepCode === 'PROCESS_1' ? { ...step, enabled: true } : step,
  ),
});

export const toDraft = (template: InspectionSheetTemplate): TemplateDraft => {
  const saved: StepDraft[] = (template.steps ?? []).map((step) => ({
    stepCode: step.stepCode,
    enabled: true,
    nameKo: step.nameKo,
    nameVi: step.nameVi ?? '',
    signRequired: step.signRequired,
    items: step.items.map((item) => ({
      key: nextKey(),
      checkItemCode: item.checkItemCode,
      nameKo: item.nameKo,
      nameVi: item.nameVi ?? '',
      methodCode: item.methodCode,
    })),
  }));
  return {
    itemId: template.itemId,
    itemLabel: `${template.itemName} (${template.itemCode})`,
    businessUnitId: template.businessUnitId,
    formLayoutCode: template.formLayoutCode,
    materialText: template.materialText ?? '',
    structureText: template.structureText ?? '',
    rohsFlag: template.rohsFlag,
    productNameText: template.productNameText ?? '',
    powerText: template.powerText ?? '',
    motorText: template.motorText ?? '',
    remarks: template.remarks ?? '',
    lotSources: (template.lotSources ?? []).map((source) => ({
      slotCode: source.slotCode,
      itemId: source.itemId,
      label: `${source.itemName} (${source.itemCode})`,
    })),
    steps: layoutSteps(template.formLayoutCode, saved),
  };
};

const text = (value: string): string | null => (value.trim() === '' ? null : value.trim());

/** 켠 단계만 양식 순서대로 보낸다. PP 전용 칸은 OP 양식이면 비운다. */
export const toBody = (draft: TemplateDraft): InspectionSheetTemplateUpdate => {
  const pp = draft.formLayoutCode === 'PP';
  return {
    materialText: text(draft.materialText),
    structureText: text(draft.structureText),
    rohsFlag: draft.rohsFlag,
    productNameText: pp ? text(draft.productNameText) : null,
    powerText: pp ? text(draft.powerText) : null,
    motorText: pp ? text(draft.motorText) : null,
    remarks: text(draft.remarks),
    lotSources: draft.lotSources.map(({ slotCode, itemId }) => ({ slotCode, itemId })),
    steps: draft.steps
      .filter((step) => step.enabled)
      .map((step) => ({
        stepCode: step.stepCode,
        nameKo: step.nameKo.trim(),
        nameVi: text(step.nameVi),
        signRequired: step.signRequired,
        items: step.items.map((item) => ({
          checkItemCode: item.checkItemCode.trim(),
          nameKo: item.nameKo.trim(),
          nameVi: text(item.nameVi),
          methodCode: item.methodCode,
        })),
      })),
  };
};

/** 칸 오류 — 열쇠는 `item`·`steps`·`<stepCode>.name`·`<itemKey>.code`·`<itemKey>.name`. */
export const validateDraft = (draft: TemplateDraft): Record<string, string> => {
  const errors: Record<string, string> = {};
  if (draft.itemId === null) errors.item = t.editor.noModel;
  const enabled = draft.steps.filter((step) => step.enabled);
  if (enabled.length === 0) errors.steps = t.validation.noStep;
  for (const step of enabled) {
    if (step.nameKo.trim() === '') errors[`${step.stepCode}.name`] = t.validation.stepName;
    for (const item of step.items) {
      if (item.checkItemCode.trim() === '') errors[`${item.key}.code`] = t.validation.itemCode;
      if (item.nameKo.trim() === '') errors[`${item.key}.name`] = t.validation.itemName;
    }
  }
  return errors;
};

/** 구조 및 중량 — 화면은 W · D · H(mm) · 중량(kg) 네 칸으로 받고, 저장은 기존 한 글 칸에 합쳐 넣는다(사용자 결정 2026-10-30). */
export interface StructureParts {
  w: string;
  d: string;
  h: string;
  weight: string;
}

const STRUCTURE_PATTERN =
  /^(?:W (\d*\.?\d*) × D (\d*\.?\d*) × H (\d*\.?\d*) mm)?(?: \/ )?(?:(\d+\.?\d*) kg)?$/;

/** 「W 300 × D 200 × H 150 mm / 2.3 kg」 — 빈 칸은 빼고 합친다. 네 칸이 모두 비면 빈 글. */
export const composeStructure = ({ w, d, h, weight }: StructureParts): string => {
  const size =
    w.trim() || d.trim() || h.trim() ? `W ${w.trim()} × D ${d.trim()} × H ${h.trim()} mm` : '';
  const mass = weight.trim() ? `${weight.trim()} kg` : '';
  return [size, mass].filter((part) => part !== '').join(' / ');
};

/** 이 화면이 합친 글이면 네 칸으로 되돌린다. 예전에 손으로 쓴 글이면 null — 화면은 그 글을 따로 보여 준다. */
export const parseStructure = (text: string): StructureParts | null => {
  const match = STRUCTURE_PATTERN.exec(text.trim());
  if (match === null) return null;
  return { w: match[1] ?? '', d: match[2] ?? '', h: match[3] ?? '', weight: match[4] ?? '' };
};
