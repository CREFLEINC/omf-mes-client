import { Button, Icon, Stepper, type StepStatus } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useLayoutEffect, useRef, type ReactNode } from 'react';

/**
 * T-W-C 처리 화면 틀. 위에서 아래로 처리 머리, 단계 표시, 지난 단계 요약, 단계 본문, 하단 동작 바.
 *
 * 화면은 제목, 요약, 단계, 본문, 동작만 넘긴다(C-11). 완료한 단계는 단계 표시에서 눌러 돌아간다.
 * `ProcessStepper`는 DS `Stepper`에 단계 클릭이 생기기 전까지의 감싸개다.
 */
const t = messages.screenPatterns;

export interface ProcessStep {
  key: string;
  label: string;
  status: StepStatus;
  /** 완료 단계를 눌러 돌아갈 수 있는가. 완료 화면에서는 false. */
  canReturn?: boolean;
}

export interface ProcessStepperProps {
  steps: ProcessStep[];
  onSelect: (key: string) => void;
}

export const ProcessStepper = ({ steps, onSelect }: ProcessStepperProps) => (
  <Stepper
    className="process-stepper"
    aria-label={t.processPage.steps}
    size="sm"
    steps={steps.map((step) => ({
      status: step.status,
      label:
        step.status === 'complete' && step.canReturn !== false ? (
          <button
            type="button"
            className="process-stepper-return"
            aria-label={t.processPage.stepDone(step.label)}
            onClick={() => onSelect(step.key)}
          >
            {step.label}
          </button>
        ) : (
          <span aria-current={step.status === 'current' ? 'step' : undefined}>{step.label}</span>
        ),
    }))}
  />
);

export interface EffectItem {
  key: string;
  label: string;
  /** 조건에 따라 빠지는 반영 사항(C-9). 지운 줄과 사유로 보인다. */
  excludedReason?: string;
}

export const EffectList = ({ task, items }: { task: string; items: EffectItem[] }) => (
  <section className="effect-list" aria-label={t.effectList.title(task)}>
    <h3 className="effect-list-title">{t.effectList.title(task)}</h3>
    <ul>
      {items.map((item) => (
        <li
          key={item.key}
          className={item.excludedReason === undefined ? undefined : 'is-excluded'}
        >
          {item.excludedReason === undefined ? (
            item.label
          ) : (
            <>
              <s>{item.label}</s>
              <span className="effect-list-excluded">
                {t.effectList.excluded}: {item.excludedReason}
              </span>
            </>
          )}
        </li>
      ))}
    </ul>
  </section>
);

/** 지난 단계 요약의 「라벨 값」 쌍. 정해지지 않은 값은 `unset`으로 경고 색 글자다. */
export interface PastSummaryPair {
  label: string;
  value: string;
  unset?: boolean;
}

/** 지난 단계 하나의 묶음. 앞에 단계 이름을 둔다. */
export interface PastSummaryGroup {
  step: string;
  pairs: PastSummaryPair[];
}

/**
 * 지난 단계 요약(T-W-C 지난 단계 요약 형식). 단계별 묶음과 「라벨 값」 쌍으로 쓰고, 묶음 사이는 세로 구분선이다.
 * 한 줄에 다 들어가지 않으면 묶음마다 한 줄로 나눈다(묶음 안에서는 줄바꿈하지 않는다).
 */
export const PastSummary = ({ groups }: { groups: PastSummaryGroup[] }) => {
  const ref = useRef<HTMLDivElement>(null);
  const signature = JSON.stringify(groups);
  useLayoutEffect(() => {
    const element = ref.current;
    if (element === null) return undefined;
    const measure = () => {
      element.classList.remove('is-stacked');
      element.classList.toggle('is-stacked', element.scrollWidth > element.clientWidth + 1);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [signature]);
  return (
    <div
      ref={ref}
      className="process-page-past"
      role="group"
      aria-label={t.processPage.pastSummary}
    >
      {groups.map((group) => (
        <div key={group.step} className="process-past-group">
          <span className="process-past-step">{group.step}</span>
          <dl className="process-past-pairs">
            {group.pairs.map((pair, index) => (
              <div key={`${pair.label}-${String(index)}`} className="process-past-pair">
                <dt>{pair.label}</dt>
                <dd className={pair.unset === true ? 'is-unset' : undefined}>{pair.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
};

export interface ProcessPageProps {
  backLabel: string;
  onBack: () => void;
  /** 대상 번호. 작업함 제목과 같은 제목 크기(C-19 1단계). */
  title: string;
  /** 제목 옆 상태 칩과 사유 칩 */
  badges?: ReactNode;
  /** 대상 요약 한 줄(상대, 품목, 수량, 일시, 문서 번호). 줄 수는 상태와 관계없이 하나다. */
  summary: ReactNode;
  /** 처리 머리 오른쪽의 보조 동작(재실행 등). 채움 버튼을 두지 않는다. */
  headerActions?: ReactNode;
  steps: ProcessStep[];
  onSelectStep: (key: string) => void;
  /** 지난 단계에서 정한 값만. 단계별 묶음과 「라벨 값」 쌍. */
  pastSummary?: PastSummaryGroup[];
  children: ReactNode;
  actionBar: ReactNode;
}

export const ProcessPage = ({
  backLabel,
  onBack,
  title,
  badges,
  summary,
  headerActions,
  steps,
  onSelectStep,
  pastSummary,
  children,
  actionBar,
}: ProcessPageProps) => (
  <div className="process-page">
    <header className="process-page-head">
      <div className="process-page-title-row">
        <Button
          variant="text"
          size="sm"
          className="process-page-back"
          leadingIcon={<Icon name="arrow_back" size={18} aria-hidden="true" />}
          onClick={onBack}
        >
          {backLabel}
        </Button>
        <h1 className="process-page-title">{title}</h1>
        {badges !== undefined && <div className="process-page-badges">{badges}</div>}
        {headerActions !== undefined && (
          <div className="process-page-head-actions">{headerActions}</div>
        )}
      </div>
      <div className="process-page-summary">{summary}</div>
    </header>
    <ProcessStepper steps={steps} onSelect={onSelectStep} />
    {pastSummary !== undefined && pastSummary.length > 0 && <PastSummary groups={pastSummary} />}
    <div className="process-page-body">{children}</div>
    {actionBar}
  </div>
);
