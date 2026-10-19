import { Button, Icon, PageHeader, Stepper, type StepperItem } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { ActionBar } from '../action-bar';

const t = messages.common.processPage;

export interface ProcessStep {
  key: string;
  /** 명사형 2~6자(T-W-C) */
  label: string;
}

export interface ProcessPageProps {
  /** [← 〈작업함 이름〉]의 이름 */
  backLabel: string;
  onBack: () => void;
  /** 쓰기를 보내는 중이면 작업함으로 돌아가지 않는다 */
  isLocked?: boolean;
  /** 대상 번호 */
  title: string;
  /** 대상 요약(상대, 일시, 문서 번호) 한 줄 */
  summary?: ReactNode;
  steps: readonly ProcessStep[];
  /**
   * 지금 단계의 차례(0부터). `steps.length`이면 모든 단계를 마친 완료 화면이다.
   */
  currentStep: number;
  /** 완료한 단계를 눌렀을 때. 주지 않으면 단계 표시에서 돌아갈 수 없다(완료 화면 등) */
  onStepSelect?: (index: number) => void;
  /** 「지난 단계 요약」 한 줄. 지난 단계에서 정한 값만 */
  previousSummary?: ReactNode;
  /** 현재 단계 하나의 본문 */
  children: ReactNode;
  /** 하단 동작 바 */
  remaining?: string;
  remainingId: string;
  actions: ReactNode;
}

const stepStatus = (index: number, current: number): StepperItem['status'] => {
  if (index < current) return 'complete';
  if (index === current) return 'current';

  return 'pending';
};

/**
 * 처리 화면 틀 — 화면 구성 규범 T-W-C, C-5.
 *
 * 위에서 아래로 처리 머리([← 작업함], 대상 번호, 요약) · 단계 표시(가로 `Stepper`) · 지난 단계 요약 ·
 * 단계 본문 · 하단 동작 바. 화면은 단계 목록과 현재 단계, 본문, 동작만 넘긴다.
 *
 * **완료한 단계는 단계 표시에서 눌러 돌아갈 수 있다.** DS `Stepper`가 단계 클릭을 받지 않아
 * 완료한 단계의 이름을 버튼으로 그린다. 아직 갈 수 없는 단계는 글자만 있다.
 */
export const ProcessPage = ({
  backLabel,
  onBack,
  isLocked = false,
  title,
  summary,
  steps,
  currentStep,
  onStepSelect,
  previousSummary,
  children,
  remaining,
  remainingId,
  actions,
}: ProcessPageProps) => {
  const items: StepperItem[] = steps.map((step, index) => {
    const status = stepStatus(index, currentStep);
    const canReturn = status === 'complete' && onStepSelect !== undefined && !isLocked;

    return {
      status,
      label: canReturn ? (
        <button
          type="button"
          className="process-page-step-link"
          aria-label={t.returnToStep(step.label)}
          onClick={() => {
            onStepSelect(index);
          }}
        >
          {step.label}
        </button>
      ) : (
        step.label
      ),
    };
  });

  return (
    <div className="process-page">
      <PageHeader
        title={title}
        breadcrumb={
          <Button
            variant="text"
            size="sm"
            className="process-page-back"
            leadingIcon={<Icon name="arrow_back" size={18} />}
            disabled={isLocked}
            onClick={onBack}
          >
            {backLabel}
          </Button>
        }
        description={summary}
      />

      <Stepper className="process-page-steps" aria-label={t.steps} steps={items} size="sm" />

      {previousSummary !== undefined && (
        <p className="process-page-previous" aria-label={t.previousSummary}>
          {previousSummary}
        </p>
      )}

      <div className="process-page-body">{children}</div>

      <ActionBar remaining={remaining} remainingId={remainingId}>
        {actions}
      </ActionBar>
    </div>
  );
};
