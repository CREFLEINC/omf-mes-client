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
 * ⭐ **[ 작업 이어하기 ]가 한 단계 위다**(사용자 지시 2026-09-21). 지금 해야 할 일 하나를
 *    채움(`filled`)으로 세우고 나머지는 테두리(`outlined`)로 남긴다 — 넷이 같은 무게로
 *    서면 무엇을 먼저 누르는지가 화면에 없다. ⛔ 새 색을 만들지 않는다.
 *
 * ⭐ **보조는 제 상자에 모은다**(2차 개선 · 사용자 지시 2026-09-21). 주 단추와 보조 묶음을
 *    가느다란 구분선 하나로 가른다 — 「기타 작업」 같은 **말을 새로 늘리지 않고** 두 영역이
 *    갈린다(선은 기존 테두리 토큰 하나뿐이고 장식이 아니다).
 *
 * ⚠ **1024×768 의 예산.** 높이는 48 로 묶여 있고(`pop.css`) 주 단추만 폭 하한 9rem 을
 *   지킨다(`work-start-head-button` · 사용자 지시 2026-09-19). 보조는 글자만큼만 서서 묶음으로
 *   읽힌다 — 넷을 모두 9rem 로 두면 띠 폭을 가로질러 흩어진다(사용자 지적). 안내 글까지 한
 *   줄에 서고, 좁아지면 보조 묶음이 통째로 다음 줄로 접힌다.
 */
export const SessionEntryActions = ({
  onContinue,
  onHold,
  onRunningChange,
  onPacking,
  pendingPqc,
  onPqcInspection,
}: SessionEntryActionsProps) => (
  <div className="work-start-entry-actions">
    {/*
     * ⛔ **쓰기가 아니다.** 이미 열린 세션으로 «자리를 옮기는» 것뿐이라 여기서 아무것도
     *    보내지 않는다 — 재개(`RESUME` 적재)는 중단 상태의 사건이고(§5-4) 이 갈래가 아니다.
     *
     * ⭐ **높이는 48 로 낮춘다**(`lg` · 사용자 지시 2026-09-19 — 앞 판은 목록의 [ 전체 보기 ]와
     *    같은 `xl`·72 였다). 폭 하한은 그대로라 누를 자리로는 계속 읽힌다(`pop.css`).
     *
     * ⭐ **채움은 이 하나뿐이다**(사용자 지시 2026-09-21) — 「진행 중이면 이어서 한다」가 이
     *    자리의 기본 걸음이고, 나머지 셋은 그때그때 고르는 갈래다.
     */}
    <Button
      type="button"
      variant="filled"
      size="lg"
      className="work-start-head-button"
      onClick={onContinue}
    >
      {t.continueToSession}
    </Button>
    {/*
     * 보조 작업 — ⭐ **한 상자에 모은다.** 넷이 한 줄에 흩어지면 서로 관련된 갈래로 읽히지
     *    않는다(사용자 지적). 상자가 구분선과 간격을 함께 들고, 좁아지면 통째로 접힌다.
     *
     * ⭐ **작업 중단은 세션 사건이라**(`P-02-10` §5-2) [ 작업 이어하기 ]와 같은 조건에서 선다 —
     *    조건이 갈리면 한쪽만 보이는 날 작업자는 다른 쪽이 사라진 이유를 알 수 없다.
     */}
    <div className="work-start-entry-others">
      <Button
        type="button"
        variant="outlined"
        size="lg"
        className="work-start-entry-secondary"
        onClick={onHold}
      >
        {t.holdWork}
      </Button>
      <Button
        type="button"
        variant="outlined"
        size="lg"
        className="work-start-entry-secondary"
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
          size="lg"
          className="work-start-entry-secondary"
          onClick={() => {
            onPqcInspection(request.inspectionRequestId);
          }}
        >
          {pendingPqc.length === 1
            ? t.pqcInspection
            : t.pqcInspectionOf(request.inspectionRequestNo)}
        </Button>
      ))}
      <Button
        type="button"
        variant="outlined"
        size="lg"
        className="work-start-entry-secondary"
        onClick={onPacking}
      >
        {t.packingWork}
      </Button>
    </div>
  </div>
);
