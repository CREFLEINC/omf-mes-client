import { messages } from '@omf-mes/i18n';
import { useEffect, useId } from 'react';
import { useLocation, useSearchParams } from 'react-router';

import { Select } from '../../patterns/select';
import type { TemplateBasics } from '../inspection-sheet-template/basic-dialog';
import { InspectionSheetTemplateScreen } from '../inspection-sheet-template/screen';
import { INSPECTION_TYPE_OPTIONS } from './code-options';
import { FieldLabel } from './field-label';
import { InspectionStandardScreen } from './screen';
import { SHEET_TYPE, useSheetForPqc } from './type-options';

const t = messages.inspectionStandard;

/** 검사표 기준 조회 줄 맨 앞의 검사 유형 칸 — 다른 유형을 고르면 검사 기준 조회로 돌아간다(omf-all-around#255). */
const SheetTypeSelect = () => {
  const id = useId();
  const [, setSearchParams] = useSearchParams();
  return (
    <div className="field-cell inspection-standard-type-filter">
      <FieldLabel htmlFor={id} label={t.filters.inspectionType} />
      <Select
        id={id}
        options={[{ value: '', label: t.filters.typeAll }, ...INSPECTION_TYPE_OPTIONS]}
        value={SHEET_TYPE}
        onChange={(value) => {
          if (value !== SHEET_TYPE) setSearchParams(value === '' ? {} : { type: value });
        }}
      />
    </div>
  );
};

/** 검사 기준 탭 — OA 공장 계정이 검사 유형 PQC 를 고르면 검사표 기준 화면을, 아니면 검사 기준 화면을 연다. */
export const InspectionStandardRoute = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const sheetForPqc = useSheetForPqc();
  const isSheet = sheetForPqc && searchParams.get('type') === SHEET_TYPE;
  /*
   * 검사 기준 「기준 추가」 창에서 PQC 를 고르고 품목 · 사업부 · 출력 양식을 채워 「확인」하면 그 값을 들고 넘어온다
   * (사용자 지시 · #258). 검사표 화면이 붙는 그 렌더에 읽혀 새 편집을 열고, 이동 기록에서는 바로 지운다 —
   * 새로고침 · 뒤로 가기로 다시 열리지 않게.
   */
  const location = useLocation();
  const startBasics = (location.state as { sheetBasics?: TemplateBasics } | null)?.sheetBasics;
  useEffect(() => {
    if (startBasics === undefined) return;
    setSearchParams(searchParams, { replace: true, state: null });
  }, [startBasics, searchParams, setSearchParams]);
  return isSheet ? (
    <InspectionSheetTemplateScreen typeSelect={<SheetTypeSelect />} startBasics={startBasics} />
  ) : (
    <InspectionStandardScreen />
  );
};
