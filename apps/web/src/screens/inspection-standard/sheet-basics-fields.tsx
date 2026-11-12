import {
  TemplateBasicFields,
  type TemplateBasics,
} from '../inspection-sheet-template/basic-dialog';
import { useBusinessUnitNames } from '../inspection-sheet-template/queries';

/**
 * 검사 기준 등록 창에서 PQC 를 고른 OA 계정에게 보이는 검사표 기준 칸 — 사업부 · 출력 양식(omf-all-around#260).
 * 기준코드 · 기준명 · 품목은 등록 창의 칸을 그대로 쓴다. 사업부 이름은 이 칸이 설 때만 받는다.
 */
export const SheetBasicsFields = ({
  values,
  onChange,
  businessUnitIds,
}: {
  values: TemplateBasics;
  onChange: (patch: Partial<TemplateBasics>) => void;
  businessUnitIds: readonly number[];
}) => {
  const businessUnits = useBusinessUnitNames();
  return (
    <TemplateBasicFields
      part="scope"
      values={values}
      onChange={onChange}
      errors={{}}
      businessUnitIds={businessUnitIds}
      businessUnitNames={businessUnits.data ?? new Map<number, string>()}
    />
  );
};
