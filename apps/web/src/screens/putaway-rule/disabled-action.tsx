import { Button } from '@crefle/web-ui';
import { useId } from 'react';

export interface DisabledActionProps {
  label: string;
  /** 「무엇이 막혔는지 + 어떻게 풀 것인가」를 담는다. 컨트롤 이름으로 시작한다. */
  reason: string;
  /**
   * 주 액션(저장·등록)이 막힌 자리에는 `filled`를 쓴다.
   * 활성일 때와 같은 위계로 보여야 사용자가 「어느 버튼이 원래 주 액션인지」를 잃지 않는다.
   */
  variant?: 'filled' | 'outlined';
}

/**
 * 사유가 붙은 비활성 액션 하나. **배치 규범 4를 그대로 구현한다.**
 *
 * - 사유는 감추지 않고 항상 보이는 DOM 텍스트로 렌더하고 `aria-describedby`로 잇는다.
 *   비활성 컨트롤은 포커스를 받지 못해 툴팁만으로는 키보드·스크린리더 사용자가 닿을 수 없다.
 * - 사유는 그 컨트롤 바로 아래 왼쪽 가장자리를 맞춰 놓는다(`.field-cell`).
 * - 기본 `variant`는 `outlined`다. `text`는 비활성일 때 흐린 글자만 남아 버튼으로 읽히지 않는다.
 *
 * **배치 클래스(`className`)를 받지 않는다.** 전례에는 있으나 이 슬라이스의 소비처가
 * 액션 줄에서 자리를 따로 정하지 않는다 — 값만 안 넘기고 인자를 남기면 「이 슬라이스에
 * 그 자리가 없다」가 타입 수준의 사실이 되지 못한다(사본 체크리스트 7번).
 *
 * ✅ **이차 액션이 서는 회차(끄기·켜기)가 실측으로 그 예고를 닫았다** — 전환 구획이 자체
 * 액션 줄을 가져 배치 인자가 필요 없었다. 지금 소비처는 폼(저장·취소)·머리글(규칙 추가)·
 * 전환 구획 셋이며 **어느 자리도 이 인자를 요구하지 않는다.**
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const DisabledAction = ({ label, reason, variant = 'outlined' }: DisabledActionProps) => {
  const noteId = useId();

  return (
    <div className="field-cell">
      <Button variant={variant} disabled aria-describedby={noteId}>
        {label}
      </Button>
      <span id={noteId} className="field-note">
        {reason}
      </span>
    </div>
  );
};
