import { createContext, useContext } from 'react';
import { useNavigate } from 'react-router';

/**
 * 다른 화면으로 옮기는 길(#197) — 저장하지 않은 입력이 있으면 먼저 묻는 화면이 이 값을 준다. 깊은 부품(기준 조회 창의 [수정] 등)이
 * 화면의 확인 절차를 거쳐 옮기게 한다. 주지 않으면 그냥 옮긴다.
 */
const LeaveGuardContext = createContext<((href: string) => void) | null>(null);

export const LeaveGuardProvider = LeaveGuardContext.Provider;

export const useLeaveFor = (): ((href: string) => void) => {
  const guarded = useContext(LeaveGuardContext);
  const navigate = useNavigate();
  return guarded ?? ((href) => void navigate(href));
};
