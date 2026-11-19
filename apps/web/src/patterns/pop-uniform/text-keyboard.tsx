import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

/**
 * 화면 글자판(한글 2벌식 · 영문 · 숫자) — #295.
 *
 * POP 단말은 실물 자판이 없는 터치 화면이라, 검색 칸 아래에 숫자 키패드(`PuKeypad`)와 같은 모양의 글자판을 둔다.
 * 값은 부르는 쪽이 가진다(`value`·`onChange`) — 실물 자판으로 친 글자와 같은 값을 고친다.
 */
const t = messages.popUniform;

/* ── 한글 조합(초성·중성·종성) ── */

const SYLLABLE_BASE = 0xac00;
const SYLLABLE_LAST = 0xd7a3;
const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const JUNG = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
/** 0 번은 받침 없음. */
const JONG = ' ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ';

const DOUBLE_VOWEL: Readonly<Record<string, string>> = {
  ㅗㅏ: 'ㅘ',
  ㅗㅐ: 'ㅙ',
  ㅗㅣ: 'ㅚ',
  ㅜㅓ: 'ㅝ',
  ㅜㅔ: 'ㅞ',
  ㅜㅣ: 'ㅟ',
  ㅡㅣ: 'ㅢ',
};

const DOUBLE_FINAL: Readonly<Record<string, string>> = {
  ㄱㅅ: 'ㄳ',
  ㄴㅈ: 'ㄵ',
  ㄴㅎ: 'ㄶ',
  ㄹㄱ: 'ㄺ',
  ㄹㅁ: 'ㄻ',
  ㄹㅂ: 'ㄼ',
  ㄹㅅ: 'ㄽ',
  ㄹㅌ: 'ㄾ',
  ㄹㅍ: 'ㄿ',
  ㄹㅎ: 'ㅀ',
  ㅂㅅ: 'ㅄ',
};

/** 겹친 것을 두 조각으로(겹모음·겹받침). */
const splitDouble = (table: Readonly<Record<string, string>>, ch: string): string | null =>
  Object.keys(table).find((pair) => table[pair] === ch) ?? null;

interface Syllable {
  cho: number;
  jung: number;
  jong: number;
}

const toSyllable = (ch: string): Syllable | null => {
  const code = ch.charCodeAt(0);
  if (ch.length !== 1 || code < SYLLABLE_BASE || code > SYLLABLE_LAST) return null;
  const offset = code - SYLLABLE_BASE;
  return { cho: Math.floor(offset / 588), jung: Math.floor((offset % 588) / 28), jong: offset % 28 };
};

const fromSyllable = ({ cho, jung, jong }: Syllable): string =>
  String.fromCharCode(SYLLABLE_BASE + cho * 588 + jung * 28 + jong);

/** 받침 자리에 들어갈 수 있는 자음(ㄸ·ㅃ·ㅉ 빼고). */
const jongIndex = (ch: string): number => (ch === ' ' ? -1 : JONG.indexOf(ch));

/**
 * 한 글자를 넣는다. 한글 자모면 앞 글자와 조합하고(2벌식), 아니면 뒤에 붙인다.
 * 예: ㅅ ㅓ ㄹ ㅂ ㅣ → 설비, ㄷ ㅏ ㄹ ㄱ → 닭.
 */
export const typeHangul = (value: string, ch: string): string => {
  const head = value.slice(0, -1);
  const last = value.slice(-1);
  const prev = toSyllable(last);
  const isVowel = JUNG.includes(ch);
  const isConsonant = CHO.includes(ch);

  if (isConsonant) {
    if (prev === null) return value + ch;
    if (prev.jong === 0) {
      const jong = jongIndex(ch);
      return jong > 0 ? head + fromSyllable({ ...prev, jong }) : value + ch;
    }
    const merged = DOUBLE_FINAL[(JONG[prev.jong] ?? '') + ch];
    return merged === undefined
      ? value + ch
      : head + fromSyllable({ ...prev, jong: jongIndex(merged) });
  }

  if (!isVowel) return value + ch;

  if (prev !== null) {
    if (prev.jong === 0) {
      const merged = DOUBLE_VOWEL[(JUNG[prev.jung] ?? '') + ch];
      return merged === undefined
        ? value + ch
        : head + fromSyllable({ ...prev, jung: JUNG.indexOf(merged) });
    }
    /* 받침이 다음 글자의 첫소리로 넘어간다(겹받침이면 뒤 조각만). */
    const final = JONG[prev.jong] ?? '';
    const pair = splitDouble(DOUBLE_FINAL, final);
    const keep = pair === null ? 0 : jongIndex(pair.charAt(0));
    const moved = pair === null ? final : pair.charAt(1);
    return (
      head +
      fromSyllable({ ...prev, jong: keep }) +
      fromSyllable({ cho: CHO.indexOf(moved), jung: JUNG.indexOf(ch), jong: 0 })
    );
  }

  if (CHO.includes(last) && last !== '') {
    return head + fromSyllable({ cho: CHO.indexOf(last), jung: JUNG.indexOf(ch), jong: 0 });
  }
  const mergedVowel = DOUBLE_VOWEL[last + ch];
  return mergedVowel === undefined ? value + ch : head + mergedVowel;
};

