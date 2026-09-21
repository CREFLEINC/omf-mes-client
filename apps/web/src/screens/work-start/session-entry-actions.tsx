import { Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import type { InspectionRequest } from './types';

const t = messages.workStart.blocked;

export interface SessionEntryActionsProps {
  /** 이미 열려 있는 세션으로 자리를 옮긴다(자재 투입). */
  onContinue: () => void;
  onHold: () => void;
  onRunningChange: () => void;
  onPacking: () => void;
  /**
   * 고른 지시의 **끝나지 않은 PQC 검사 의뢰**. 비어 있으면 그 단추를 세우지 않는다 —
   * 의뢰가 없는 지시는 PQC 대상이 아니다.
   */
  pendingPqc: InspectionRequest[];
  onPqcInspection: (inspectionRequestId: number) => void;
}

/**
 * 열린 세션이 있는 작업지시에서 **다음 작업 화면으로 가는 길**(omf-all-around#42).
 *
 * ⭐ **한 조건에 한 묶음이다.** 작업 중단(`P-02-10`)·부품 교체(`P-02-11`)·PQC 검사
 *    (`P-02-13`)·포장 작업(`P-02-08`)은 모두 작업지시(또는 그 지시의 검사 의뢰)를 **주소로**
 *    받아야 열리고, 받지 못하면 저마다 「작업 시작 화면에서 고른 뒤 들어오세요」로 막힌다.
 *    그 안내가 가리키는 자리가 여기다 — 설치본에는 주소창이 없어 손으로 넣을 수도 없다.
 *
 * ⛔ **쓰기가 하나도 없다.** 전부 «자리를 옮기는» 것뿐이다 — 중단 사유·교체 부품·검사값·포장
 *    수량은 각 화면이 받는다.
 *
 * ⚠ **1024×768 의 가로 예산.** 단추는 목록의 [ 전체 보기 ]와 같은 `xl` 에 최소 폭 9rem 으로
 *   서고(`work-start-head-button`), 띠의 조작 칸이 `flex-wrap` 이라 넘치면 다음 줄로 접힌다.
 *   넷(+PQC 의뢰 수)이 한 줄에 서는 폭이지만, 의뢰번호가 붙는 단추는 길어 접힐 수 있다 —
 *   세로로 커지는 쪽이 잘려 사라지는 것보다 낫다.
 */
export const SessionEntryActions = ({
  onContinue,
  onHold,
  onRunningChange,
  onPacking,
  pendingPqc,
  onPqcInspection,
}: SessionEntryActionsProps) => (
  <>
    {/*
     * ⛔ **쓰기가 아니다.** 이미 열린 세션으로 «자리를 옮기는» 것뿐이라 여기서 아무것도
     *    보내지 않는다 — 재개(`RESUME` 적재)는 중단 상태의 사건이고(§5-4) 이 갈래가 아니다.
     *
     * ⭐ **크기는 목록의 [ 전체 보기 ]와 같게 둔다**(`xl` · 사용자 지시 2026-09-16). 이 단추는
     *    띠 안에 있지만 작업자가 실제로 누르는 다음 걸음이라, 같은 화면의 다른 조작보다
     *    작으면 눌러야 할 자리로 읽히지 않는다. 뒤따르는 단추도 같은 규격으로 세운다.
     */}
    <Button
      type="button"
      variant="outlined"
      size="xl"
      className="work-start-head-button"
      onClick={onContinue}
    >
      {t.continueToSession}
    </Button>
    {/*
     * ⭐ **작업 중단은 세션 사건이라**(`P-02-10` §5-2) [ 이어서 하기 ]와 같은 조건에서 선다 —
     *    조건이 갈리면 한쪽만 보이는 날 작업자는 다른 쪽이 사라진 이유를 알 수 없다.
     */}
    <Button
      type="button"
      variant="outlined"
      size="xl"
      className="work-start-head-button"
      onClick={onHold}
    >
      {t.holdWork}
    </Button>
    <Button
      type="button"
      variant="outlined"
      size="xl"
      className="work-start-head-button"
      onClick={onRunningChange}
    >
      {t.runningChange}
    </Button>
    {/*
     * ⛔ **화면이 대신 고르지 않는다**(omf-all-around#42). 의뢰가 여럿이면 의뢰마다 단추를
     *    세우고 번호를 함께 적는다 — 하나를 골라 열어 주면 작업자가 «어느 검사인지 모르는
     *    채로» 측정값을 넣게 된다. 하나뿐이면 번호를 적지 않는다(고를 것이 없다).
     */}
    {pendingPqc.map((request) => (
      <Button
        key={request.inspectionRequestId}
        type="button"
        variant="outlined"
        size="xl"
        className="work-start-head-button"
        onClick={() => {
          onPqcInspection(request.inspectionRequestId);
        }}
      >
        {pendingPqc.length === 1 ? t.pqcInspection : t.pqcInspectionOf(request.inspectionRequestNo)}
      </Button>
    ))}
    <Button
      type="button"
      variant="outlined"
      size="xl"
      className="work-start-head-button"
      onClick={onPacking}
    >
      {t.packingWork}
    </Button>
  </>
);
