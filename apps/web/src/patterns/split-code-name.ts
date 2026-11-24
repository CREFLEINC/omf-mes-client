/**
 * 「코드 · 이름」 한 줄 표기를 품목코드 · 품목명 두 칸으로 나눈다(사용자 지시 2026-11-24 — 품명에
 * 품목명과 품목코드가 합쳐져 있으면 모두 나눈다).
 *
 * 구분자 ` · ` 가 없으면 이름을 못 푼 것(불러오는 중 · 없음 · 실패 안내)이다 — 안내는 코드 칸에
 * 두고 이름 칸은 `missing`(그 화면의 빈 값 표시 「—」/「-」)으로 둔다.
 */
export const splitCodeName = (label: string, missing: string): { code: string; name: string } => {
  const at = label.indexOf(' · ');
  return at < 0
    ? { code: label, name: missing }
    : { code: label.slice(0, at), name: label.slice(at + 3) };
};
