import { messages } from '@omf-mes/i18n';
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';

import { useBackStep } from './back-step';
import './step-flow.css';

const t = messages.taskFlow;

export interface StepFlow<S extends string> {
  step: S;
  /** 1 부터 센다. 사람에게 보이는 번호다. */
  index: number;
  total: number;
  /** 이 단계로 간다. 지나온 단계는 뒤로가기로 되짚을 수 있게 쌓아 둔다. */
  go: (next: S) => void;
  /** 지나온 단계로 하나 돌아간다. 첫 단계면 아무것도 하지 않는다. */
  back: () => void;
  /** 지나온 단계를 지우고 처음으로 간다. 한 건을 마치고 다음 건을 받을 때 쓴다. */
  reset: () => void;
}

/**
 * 한 화면에 지시 하나씩, 단계를 밟아 가는 흐름.
 *
 * 단말의 뒤로가기는 화면을 나가기 전에 지나온 단계부터 되짚는다 - 라우터 이력에는 화면 하나뿐이라,
 * 이것이 없으면 수량 단계에서 뒤로가기 한 번에 작업 목록까지 나가 적던 것을 처음부터 다시 한다.
 *
 * 순서대로만 가지 않는다. 고를 것이 하나뿐이면 그 단계를 건너뛰는데, 그때 뒤로가기는 건너뛴
 * 단계가 아니라 실제로 지나온 단계로 돌아가야 한다. 그래서 번호가 아니라 지나온 길을 쌓는다.
 */
export const useStepFlow = <S extends string>(steps: readonly S[], first: S): StepFlow<S> => {
  const [trail, setTrail] = useState<S[]>([first]);
  const step = trail[trail.length - 1] ?? first;

  const go = useCallback((next: S) => {
    setTrail((current) => (current[current.length - 1] === next ? current : [...current, next]));
  }, []);

  const back = useCallback(() => {
    setTrail((current) => (current.length > 1 ? current.slice(0, -1) : current));
  }, []);

  const reset = useCallback(() => {
    setTrail([first]);
  }, [first]);

  useBackStep(trail.length > 1, back);

  return { step, index: steps.indexOf(step) + 1, total: steps.length, go, back, reset };
};

export interface StepSectionProps {
  /** 동사로 끝나는 지시 하나. 「자재 LOT 라벨을 스캔하세요」 */
  title: string;
  index: number;
  total: number;
  children?: ReactNode;
}

/**
 * 단계 하나의 구획. 지시를 제목으로 세우고 몇 번째 단계인지 함께 보인다.
 *
 * 단계가 바뀌면 그 구획의 머리를 화면에 들인다 - 앞 단계 끝까지 내려가 있던 화면이 새 지시의
 * 아래쪽에서 열리면 무엇을 하라는지 보이지 않는다.
 */
export const StepSection = ({ title, index, total, children }: StepSectionProps) => {
  const ref = useRef<HTMLElement | null>(null);
  const headingId = useId();

  useEffect(() => {
    const node = ref.current;

    /* 이 기능이 없는 환경에서 던지면 화면이 통째로 멈춘다. 맞추기는 있으면 좋은 것이다. */
    if (node === null || typeof node.scrollIntoView !== 'function') {
      return;
    }

    node.scrollIntoView({ block: 'nearest' });
  }, []);

  return (
    <section ref={ref} className="step-section" aria-labelledby={headingId}>
      <p className="step-section__count">{t.step(index, total)}</p>
      <h2 id={headingId}>{title}</h2>
      {children}
    </section>
  );
};
