import { Icon } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState, type ReactNode } from 'react';

const t = messages.common.inspectionHub;

export interface InspectionStepItem {
  title: string;
  /** 이 단계를 다 채웠다 — 접힌 머리에 요약 · 「펼쳐서 수정」이 서고, 다시 열 때 다음 단계부터 펼친다. */
  done: boolean;
  /** 접힌 마친 단계의 한 줄 요약. */
  summary?: string;
  /** 서버가 이 단계의 칸을 짚어 되돌렸다 — 접혀 있어도 이 단계를 펼쳐 오류를 보인다. */
  attention?: boolean;
  /** 펼친 단계의 입력. `confirm` 은 이 단계를 마치고 다음 단계를 펼친다([확정]). */
  render: (confirm: () => void) => ReactNode;
}

export interface InspectionStepsProps {
  steps: readonly InspectionStepItem[];
  /** 잠긴 회차(확정 · 입력 불가) — 단계를 모두 펼쳐 보인다. 접고 펼 일이 없다. */
  showAll?: boolean;
}

/**
 * 검사 입력 단계(PQC · OQC · #197) — IQC 판정 화면과 같은 짜임. 단계를 위아래로 쌓고 지금 단계만 펼친다. [확정]으로 다음
 * 단계를 펼치고, 마친 단계는 요약 한 줄 + 「펼쳐서 수정」으로 접는다. 아직 닿지 않은 단계는 그리지 않는다.
 *
 * 처음에는 «덜 채운 첫 단계»를 펼친다 — 저장된 회차를 다시 열면 채운 만큼 앞 단계가 접혀 있다. 의뢰가 바뀌면 부르는 쪽이
 * `key` 로 새로 그린다.
 */
export const InspectionSteps = ({ steps, showAll = false }: InspectionStepsProps) => {
  const [touched, setTouched] = useState<{ open: number | null; reached: number } | null>(null);
  const firstNotDone = steps.findIndex((step) => !step.done);
  const auto = firstNotDone === -1 ? steps.length - 1 : firstNotDone;
  const attention = steps.findIndex((step) => step.attention === true);
  const reached = Math.max(touched?.reached ?? 0, auto, attention);
  /* 서버가 칸을 짚은 그때 한 번만 그 단계를 펼친다 — 그 뒤에는 사용자가 다른 단계로 옮겨 갈 수 있다. */
  const [seenAttention, setSeenAttention] = useState(-1);
  if (attention !== seenAttention) {
    setSeenAttention(attention);
    if (attention !== -1) setTouched({ open: attention, reached });
  }
  const open = touched === null ? auto : touched.open;

  const confirm = (index: number): void =>
    setTouched({
      open: index + 1 < steps.length ? index + 1 : null,
      reached: Math.max(reached, Math.min(index + 1, steps.length - 1)),
    });
  const toggle = (index: number): void =>
    setTouched({ open: open === index ? null : index, reached });

  return (
    <ol className="iqc-inspection-stepper inspection-steps">
      {steps.map((step, index) => {
        if (!showAll && index > reached) return null;
        const isOpen = showAll || open === index;
        const state = step.done ? 'done' : 'current';
        const head = (
          <>
            <span className="iqc-inspection-step-no" aria-hidden>
              {index + 1}
            </span>
            <span className="iqc-inspection-stepper-text">
              <span className="iqc-inspection-stepper-title">{step.title}</span>
              {!isOpen && step.summary !== undefined && step.summary !== '' && (
                <span className="iqc-inspection-stepper-summary" title={step.summary}>
                  {step.summary}
                </span>
              )}
            </span>
            {/* 접힌 단계는 다 채웠든 아니든 눌러 다시 편다(사용자 지시 2026-10-29). */}
            {!isOpen && <span className="iqc-inspection-stepper-change">{t.stepChange}</span>}
          </>
        );
        return (
          <li
            key={step.title}
            data-step-state={state}
            /* 잠긴 회차는 모두 펼치되 강조 테두리는 두지 않는다 — 입력 중인 단계로 읽히지 않게. */
            data-open={isOpen && !showAll ? '' : undefined}
            aria-current={state === 'current' && isOpen ? 'step' : undefined}
          >
            {showAll ? (
              <div className="iqc-inspection-step-toggle">{head}</div>
            ) : (
              <button
                type="button"
                className="iqc-inspection-step-toggle"
                aria-expanded={isOpen}
                onClick={() => toggle(index)}
              >
                {head}
                <Icon name={isOpen ? 'expand_less' : 'expand_more'} size={20} aria-hidden />
              </button>
            )}
            {isOpen && (
              <section
                className="iqc-inspection-step-panel"
                aria-label={step.title}
                /*
                 * 칸을 건드리면 그 단계에 머문다 — 적는 동안 단계가 다 채워져도 저절로 다음 단계로 넘어가지 않고 [확정]을
                 * 기다린다(IQC 와 같다).
                 */
                onFocusCapture={() => {
                  if (!showAll && (touched === null || touched.open !== index)) {
                    setTouched({ open: index, reached });
                  }
                }}
              >
                {step.render(() => confirm(index))}
              </section>
            )}
          </li>
        );
      })}
    </ol>
  );
};
