import { messages } from '@omf-mes/i18n';
import { useId } from 'react';
import { useSearchParams } from 'react-router';

import { Select } from '../../patterns/select';
import { InspectionSheetTemplateScreen } from '../inspection-sheet-template/screen';
import { FieldLabel } from './field-label';
import { InspectionStandardScreen } from './screen';
import { SHEET_TYPE, useInspectionTypeOptions } from './type-options';

const t = messages.inspectionStandard;

/** 검사표 기준 조회 줄 맨 앞의 검사 유형 칸 — 다른 유형을 고르면 검사 기준 조회로 돌아간다(omf-all-around#255). */
const SheetTypeSelect = () => {
  const id = useId();
  const [, setSearchParams] = useSearchParams();
  const options = useInspectionTypeOptions();
  return (
    <div className="field-cell inspection-standard-type-filter">
      <FieldLabel htmlFor={id} label={t.filters.inspectionType} />
      <Select
        id={id}
        options={[{ value: '', label: t.filters.typeAll }, ...options]}
        value={SHEET_TYPE}
        onChange={(value) => {
          if (value !== SHEET_TYPE) setSearchParams(value === '' ? {} : { type: value });
        }}
      />
    </div>
  );
};

/** 검사 기준 탭 — 검사 유형이 「제품 검사표 (OA)」면 검사표 기준 화면을, 아니면 검사 기준 화면을 연다. */
export const InspectionStandardRoute = () => {
  const [searchParams] = useSearchParams();
  return searchParams.get('type') === SHEET_TYPE ? (
    <InspectionSheetTemplateScreen typeSelect={<SheetTypeSelect />} />
  ) : (
    <InspectionStandardScreen />
  );
};
