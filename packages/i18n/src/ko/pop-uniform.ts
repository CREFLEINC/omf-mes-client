/**
 * POP 본문 통일 부품 문구(omf-all-around#295) — 화면 여럿이 함께 쓴다.
 * 시안 공통 규칙(스캔 칸 · 키패드 · 쪽 넘김 · 창 · 접기)의 말 그대로다.
 */
export const popUniform = {
  scan: {
    ready: '스캔 대기',
    done: '스캔 완료',
    manual: '직접 입력',
    /** 찾기 창의 [검색] 단추(#295 · 사용자 지시 2026-11-19 — 찾기 창은 [확인] 대신 [검색]). */
    search: '검색',
    /** 찾기 창 칸 안의 흐린 안내 — 「자재 관리 LOT 번호 · 품목코드로 검색」. 받침이 있으면(ㄹ 빼고) 「으로」. */
    searchPlaceholder: (label: string): string => {
      const code = label.charCodeAt(label.length - 1) - 0xac00;
      const final = code >= 0 && code <= 11171 ? code % 28 : 0;
      return `${label}${final === 0 || final === 8 ? '로' : '으로'} 검색`;
    },
  },
  keypad: {
    noTarget: '입력할 칸을 누르세요',
    clearAll: '전체 삭제',
    backspace: '한 자 지움',
    region: '숫자 키패드',
  },
  textKeyboard: {
    region: '글자판',
    shift: '쌍자음·대문자',
    lang: '한/영',
    symbols: '기호',
    space: '띄어쓰기',
  },
  /** 왼쪽 목록 위 찾기 칸(`PuSearchBox`). */
  search: {
    clear: '찾는 글자 지우기',
  },
  pager: {
    total: (total: number): string => `총 ${String(total)}건`,
    position: (page: number, pages: number): string =>
      `${String(page)} / ${String(Math.max(pages, 1))}`,
    prev: '이전 쪽',
    next: '다음 쪽',
  },
  dialog: {
    cancel: '취소',
    close: '닫기',
    confirm: '확인',
  },
  pick: {
    search: (title: string): string => `${title} 검색`,
    empty: '찾는 항목이 없습니다',
  },
  fold: {
    fold: (name: string): string => `${name} 접기`,
    open: (name: string): string => `${name} 펼치기`,
  },
  /** 목록 정렬(사용자 지시 2026-11-19 — 모든 표·목록에 [최신순 | 오래된순]). */
  order: {
    label: '정렬',
    newest: '최신순',
    oldest: '오래된순',
  },
  help: '도움말',
  remove: '빼기',
};
