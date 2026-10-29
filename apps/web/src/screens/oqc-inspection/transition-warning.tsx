import { Icon } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import type { TransitionPreview } from './transition-preview';

/**
 * 판정 확정이 LOT 상태를 전이시킨다는 경고 — **누르기 «전»에 선다.**
 *
 * 네 규칙을 담는다(스펙 §5-2 J-7):
 *
 * | 규칙 | 이 화면의 문장 |
 * | :-: | --- |
 * | ① 대상 규모를 숫자로 | 지금 친 세 칸을 그대로 되읽는다 |
 * | ② 다른 화면에 미치는 영향 | 진행 중 피킹이 함께 막힌다 — ⚠ **건수를 쓰지 않는다**(셀 자리가 이 화면에 없다) |
 * | ③ 되돌림 비용 | 이미 피킹된 분은 회수되지 않는다 · 판정은 수정할 수 없다 |
 * | ④ 푸는 경로 | 불합격분의 처분은 다른 화면 — ⚠ **링크를 걸지 않는다**(그 화면이 아직 없다) |
 *
 * ⛔ **셀 수 없으면 경고 자체를 그리지 않는다** — `preview` 가 `null` 인 자리다. 숫자가 거짓이
 * 되는 동안 경고를 세우면, 화면이 **거짓 숫자를 근거로 되돌릴 수 없는 쓰기를 권하게 된다.**
 *
 * ⛔ **모르는 판정 코드에 방향을 지어내지 않는다** — 사용자가 그 문장을 근거로 누른다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */

const t = messages.oqcInspection.transition;

const DIRECTION_TEXT = {
  release: t.directionRelease,
  hold: t.directionHold,
  pending: t.directionPending,
  /* 모르는 코드 — 방향을 빼고 「바뀐다」는 사실만 남긴다. */
  unknown: t.directionUnknown,
} as const;

/** 대상 LOT 이 없는 의뢰 = 출하작업지시 OQC — 서버가 집은(피킹) LOT 에 판정을 남긴다(omf-all-around#119 · 서버 P-83). */
const PICKED_DIRECTION_TEXT = {
  release: t.pickedDirectionRelease,
  hold: t.pickedDirectionHold,
  pending: t.pickedDirectionPending,
  unknown: t.directionUnknown,
} as const;

export interface TransitionWarningProps {
  /** `null` 이면 아무것도 그리지 않는다 — 셀 수 없는 동안 숫자가 거짓이 된다 */
  preview: TransitionPreview | null;
  /**
   * 의뢰에 대상 LOT 이 있는가. **없으면 출하작업지시 OQC 다** — 서버가 그 지시가 집은 LOT 에 판정을
   * 남긴다(합격 C4 · 불합격 C6 · 보류는 그대로 · omf-all-around#119). 방향 문장만 바뀌고 저장 조건은 그대로다.
   */
  hasLot?: boolean;
}

/**
 * 경고의 **본문만**. 확인 창이 같은 문장을 다시 써야 하는데, 배너째로 겹치면 같은 알림이 두 번
 * 읽힌다(둘 다 `role="alert"` 이다) — 그래서 본문을 따로 갖는다.
 */
export const TransitionWarningBody = ({ preview, hasLot = true }: TransitionWarningProps) => {
  if (preview === null) return null;

  return (
    <>
      <p>{t.quantities(preview.accepted, preview.rejected, preview.held)}</p>
      <p>{(hasLot ? DIRECTION_TEXT : PICKED_DIRECTION_TEXT)[preview.direction]}</p>
      <p>{t.pickingImpact}</p>
      <p>{t.pickedNotReturned}</p>
      <p>{t.noAmendment}</p>
      <p>{t.dispositionPath}</p>
    </>
  );
};

export type JudgmentGuideProps = TransitionWarningProps;

/**
 * 판정 구획의 「판정 확정 안내」(#136) — 확정 전에 되돌릴 수 없음 · LOT 영향을 한 상자에. 수량과 고른 판정은
 * 바로 위 칸들이 이미 보이므로 되풀이하지 않는다.
 * 규칙은 위 경고와 같다(셀 수 없으면 그리지 않는다 · 모르는 코드에 방향을 지어내지 않는다). 확인 창은 종전 본문을 그대로 쓴다.
 */
export const JudgmentGuide = ({ preview, hasLot = true }: JudgmentGuideProps) => {
  if (preview === null) return null;
  const g = t.guide;

  return (
    /*
     * 경고 한 줄(굵게) · 그 아래 보조 문장 · 구분선 · LOT 이 어떻게 되는지 한 줄 — 파란 안내 상자(사용자 시안 2026-10-29 · #197).
     * 제목은 화면에 세우지 않고 구획 이름(화면 읽기)으로만 남긴다.
     */
    <section className="oqc-inspection-guide" aria-label={g.title}>
      <p className="oqc-inspection-guide-line" data-tone="warning">
        <Icon name="warning" size={18} aria-hidden="true" />
        <span>
          {g.irreversible}
          <span className="oqc-inspection-guide-sub">{g.irreversibleHint}</span>
        </span>
      </p>
      <hr className="oqc-inspection-guide-divider" />
      <p className="oqc-inspection-guide-line" data-tone="info">
        <Icon name="info" size={18} aria-hidden="true" />
        <span>
          <span>{(hasLot ? DIRECTION_TEXT : PICKED_DIRECTION_TEXT)[preview.direction]}</span>{' '}
          <span>{t.pickingImpact}</span>
        </span>
      </p>
    </section>
  );
};
