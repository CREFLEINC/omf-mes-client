import { AlertBanner } from '@crefle/web-ui';
import { createContext, useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import './screen-notice.css';

/** 셸이 앱바 바로 아래에 둔 알림 자리. 셸 밖(시험 등)에서는 없다. */
const ScreenNoticeSlotContext = createContext<HTMLElement | null>(null);

export const ScreenNoticeSlotProvider = ScreenNoticeSlotContext.Provider;

export interface ScreenNoticeProps {
  title: string;
  /** 사번 없음처럼 할 일을 막는 것은 warning, 저장 실패처럼 일이 틀어진 것은 error. */
  variant?: 'warning' | 'error' | 'info';
  children?: ReactNode;
}

/**
 * 화면의 알림 한 줄 — 「사번을 먼저 확인하세요」 같은 것.
 *
 * 앱바(검은 계기판) 바로 아래 한 자리에 띄운다(사용자 지시 2026-10-21). 전에는 화면마다 본문 끝 ·
 * 확정 바의 잠긴 이유 · 구획 안에 같은 말이 두세 번 서서, 무엇을 해야 하는지가 도리어 흐렸다. 이
 * 알림을 쓰는 화면은 같은 말을 다른 자리에 다시 적지 않는다.
 *
 * 셸 밖에서 그리면(시험) 제자리에 선다 - 말이 사라지지 않는다.
 */
export const ScreenNotice = ({ title, variant = 'warning', children }: ScreenNoticeProps) => {
  const slot = useContext(ScreenNoticeSlotContext);
  const notice = (
    <AlertBanner className="screen-notice" variant={variant} title={title}>
      {children}
    </AlertBanner>
  );

  return slot === null ? notice : createPortal(notice, slot);
};
