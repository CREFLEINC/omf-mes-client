import { messages } from '@omf-mes/i18n';

import { useApiClient } from '../../patterns/api-context';
import { InspectionSkipPane } from '../inspection-skip/skip-pane';
import { oqcInspectionKeys } from '../oqc-inspection/queries';
import { pqcInspectionKeys } from '../pqc-inspection/queries';

export interface PqcSkipPaneProps {
  workOrderId: number;
  /** 의뢰 상태. 생략(SKIPPED)으로 닫혔으면 그 사실만 말한다. */
  requestStatusCode: string;
  /** 생략 근거 — 기본 생략(DEFAULT)이면 결재 없이 처음부터 생략된 것이라 그렇게 말한다. */
  skipBasisCode: string | null;
}

/**
 * W-03-11 의 「PQC 생략」 구획(omf-all-around#212 · 서버 선행 P-152). 단위는 작업지시다 — 실행하면 그 작업지시의
 * 열린 PQC 의뢰가 생략되고 검사 대기 생산 LOT 이 정상이 된다.
 */
export const PqcSkipPane = ({
  workOrderId,
  requestStatusCode,
  skipBasisCode,
}: PqcSkipPaneProps) => {
  const { client } = useApiClient();

  return (
    <InspectionSkipPane
      texts={messages.pqcInspectionRegister.skip}
      approvalTypeCode="PQC_SKIP"
      targetTypeCode="WORK_ORDER"
      targetId={workOrderId}
      requestStatusCode={requestStatusCode}
      skipBasisCode={skipBasisCode}
      requestSkip={(body, headers) =>
        client.POST('/production/work-orders/{workOrderId}:request-pqc-skip', {
          params: {
            path: { workOrderId },
            header: { 'Idempotency-Key': headers['Idempotency-Key'] },
          },
          body,
        })
      }
      executeSkip={(_body, headers) =>
        client.POST('/production/work-orders/{workOrderId}:skip-pqc', {
          params: {
            path: { workOrderId },
            header: { 'Idempotency-Key': headers['Idempotency-Key'] },
          },
        })
      }
      /* 목록은 OQC 화면의 질의를 함께 쓴다 — 그 열쇠 아래에 둬야 실행 뒤 목록과 함께 다시 부른다. */
      queryKeyRoot={oqcInspectionKeys.all}
      invalidateKeys={[oqcInspectionKeys.all, pqcInspectionKeys.all]}
    />
  );
};
