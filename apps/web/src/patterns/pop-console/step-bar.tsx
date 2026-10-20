import { Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useNavigate } from 'react-router';

import { POP_WORK_STEPS, stepDestination, stepIndexOf } from './work-steps';

const t = messages.popChrome.console.steps;

export interface PopStepBarProps {
  pathname: string;
  workOrderId: number | null;
}

/**
 * 작업장 콘솔의 **단계 표시줄** — 지금 단계를 강조하고, 누르면 그 단계로 간다.
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

          return (
            <li key={step.key} data-current={isCurrent ? 'true' : undefined}>
              <Button
                variant={isCurrent ? 'filled' : 'outlined'}
                size="lg"
                aria-current={isCurrent ? 'step' : undefined}
                disabled={!isCurrent && destination === null}
                title={destination === null ? t.needWorkOrder : undefined}
                onClick={() => {
                  if (isCurrent || destination === null) return;

                  void navigate(destination);
                }}
              >
                <span className="pop-console-steps__no" aria-hidden="true">
                  {index + 1}
                </span>
                {step.screen.name}
              </Button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
