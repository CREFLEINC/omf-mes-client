import { Button, type ButtonSize, type ButtonVariant } from '@crefle/web-ui';
import { useId } from 'react';

export interface DisabledActionProps {
  label: string;
  /** 「무엇이 막혔는지 + 누가 풀 수 있는지」를 담는다. 컨트롤 이름으로 시작한다. */
  reason: string;
  /**
   * 주 액션이 막힌 자리에는 `filled`를 쓴다 — 활성일 때와 같은 위계로 보여야 사용자가
   * 「어느 버튼이 원래 주 액션인지」를 잃지 않는다.
   *
   * 기본은 `outlined`다. `text`는 잠기면 흐린 글자만 남아 버튼으로 읽히지 않는다.
   */
  variant?: Extract<ButtonVariant, 'filled' | 'outlined'>;
  /**
   * 잠기지 않았을 때의 그 버튼과 **같은 크기**여야 한다 — 잠길 때만 크기가 바뀌면
   * 활성 버튼과 나란히 선 줄이 어긋난다. 「열기」는 구획 안 부 액션이라 `sm`이다.
   */
  size?: ButtonSize;
}

/**
 * 사유가 붙은 비활성 액션 하나. **배치 규범 4를 그대로 구현한다.**
 *
 * - 사유는 감추지 않고 항상 보이는 DOM 텍스트로 렌더하고 `aria-describedby`로 잇는다.
 *   **비활성 컨트롤은 포커스를 받지 못해** 툴팁만으로는 키보드·스크린리더 사용자가 닿을 수 없다.
 * - 사유는 그 컨트롤 바로 아래 왼쪽 가장자리를 맞춰 놓는다(`.field-cell`).
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const DisabledAction = ({
  label,
  reason,
  variant = 'outlined',
  size,
}: DisabledActionProps) => {
  const noteId = useId();

  return (
    <div className="field-cell">
      <Button variant={variant} size={size} disabled aria-describedby={noteId}>
        {label}
      </Button>
      <span id={noteId} className="field-note">
        {reason}
      </span>
    </div>
  );
};
