import { useOaAccess } from '../../patterns/oa-access';
import { useSession } from '../../patterns/session';
import { toWebAccess } from '../../patterns/web-access';

/**
 * OA 공장은 PQC 를 제품 검사표로 한다 — 검사 유형 PQC 를 고르면 검사표 기준을 연다(omf-all-around#255 사용자 지시).
 * 부품 공장은 PQC 검사 기준 그대로다. OA 판단은 IQC 탭(#211)과 같다 — 계정 범위에 OA 공장이 있으면 OA.
 */
export const SHEET_TYPE = 'PQC';

/** 검사표 기준의 옛 주소 — 권한(W-06-24)은 이 주소로 판단한다. 들어오면 검사 기준 탭으로 옮긴다. */
export const SHEET_TEMPLATE_PATH = '/master-data/inspection-sheet-template';

/** 검사 유형 PQC 가 검사표 기준을 여는가 — OA 공장 계정이고 검사표 기준 권한이 있을 때. */
export const useSheetForPqc = (): boolean => {
  const oa = useOaAccess();
  const { session } = useSession();
  return oa === 'oa' && toWebAccess(session?.permissions).allows(SHEET_TEMPLATE_PATH);
};
