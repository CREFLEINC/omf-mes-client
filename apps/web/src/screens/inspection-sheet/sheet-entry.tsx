import { useToast } from '@crefle/web-ui';
import type { InspectionSheet } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useRef } from 'react';

import { SaveErrorBanner } from '../../patterns/master';
import { HeaderPanel } from '../pop-inspection-sheet/header-panel';
import { NgPanel } from '../pop-inspection-sheet/ng-panel';
import { useSaveHeader, useSaveNgs, useSaveStep } from '../pop-inspection-sheet/queries';
import { StepPanel } from '../pop-inspection-sheet/step-panel';

const t = messages.popInspectionSheet;

export interface SheetEntryProps {
  sheet: InspectionSheet;
  /** 검사표를 받은 시각 — 바뀌면 머리 값 · NG 입력을 새 값으로 다시 채운다(POP 와 같다). */
  version: number;
  /** 저장 충돌 등으로 검사표를 다시 받는다. */
  onReload: () => void;
}

/**
 * 관리웹 검사 입력 탭(omf-all-around#316) — POP 「제품 검사표 입력」과 같은 입력 부품 · 같은 서버 경로다.
 * 사번을 싣지 않으므로 서버가 로그인 계정을 작성자 · 검사자로 남긴다. 완료된 검사표는 탭 자체가 없다.
 */
export const SheetEntry = ({ sheet, version, onReload }: SheetEntryProps) => {
  const toast = useToast();
  const id = sheet.inspectionSheetId;
  const saveHeader = useSaveHeader(id, () =>
    toast.show({ variant: 'success', description: t.header.saved }),
  );
  // 임시 저장(판정 없이 항목만)이었는지 — 알림 문구를 가른다(POP 와 같다).
  const draftSave = useRef(false);
  const saveStep = useSaveStep(id, () =>
    toast.show({
      variant: 'success',
      description: draftSave.current ? t.step.draftSaved : messages.common.saved,
    }),
  );
  const saveNgs = useSaveNgs(id, () => toast.show({ variant: 'success', description: t.ng.saved }));
  const disabled = sheet.statusCode === 'COMPLETED';

  return (
    <div className="inspection-sheet-entry">
      <SaveErrorBanner
        error={saveHeader.error ?? saveStep.error ?? saveNgs.error}
        onReload={onReload}
      />
      <HeaderPanel
        key={`header-${version}`}
        web
        sheet={sheet}
        disabled={disabled}
        isSaving={saveHeader.isSaving}
        onSave={saveHeader.write}
      />
      <StepPanel
        web
        steps={sheet.steps}
        disabled={disabled}
        isSaving={saveStep.isSaving}
        onSave={(variables) => {
          draftSave.current = variables.body.firstJudgmentCode === undefined;
          saveStep.write(variables);
        }}
      />
      <NgPanel
        key={`ngs-${version}`}
        web
        sheet={sheet}
        disabled={disabled}
        isSaving={saveNgs.isSaving}
        onSave={saveNgs.write}
      />
    </div>
  );
};