/** 한 단계 지운다 — 마지막 글자를 받침 → 겹모음 뒤 조각 → 모음 순으로 풀고, 그 밖은 한 자를 지운다. */
export const eraseHangul = (value: string): string => {
  const head = value.slice(0, -1);
  const last = value.slice(-1);
  const prev = toSyllable(last);

  if (prev !== null) {
    if (prev.jong !== 0) {
      const pair = splitDouble(DOUBLE_FINAL, JONG[prev.jong] ?? '');
      return head + fromSyllable({ ...prev, jong: pair === null ? 0 : jongIndex(pair.charAt(0)) });
    }
    const vowelPair = splitDouble(DOUBLE_VOWEL, JUNG[prev.jung] ?? '');
    if (vowelPair !== null) {
      return head + fromSyllable({ ...prev, jung: JUNG.indexOf(vowelPair.charAt(0)) });
    }
    return head + (CHO[prev.cho] ?? '');
  }

  const vowelPair = splitDouble(DOUBLE_VOWEL, last);
  return vowelPair === null ? head : head + vowelPair.charAt(0);
};

/* ── 글자판 ── */

type Mode = 'ko' | 'en' | 'num';

const ROWS: Readonly<Record<Mode, readonly [string, string, string]>> = {
  ko: ['ㅂㅈㄷㄱㅅㅛㅕㅑㅐㅔ', 'ㅁㄴㅇㄹㅎㅗㅓㅏㅣ', 'ㅋㅌㅊㅍㅠㅜㅡ'],
  en: ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'],
  num: ['1234567890', '-_./', ''],
};

const KO_SHIFT: Readonly<Record<string, string>> = {
  ㅂ: 'ㅃ',
  ㅈ: 'ㅉ',
  ㄷ: 'ㄸ',
  ㄱ: 'ㄲ',
  ㅅ: 'ㅆ',
  ㅐ: 'ㅒ',
  ㅔ: 'ㅖ',
};

const shifted = (mode: Mode, ch: string): string => {
  if (mode === 'ko') return KO_SHIFT[ch] ?? ch;
  if (mode === 'en') return ch.toUpperCase();
  return ch;
};

/**
 * 글자판: 4줄(키 56, 낮은 화면 48). 맨 아래 줄은 [한/영] [123] [띄어쓰기] [전체 삭제].
 * ⇧ 은 한 글자만 쌍자음·겹모음(ㅃㅉㄸㄲㅆㅒㅖ)·대문자로 바꾸고 풀린다.
 *
 * ⭐ 키를 눌러도 초점이 검색 칸에 남는다(`mousedown` 기본 동작 막음) — 스캐너·실물 자판이 계속 그 칸에 친다.
 */
export const PuTextKeyboard = ({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) => {
  const [mode, setMode] = useState<Mode>('ko');
  const [letters, setLetters] = useState<'ko' | 'en'>('ko');
  const [shift, setShift] = useState(false);
  const [first = '', second = '', third = ''] = ROWS[mode];

  const keepFocus = (event: { preventDefault: () => void }): void => {
    event.preventDefault();
  };

  const type = (ch: string): void => {
    onChange(typeHangul(value, shift ? shifted(mode, ch) : ch));
    setShift(false);
  };

  const charKey = (ch: string, extra?: string) => {
    const shown = shift ? shifted(mode, ch) : ch;
    return (
      <button
        key={ch}
        type="button"
        className={extra}
        disabled={disabled}
        aria-label={shown}
        onMouseDown={keepFocus}
        onClick={() => {
          type(ch);
        }}
      >
        {shown}
      </button>
    );
  };

  const shiftKey = (
    <button
      type="button"
      className={shift ? 'fn w3 is-on' : 'fn w3'}
      disabled={disabled || mode === 'num'}
      aria-label={t.textKeyboard.shift}
      aria-pressed={shift}
      onMouseDown={keepFocus}
      onClick={() => {
        setShift((on) => !on);
      }}
    >
      ⇧
    </button>
  );

  const backKey = (
    <button
      type="button"
      className="fn w3"
      disabled={disabled}
      aria-label={t.keypad.backspace}
      onMouseDown={keepFocus}
      onClick={() => {
        onChange(eraseHangul(value));
      }}
    >
      ←
    </button>
  );

  return (
    <div className="pu-tkbd" role="group" aria-label={t.textKeyboard.region}>
      {Array.from(first).map((ch) => charKey(ch))}
      {Array.from(second).map((ch, index) => charKey(ch, index === 0 ? 'row2' : undefined))}
      {mode === 'num' ? (
        <>
          <span className="pu-tkbd-gap" />
          {backKey}
        </>
      ) : (
        <>
          {shiftKey}
          {Array.from(third).map((ch) => charKey(ch))}
          {backKey}
        </>
      )}
      <button
        type="button"
        className="fn w3"
        disabled={disabled}
        onMouseDown={keepFocus}
        onClick={() => {
          const next = mode === 'num' ? letters : letters === 'ko' ? 'en' : 'ko';
          setLetters(next);
          setMode(next);
          setShift(false);
        }}
      >
        {t.textKeyboard.lang}
      </button>
      <button
        type="button"
        className={mode === 'num' ? 'fn w3 is-on' : 'fn w3'}
        disabled={disabled}
        aria-pressed={mode === 'num'}
        onMouseDown={keepFocus}
        onClick={() => {
          setMode(mode === 'num' ? letters : 'num');
          setShift(false);
        }}
      >
        {t.textKeyboard.numbers}
      </button>
      <button
        type="button"
        className="fn w10"
        disabled={disabled}
        onMouseDown={keepFocus}
        onClick={() => {
          type(' ');
        }}
      >
        {t.textKeyboard.space}
      </button>
      <button
        type="button"
        className="fn w4"
        disabled={disabled || value === ''}
        onMouseDown={keepFocus}
        onClick={() => {
          onChange('');
        }}
      >
        {t.keypad.clearAll}
      </button>
    </div>
  );
};
