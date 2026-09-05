import { messages } from '@omf-mes/i18n';

/**
 * 출하 진행 상태(`shipmentProgressCode`)의 표시명.
 *
 * 이 값은 **계약이 닫은 enum 6값**이고 서버가 라인 수량을 롤업해 내린다 — 고객이 늘리지 않으므로
 * 공통코드 등록부에 없고 `GET /mdm/code-values`를 부르지 않는다. 그래서 표시명은 **화면이 갖는다**
 * (공유계약 G-33 · 코드 사전 CD-SHIPMENT-PROGRESS). 낱말은 출하 예정 목록(W-04-02)과 같다.
 *
 * 모르는 값(계약이 늘어난 뒤 아직 라벨이 없는 값)은 코드를 그대로 보인다 — 뜻을 지어내지 않는다(G-9).
 */
export const shipmentProgressLabel = (code: string): string => {
  const labels: Record<string, string> = messages.shipmentProcessing.list.progressCodes;
  return labels[code] ?? code;
};
