import { Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import type { InspectionRequest } from './types';

const t = messages.workStart.blocked;
const labels = messages.workStart.selection;

export interface SessionEntryActionsProps {
  onHold: () => void;
  onRunningChange: () => void;
  onPacking: () => void;
  /**
   * 고른 지시의 끝나지 않은 PQC 검사 의뢰. 비어 있으면 그 버튼을 세우지 않는다. 의뢰가 없는
   * 지시는 PQC 대상이 아니다.
   */
  pendingPqc: InspectionRequest[];
  onPqcInspection: (inspectionRequestId: number) => void;
}

/**
 * 열린 세션이 있는 작업지시에서 다른 작업 화면으로 가는 길(omf-all-around#42). 오른쪽 「작업 확인」
 * 구획의 「다른 작업」 묶음이다.
 *
 * 작업 중단(`P-02-10`), 부품 교체(`P-02-11`), PQC 검사(`P-02-13`), 포장 작업(`P-02-08`)은 모두
 * 작업지시(또는 그 지시의 검사 의뢰)를 주소로 받아야 열린다. 쓰기는 없고 자리만 옮긴다.
 *
 * 모두 보조 동작이라 테두리 버튼이다. 채움 버튼은 하단 바의 주 동작 [작업 이어하기] 하나다(C-3).
 */
export const SessionEntryActions = ({
  onHold,
  onRunningChange,
  onPacking,
  pendingPqc,
  onPqcInspection,
}: SessionEntryActionsProps) => (
  <div className="work-start-group" role="group" aria-label={labels.otherWork}>
    <h3 className="work-start-group-title">{labels.otherWork}</h3>
    <div className="work-start-other-work">
      <Button type="button" variant="outlined" size="lg" onClick={onHold}>
        {t.holdWork}
      </Button>
      <Button type="button" variant="outlined" size="lg" onClick={onRunningChange}>
        {t.runningChange}
      </Button>
      {/*
       * 화면이 대신 고르지 않는다(omf-all-around#42). 의뢰가 여럿이면 의뢰마다 버튼을 세우고 번호를
       * 함께 적는다. 하나뿐이면 번호를 적지 않는다.
       */}
      {pendingPqc.map((request) => (
        <Button
          key={request.inspectionRequestId}
          type="button"
          variant="outlined"
          size="lg"
          onClick={() => {
            onPqcInspection(request.inspectionRequestId);
          }}
        >
          {pendingPqc.length === 1
            ? t.pqcInspection
            : t.pqcInspectionOf(request.inspectionRequestNo)}
        </Button>
      ))}
      <Button type="button" variant="outlined" size="lg" onClick={onPacking}>
        {t.packingWork}
      </Button>
    </div>
  </div>
);
