import { Icon } from '@crefle/web-ui';

import './task-facts.css';

/**
 * 적치 지시의 값 칸(`dl`)에 붙이는 클래스. 이름과 값을 `div` 로 짝지어 두면 두 칸씩 선다.
 * 화면마다 값과 이름이 달라 부품으로 감싸지 않고 생김새만 나눈다.
 */
export const TASK_FACTS = 'task-facts';

export interface TaskRouteProps {
  /** 지금 있는 곳. 「현재 TMP-01」 */
  from?: string;
  /** 가야 할 곳. 「권장 위치 A-01-03」 */
  to?: string;
  /** 가야 할 곳이 없을 때의 말. 「권장 위치 없음」 */
  missing: string;
}

/** 어디서 어디로. 가야 할 곳이 어두운 칸이라 눈이 먼저 간다. */
export const TaskRoute = ({ from, to, missing }: TaskRouteProps) => (
  <p className="task-route">
    {from === undefined ? null : (
      <>
        <span className="task-route__loc">{from}</span>
        <Icon name="arrow_forward" size={16} className="task-route__arrow" />
      </>
    )}
    {to === undefined ? (
      <span className="task-route__loc task-route__loc--none">{missing}</span>
    ) : (
      <span className="task-route__loc task-route__loc--to">{to}</span>
    )}
  </p>
);
