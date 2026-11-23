import { App } from '@capacitor/app';
import { useEffect, useRef, useSyncExternalStore } from 'react';

/*
 * 화면 안에서 단계를 밟아 들어간 자리들. 뒤로가기는 가장 안쪽 것부터 되돌린다.
 *
 * 라우터 이력에는 화면 하나뿐이라, 이것이 없으면 대상을 고르고 스캔하던 사람이 뒤로가기
 * 한 번에 작업 목록까지 나가 처음부터 다시 들어와야 한다.
 */
const steps: (() => void)[] = [];

/* 앱바의 「이전 단계」 단추가 되돌릴 단계가 생기고 사라지는 것을 듣는다. */
const listeners = new Set<() => void>();

const notify = () => {
  for (const listener of listeners) {
    listener();
  }
};

export const registerBackStep = (step: () => void): (() => void) => {
  steps.push(step);
  notify();

  return () => {
    const at = steps.indexOf(step);

    if (at >= 0) {
      steps.splice(at, 1);
      notify();
    }
  };
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
};

const hasBackStep = () => steps.length > 0;

/** 화면 안에 되돌릴 단계가 있는가. 앱바가 「이전 단계」 단추를 세울지 정한다. */
export const useHasBackStep = (): boolean => useSyncExternalStore(subscribe, hasBackStep);

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

/*
 * 뒤로가기가 앱을 닫는 자리 - 사번 확인과 작업 목록. 작업 목록에서 이력으로 넘기면 사번 확인으로
 * 돌아가 교대하려던 것처럼 보인다. 교대는 앱바의 사번 칩이 한다.
 */
const EXIT_PATHS = new Set(['/', '/screens']);

/**
 * 단말의 뒤로가기를 화면 단계에 먼저 준다.
 *
 * 되돌릴 단계가 없으면 이력으로 넘기고, 첫 화면에서는 앱을 닫는다 - 안드로이드 관례다. 닫기 전에
 * 한 번 묻는다(사용자 지시 2026-11-23) - 무엇을 할지는 `onExit` 이 정한다.
 * 단말이 주는 canGoBack 은 쓰지 않는다. 화면 전환이 pushState 라 그 값이 거짓으로 와,
 * 작업 목록으로 돌아갈 자리에서 앱이 통째로 닫혔다.
 */
export const listenBackButton = (onExit: () => void): (() => void) => {
  const handle = App.addListener('backButton', () => {
    if (runBackStep()) {
      return;
    }

    if (EXIT_PATHS.has(window.location.pathname)) {
      onExit();
      return;
    }

    window.history.back();
  });

  return () => {
    void handle.then((listener) => {
      listener.remove();
    });
  };
};

/** 앱을 닫는다. 종료 확인 창에서 「종료」를 누르면 온다. */
export const exitApp = (): void => {
  void App.exitApp();
};
