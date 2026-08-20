/** 저장을 서버로 보내기 전에 멈춘 경우. 사용자가 다시 시도하면 풀린다. */
export const save = {
  staleToken: '최신 정보를 불러오는 중입니다. 잠시 뒤 다시 저장하세요.',
} as const;
