import { App } from '@capacitor/app';
import { useEffect, useRef } from 'react';

/*
 * 화면 안에서 단계를 밟아 들어간 자리들. 뒤로가기는 가장 안쪽 것부터 되돌린다.
 *
 * 라우터 이력에는 화면 하나뿐이라, 이것이 없으면 대상을 고르고 스캔하던 사람이 뒤로가기
 * 한 번에 작업 목록까지 나가 처음부터 다시 들어와야 한다.
 */
const steps: (() => void)[] = [];

export const registerBackStep = (step: () => void): (() => void) => {
  steps.push(step);

  return () => {
    const at = steps.indexOf(step);

    if (at >= 0) {
      steps.splice(at, 1);
    }
  };
};

/** 되돌릴 단계가 있으면 하나 되돌리고 참을 낸다. */
export const runBackStep = (): boolean => {
  const step = steps[steps.length - 1];

  if (step === undefined) {
    return false;
  }

  step();
  return true;
};

/**
 * 이 단계가 열려 있는 동안 뒤로가기를 받는다.
 *
 * 안쪽 단계가 먼저 등록되도록 조건을 서로 배타로 둔다 - 둘이 함께 열려 있으면 어느 쪽이
 * 먼저 닫히는지가 등록 순서에 걸린다.
 */
export const useBackStep = (active: boolean, onBack: () => void): void => {
  const handler = useRef(onBack);
  handler.current = onBack;

  useEffect(() => {
    if (!active) {
      return;
    }

    return registerBackStep(() => {
      handler.current();
    });
  }, [active]);
};

/**
 * 단말의 뒤로가기를 화면 단계에 먼저 준다.
 *
 * 되돌릴 단계가 없을 때만 이력으로 넘긴다. 이력도 없으면 앱을 닫는 것이 안드로이드 관례다.
 */
export const listenBackButton = (): (() => void) => {
  const handle = App.addListener('backButton', ({ canGoBack }) => {
    if (runBackStep()) {
      return;
    }

    if (canGoBack) {
      window.history.back();
      return;
    }

    void App.exitApp();
  });

  return () => {
    void handle.then((listener) => {
      listener.remove();
    });
  };
};
