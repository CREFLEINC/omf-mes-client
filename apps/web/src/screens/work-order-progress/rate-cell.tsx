import { Progress } from '@crefle/web-ui';

export interface RateCellProps {
  /** 막대로 그릴 값(0~100). `null` 이면 막대 없이 글자만 보인다 — 받지 못한 달성률이다. */
  percent: number | null;
  /** 서버가 준 달성률을 글자로 바꾼 것(「65%」). ⛔ 막대 길이에서 다시 계산하지 않는다(L-2). */
  text: string;
  /** 막대의 접근 이름 — 「달성률」. */
  label: string;
}

/**
 * 달성률 한 칸 — 막대와 숫자를 한 줄에 둔다(C-16). 줄끼리 길이로 견주고, 정확한 값은 숫자로 읽는다.
 *
 * 색은 하나다. 다 채운 줄만 성공 색으로 바꾼다 — 빨강은 지연에만 쓴다(C-19).
 */
export const RateCell = ({ percent, text, label }: RateCellProps) =>
  percent === null ? (
    <>{text}</>
  ) : (
    <span className="work-order-progress-rate">
      <Progress
        className="work-order-progress-rate-bar"
        label={label}
        size="sm"
        tone={percent >= 100 ? 'success' : 'info'}
        value={percent}
        valueText={text}
      />
      <span className="work-order-progress-rate-text">{text}</span>
    </span>
  );
