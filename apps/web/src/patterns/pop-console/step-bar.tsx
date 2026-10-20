import { Icon } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useNavigate } from 'react-router';

import { POP_WORK_STEPS, stepDestination, stepIndexOf } from './work-steps';

const t = messages.popChrome.console.steps;

export interface PopStepBarProps {
  pathname: string;
  workOrderId: number | null;
}

/**
 * 작업장 콘솔의 **단계 표시줄** — 이어진 화살표 띠. 지난 단계는 ✓, 지금 단계는 짙게, 앞 단계는 옅게.
 * 누르면 그 단계로 간다.
 *
 * ⭐ **화면 폭을 다 쓴다.** 단계가 단추 몇 개로 왼쪽에 몰려 있으면 「몇 단계 중 어디」가 읽히지
 *    않는다 — 띠 하나를 단계 수로 나눠, 지금 자리가 띠 위 위치로 보이게 한다(Opcenter·Tulip).
 *
 * ⚠ 작업지시가 필요한 단계는 작업지시를 모르면 잠기고, 까닭은 손을 얹으면 나온다(공유계약 G-2 —
 *   감추지 않고 비활성 + 사유).
 */
export const PopStepBar = ({ pathname, workOrderId }: PopStepBarProps) => {
  const navigate = useNavigate();
  const current = stepIndexOf(pathname);

  return (
    <nav className="pop-console-steps" aria-label={t.label}>
      <ol>
        {POP_WORK_STEPS.map((step, index) => {
          const destination = stepDestination(step, workOrderId);
          const isCurrent = index === current;
          const state = isCurrent ? 'current' : index < current ? 'done' : 'todo';

          return (
            <li key={step.key} data-state={state}>
              <button
                type="button"
                aria-current={isCurrent ? 'step' : undefined}
                disabled={!isCurrent && destination === null}
                title={destination === null ? t.needWorkOrder : undefined}
                onClick={() => {
                  if (isCurrent || destination === null) return;

                  void navigate(destination);
                }}
              >
                <span className="pop-console-steps__no" aria-hidden="true">
                  {state === 'done' ? <Icon name="check" size={24} /> : index + 1}
                </span>
                {step.screen.name}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
