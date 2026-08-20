/** 다시 불러와도 풀리지 않는 상태 — 재시도를 권하지 않는다. */
export const stateLocked = {
  title: '지금은 저장할 수 없는 상태입니다',
  description: '이 항목의 현재 상태에서는 변경이 허용되지 않습니다. 상태를 먼저 확인하세요.',
} as const;
