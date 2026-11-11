import { messages } from '@omf-mes/i18n';

import { useOaAccess } from '../../patterns/oa-access';
import { useSession } from '../../patterns/session';
import { toWebAccess } from '../../patterns/web-access';
import { INSPECTION_TYPE_OPTIONS } from './code-options';
import type { SelectOption } from './types';

/**
 * 검사 유형 「제품 검사표 (OA)」 — 검사표 기준(W-06-24)을 검사 기준 탭에 합쳤다(omf-all-around#255).
 * 서버의 검사 유형 코드가 아니라 화면이 탭 안에서 검사표 기준을 여는 값이다 — 검사 기준 조회로 보내지 않는다.
 */
export const SHEET_TYPE = 'SHEET';

/** 검사표 기준의 옛 주소 — 권한(W-06-24)은 이 주소로 판단한다. 들어오면 검사 기준 탭으로 옮긴다. */
export const SHEET_TEMPLATE_PATH = '/master-data/inspection-sheet-template';

/** 검사 유형 선택지 — OA 공장 계정이고 검사표 기준 권한이 있으면 「제품 검사표 (OA)」를 더한다. */
export const useInspectionTypeOptions = (): SelectOption[] => {
  const oa = useOaAccess();
  const { session } = useSession();
  const sheetAllowed = oa === 'oa' && toWebAccess(session?.permissions).allows(SHEET_TEMPLATE_PATH);
  return sheetAllowed
    ? [
        ...INSPECTION_TYPE_OPTIONS,
        { value: SHEET_TYPE, label: messages.inspectionStandard.values.inspectionTypes.sheet },
      ]
    : INSPECTION_TYPE_OPTIONS;
};
