import {
  TemplateBasicFields,
  type TemplateBasics,
} from '../inspection-sheet-template/basic-dialog';
import { useBusinessUnitNames } from '../inspection-sheet-template/queries';

/**
 * 검사 기준 「기준 추가」 창에서 PQC 를 고른 OA 계정에게 창 아래 보이는 검사표 기준 칸(사용자 지시 · #258) —
 * 「새 검사표 기준」 창과 같은 품목 · 사업부 · 출력 양식. 사업부 이름은 이 칸이 설 때만 받는다.
 */
export const SheetBasicsFields = ({
  values,
  onChange,
  itemError,
  businessUnitIds,
}: {
  values: TemplateBasics;
  onChange: (patch: Partial<TemplateBasics>) => void;
  itemError: string;
  businessUnitIds: readonly number[];
}) => {
  const businessUnits = useBusinessUnitNames();
  return (
    <TemplateBasicFields
      values={values}
      onChange={onChange}
      itemError={itemError}
      businessUnitIds={businessUnitIds}
      businessUnitNames={businessUnits.data ?? new Map<number, string>()}
    />
  );
};
