import { Stepper, type StepperItem } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { formatDateTime, orderedRounds, type InspectionResultRound } from './types';

/**
 * 회차 이력 — ⛔ **읽기 전용이다.**
 *
 * 재검사는 앞 회차를 고치는 것이 아니라 새 회차를 쌓고 `previousResultId` 로 사슬을 잇는다
 * (스펙 §5-3). 그래서 여기에는 **누를 것이 없다** — 편집으로 읽힐 여지를 만들지 않는다.
 *
 * ⭐ **`Stepper` 세로 배치로 그린다.** 회차는 사슬이라 「1 → 2 → 3」이라는 진행이 값의 일부다.
 * 표로 그리면 그 진행이 행 순서에만 남아, 재검사가 «다시 한 것»인지 «다른 것»인지 흐려진다.
 *
 * ⛔ **`rejected` 상태를 쓰지 않는다.** 불합격 판정은 「반려」가 아니다 — 정상적으로 끝난 검사다.
 * 반려 표시를 쓰면 이력이 「무언가 잘못됐다」로 읽힌다.
 *
 * ⛔ **판정을 표시명으로 옮기지 않는다.** 옮기려면 공통코드 조회가 하나 더 필요하고, 그 조회가
 * 실패하면 이력이 통째로 비어 보인다. 사용 중지된 코드도 그대로 남아야 한다 — 이 자리가 하는
 * 일은 「앞에 무엇이 있었나」를 남기는 것이라 코드 그대로가 오히려 정확하다.
 *
 * ⭐ **회차가 하나뿐이면 아무것도 그리지 않는다.** 「이전 회차 없음」을 내면 재검사가 없는
 * 대다수 의뢰에서 화면이 없는 것을 설명하느라 길어진다 — 이력은 쌓였을 때만 볼 것이다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */

const t = messages.oqcInspection.history;

const CONFIRMED = '확정';

export interface RoundHistoryProps {
  rounds: InspectionResultRound[];
  /**
   * 지금 폼이 다루는 회차. 확정되지 않은 그 회차만 「진행 중」으로 표시한다.
   *
   * 재검사 중에는 새 회차가 아직 만들어지지 않았으므로 `null` 이고, 그때 이력에는 진행 중인
   * 단계가 없다 — 없는 회차를 그리면 사용자가 그것을 저장된 것으로 읽는다.
   */
  currentResultId: number | null;
  /**
   * 지금 재검사 회차를 쓰는 중인가.
   *
   * ⭐ **참이면 회차가 하나여도 그린다.** 그때 폼에는 회차가 넘어가지 않으므로(「아직 없는 새
   * 회차」다), 이력까지 감추면 검사자가 **「앞에 무엇이 있었나」를 볼 자리가 화면 어디에도 없는
   * 채로** 되돌릴 수 없는 쓰기를 친다.
   */
  isReinspecting?: boolean;
}

const toStep = (round: InspectionResultRound, currentResultId: number | null): StepperItem => ({
  icon: String(round.inspectionRound),
  /* 판정 코드 그대로. 비어 온 회차는 지어내지 않고 「없음」이라고 말한다. */
  label: round.overallJudgmentCode.trim() === '' ? t.noJudgment : round.overallJudgmentCode,
  status:
    round.statusCode === CONFIRMED
      ? 'complete'
      : round.inspectionResultId === currentResultId
        ? 'current'
        : 'pending',
  /*
   * ⛔ **두 값을 줄로 가른다.** 그냥 `<span>` 둘을 나란히 두면 인라인이라 한 줄로 이어 붙어
   * 「보류 0확정 2026-08-31 10:00」으로 읽힌다 — 수량 칸이라 **「0확정」이 값처럼 보이는**
   * 오독이다. `.stacked-cell` 이 이미 그 일을 하는 공용 클래스라 새로 만들지 않는다.
   */
  description: (
    <span className="stacked-cell">
      <span>
        {t.quantities(String(round.acceptedQty), String(round.rejectedQty), String(round.heldQty))}
      </span>
      <span>
        {round.confirmedAt === null
          ? t.notConfirmed
          : t.confirmedAt(formatDateTime(round.confirmedAt))}
      </span>
    </span>
  ),
});

export const RoundHistory = ({
  rounds,
  currentResultId,
  isReinspecting = false,
}: RoundHistoryProps) => {
  /* 쌓였을 때만 볼 것이다 — 회차 하나짜리 이력은 설명할 것이 없다. 재검사 중에는 예외다. */
  if (rounds.length <= 1 && !isReinspecting) return null;
  if (rounds.length === 0) return null;

  return (
    <section aria-label={t.heading}>
      <h3>{t.heading}</h3>
      <Stepper
        orientation="vertical"
        size="sm"
        steps={orderedRounds(rounds).map((round) => toStep(round, currentResultId))}
      />
    </section>
  );
};
