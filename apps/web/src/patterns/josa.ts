/**
 * C-5 조사 붙이기. 앞 말의 마지막 글자 받침에 맞춰 을/를, 이/가, 은/는, 으로/로를 고른다.
 * 숫자와 영문은 읽는 소리로 판단한다. 대문자 약어는 글자 이름(BOM 비오엠, URL 유알엘), 소문자로 끝나는 낱말은
 * 끝소리(Routing 라우팅, Lot 랏)로 본다. 판단이 어려운 끝소리는 받침 없음으로 둔다.
 */
type Pair = '을/를' | '이/가' | '은/는' | '으로/로';

const DIGIT_HAS_FINAL: Record<string, boolean> = {
  '0': true, // 영
  '1': true, // 일
  '2': false,
  '3': true,
  '4': false,
  '5': false,
  '6': true,
  '7': true,
  '8': true,
  '9': false,
};

/** 낱말 뒤에 붙어 읽지 않는 닫는 부호. 판단은 그 앞 글자로 한다(「BOM」을, (라인)을). */
const TRAILING_MARKS = /[」』)\]"'”’》〉]+$/u;

/** 마지막 글자의 받침 종류. 없음 0, ㄹ 받침 8(으로/로 판단용), 그 밖의 받침은 그 번호. */
const finalConsonant = (word: string): number => {
  const last = word.trim().replace(TRAILING_MARKS, '').trimEnd().slice(-1);
  if (last === '') return 0;
  const code = last.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28;
  if (last in DIGIT_HAS_FINAL)
    return DIGIT_HAS_FINAL[last] ? (last === '1' || last === '7' || last === '8' ? 8 : 1) : 0;
  /* 대문자: 글자 이름이 받침으로 끝나는 것(엘, 엠, 엔, 알) */
  if (/[LR]/.test(last)) return 8;
  if (/[MN]/.test(last)) return 1;
  /* 소문자: 끝소리 */
  if (last === 'l') return 8;
  if (/[mngktp]/.test(last)) return 1;
  return 0;
};

export const josa = (word: string, pair: Pair): string => {
  const final = finalConsonant(word);
  const [withFinal, withoutFinal] = pair.split('/') as [string, string];
  if (pair === '으로/로') return `${word}${final === 0 || final === 8 ? withoutFinal : withFinal}`;
  return `${word}${final === 0 ? withoutFinal : withFinal}`;
};
