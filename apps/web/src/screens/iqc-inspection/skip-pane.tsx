import { messages } from '@omf-mes/i18n';

import { useApiClient } from '../../patterns/api-context';
import { INSPECTION_HUB_COUNTS_KEY } from '../../patterns/inspection-hub-counts';
import { InspectionSkipPane } from '../inspection-skip/skip-pane';
import { iqcInspectionKeys } from './queries';

export interface IqcSkipPaneProps {
  lotId: number;
  /** 의뢰 상태. 생략(SKIPPED)으로 닫혔으면 그 사실만 말한다. */
  requestStatusCode: string;
  /** 생략 근거 — 기본 생략(DEFAULT)이면 결재 없이 처음부터 생략된 것이라 그렇게 말한다. */
  skipBasisCode: string | null;
  /** 계정에 연결된 작업자의 사번 — 요청이 함께 보낸다(서버가 사번을 요구한다). 없으면 요청하지 못한다. */
  workerNo: string | null;
}

/**
 * W-01-01 의 「IQC 생략」 구획(omf-all-around#212). 단위는 입하 LOT 이다 — PDA 「IQC 생략 요청」(M-01-13)과 같은 요청을
 * 관리웹에서도 올리고, 승인 뒤 여기서 실행한다(OQC·PQC 생략 구획과 같은 모양).
 */
export const IqcSkipPane = ({
  lotId,
  requestStatusCode,
  skipBasisCode,
  workerNo,
}: IqcSkipPaneProps) => {
  const { client } = useApiClient();
  const t = messages.iqcInspection.skip;

  return (
    <InspectionSkipPane
      texts={t}
      approvalTypeCode="IQC_SKIP"
      targetTypeCode="INBOUND_LOT"
      targetId={lotId}
      requestStatusCode={requestStatusCode}
      skipBasisCode={skipBasisCode}
      requestSkip={(body, headers) =>
        client.POST('/trace/lots/{lotId}:request-iqc-skip', {
          params: {
            path: { lotId },
            header: {
              'Idempotency-Key': headers['Idempotency-Key'],
              'X-Worker-No': workerNo ?? '',
            },
          },
          body,
        })
      }
      executeSkip={(_body, headers) =>
        client.POST('/trace/lots/{lotId}:skip-iqc', {
          params: { path: { lotId }, header: { 'Idempotency-Key': headers['Idempotency-Key'] } },
        })
      }
      queryKeyRoot={iqcInspectionKeys.all}
      invalidateKeys={[iqcInspectionKeys.all, INSPECTION_HUB_COUNTS_KEY]}
      requestBlockedReason={workerNo === null ? t.workerNotLinked : null}
    />
  );
};
