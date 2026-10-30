import { useOaAccess, useScopedPlants } from '../../patterns/oa-access';
import { IqcInspectionScreen } from '../iqc-inspection/screen';
import { PartsIqcInspectionScreen } from './screen';

/**
 * 「검사 조회·판정 > IQC」 탭(omf-all-around#211) — 사용자 설정의 공장(데이터 범위)으로 화면을 고른다. 주소·권한은 하나다.
 *   - 범위에 OA 공장이 있으면 OA 화면, 부품 공장만 있으면 부품 화면(사용자 지시 2026-10-29 — 전환 단추 없이)
 *   - 판단할 근거를 못 받으면 OA 화면(종전 동작) — 서버가 권한을 가른다
 */
export const IqcInspectionRoute = () => {
  const access = useOaAccess();
  const plants = useScopedPlants();

  /*
   * ⛔ 판단 중에도 OA 화면을 둔다 — 그 화면의 덮개(`OaOnlyGate`)가 「확인 중」을 보인다. 여기서 따로 안내를 세우면
   * 조회가 실패할 때 OA 화면이 붙을 때마다 같은 조회를 다시 불러 「확인 중 ↔ OA 화면」이 끝없이 갈마든다.
   */
  if (access === 'not-oa' && plants.status === 'ready' && plants.parts.length > 0) {
    return <PartsIqcInspectionScreen plants={plants.parts} />;
  }
  return <IqcInspectionScreen />;
};
