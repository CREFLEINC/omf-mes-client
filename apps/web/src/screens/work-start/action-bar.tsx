import { Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { POP_TOUCH_SIZE } from './touch-spec';

const t = messages.workStart.actions;

export interface ActionBarProps {
  /** 재개인가 시작인가. 두 버튼은 **다른 경로**다 — 이름도 갈린다. */
  mode: 'start' | 'resume';
  /**
   * 막혀 있는가. **사유는 여기서 그리지 않는다** — 머리줄 바로 아래 배너가 「왜 못 하는지와
   * 무엇을 하면 되는지」를 말한다(G-3 · §9-2). 이 바는 그 사실을 버튼 잠금으로만 받는다.
   *
   * ⛔ **잠금만 두고 끝내는 것이 아니다.** 사유가 화면 어딘가에 반드시 함께 서야 한다 —
   * 회색 버튼만 있으면 작업자는 단말이 고장 난 줄 안다. 자리를 옮기더라도 그 짝은 유지한다.
   */
  isBlocked: boolean;
  isSaving: boolean;
  onSubmit: () => void;
}

/**
 * 액션바(스펙 §4 액션바 88).
 *
 * ⭐ **72픽셀 급이다** — 되돌릴 수 없는 조작이고, 디자인 시스템의 `2xl` 이 그 치수를 준다
 * (§7 「G-5 해소 2026-08-28」).
 *
 * ⭐ **[ 다시 선택 ] 을 두지 않는다.** 고른 것을 무르는 길은 «카드를 한 번 더 누르는 것»
 * 하나다 — 이 화면은 지시를 하나만 고르므로(§5-A) 무르기가 목록 밖에 따로 설 이유가 없고,
 * 조작이 둘이면 같은 일을 하는 길이 갈려 나중에 한쪽만 고쳐진다.
 *
 * ⚠ 설계 §4 도면에는 그 버튼이 그려져 있다 — 요청서 D 로 확인을 올렸다.
 */
export const ActionBar = ({ mode, isBlocked, isSaving, onSubmit }: ActionBarProps) => (
  <div className="work-start-actions">
    <div className="work-start-actions-row">
      <Button
        type="button"
        variant="filled"
        size={POP_TOUCH_SIZE}
        disabled={isBlocked || isSaving}
        onClick={onSubmit}
      >
        {isSaving ? t.starting : mode === 'resume' ? t.resume : t.start}
      </Button>
    </div>
  </div>
);
