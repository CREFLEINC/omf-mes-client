import { Button } from '@crefle/web-ui';
import { useId } from 'react';

export interface DisabledActionProps {
  label: string;
  /** 「무엇이 막혔는지 + 어떻게 풀 것인가」를 담는다. 컨트롤 이름으로 시작한다. */
  reason: string;
  /** 액션 줄에서 위치를 정하는 배치 클래스(예: `form-actions-secondary`). */
  className?: string;
}

/**
 * 사유가 붙은 비활성 액션 하나. **배치 규범 4를 그대로 구현한다.**
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 * 승격은 세 번째가 아니라 **네 번째** 사용처의 판단이며, 공통 부품 변경은 여러 화면을
 * 한꺼번에 끌고 가므로 이번 작업의 범위가 아니다.
 *
 * - 사유는 감추지 않고 항상 보이는 DOM 텍스트로 렌더하고 `aria-describedby`로 잇는다.
 *   비활성 컨트롤은 포커스를 받지 못해 툴팁만으로는 키보드·스크린리더 사용자가 닿을 수 없다.
 * - 사유는 그 컨트롤 바로 아래 왼쪽 가장자리를 맞춰 놓는다(`.field-cell`).
 * - `variant`는 `outlined`다. `text`는 비활성일 때 흐린 글자만 남아 버튼으로 읽히지 않는다.
 */
export const DisabledAction = ({ label, reason, className }: DisabledActionProps) => {
  const noteId = useId();

  return (
    <div className={className === undefined ? 'field-cell' : `field-cell ${className}`}>
      <Button variant="outlined" disabled aria-describedby={noteId}>
        {label}
      </Button>
      <span id={noteId} className="field-note">
        {reason}
      </span>
    </div>
  );
};
