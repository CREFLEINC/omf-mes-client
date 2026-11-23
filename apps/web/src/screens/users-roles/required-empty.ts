/*
 * 필수인데 비어 있는 칸 — 빨간 테두리(사용자 지시 2026-11-20 · #333). DS 입력칸에 「비었음」 상태가 없어 칸 껍데기에
 * 클래스를 걸고 안의 상자에 오류색 테두리를 덧그린다(공정 라우팅 화면과 같은 방식). 공백만 넣은 것도 빈 칸이다.
 */
export const requiredEmptyClass = (value: string): string | undefined =>
  value.trim() === '' ? 'users-roles-required-empty' : undefined;
