import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * 탭 막대 오른쪽의 **일 단추 자리** — 셸(`app/hub-tabs.tsx`)이 이 번호로 빈 상자를 세우고, 화면이 그 안에 단추를 넣는다.
 *
 * 탭 막대 줄은 탭 몇 개 뒤로 비어 있다. 조회 조건과 상관없는 그 묶음의 다른 일(예: 입하 예정의 「초과분 잇기」)을
 * 조건 줄에 두면 조건 줄이 넘쳐 한 줄이 더 생긴다 — 이 자리는 높이를 먹지 않는다(사용자 지시 2026-10-21 「자주 쓰지
 * 않는 일은 눈에 띄지 않게」).
 */
export const HUB_ACTIONS_ID = 'hub-actions';

/** 탭 막대의 일 단추 자리. 셸이 그리지 않았으면(탭 묶음 밖 · 화면만 그린 시험) `null`. */
export const useHubActionsTarget = (): HTMLElement | null => {
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setTarget(document.getElementById(HUB_ACTIONS_ID));
  }, []);

  return target;
};

/** 그 자리에 넣는다. 자리가 없으면 아무것도 그리지 않는다 — 부르는 쪽이 자리가 없을 때의 길을 정한다. */
export const HubActions = ({ target, children }: { target: HTMLElement; children: ReactNode }) =>
  createPortal(children, target);
