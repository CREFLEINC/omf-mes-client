import { useEffect, useState, type RefObject } from 'react';

/** 기간 달력에서 지금 무엇을 골라야 하는가. 닫혀 있으면 closed. */
export type RangeStep = 'closed' | 'start' | 'end';

const START_ONLY = /^\d{4}-\d{2}-\d{2} ~$/;

/**
 * DS 기간 선택기의 진행 단계를 읽는다(사용자 지시 2026-09-19).
 *
 * DS 는 시작일만 고른 상태를 밖으로 알리지 않는다 — 완결 쌍만 onChange 로 낸다. 대신 트리거가
 * 그 상태를 그대로 그린다(열림은 aria-expanded, 시작일만 고르면 값이 「YYYY-MM-DD ~」). 그 표시를
 * 읽어 단계를 안다. 공용 부품의 동작은 건드리지 않는다 — 다른 화면 26곳이 같은 부품을 쓴다.
 */
export const useRangeStep = (triggerRef: RefObject<HTMLButtonElement | null>): RangeStep => {
  const [step, setStep] = useState<RangeStep>('closed');

  useEffect(() => {
    const trigger = triggerRef.current;
    if (trigger === null) return undefined;

    const read = (): void => {
      if (trigger.getAttribute('aria-expanded') !== 'true') {
        setStep('closed');
        return;
      }
      // 값은 트리거의 첫 칸이다 — 뒤 칸은 달력 아이콘(글리프 글자)이라 함께 읽으면 형식이 깨진다.
      const value = trigger.firstElementChild?.textContent?.trim() ?? '';
      setStep(START_ONLY.test(value) ? 'end' : 'start');
    };
    const observer = new MutationObserver(read);
    observer.observe(trigger, {
      attributes: true,
      attributeFilter: ['aria-expanded'],
      childList: true,
      characterData: true,
      subtree: true,
    });
    read();
    return () => observer.disconnect();
  }, [triggerRef]);

  return step;
};
