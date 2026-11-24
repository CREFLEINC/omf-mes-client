import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { eraseHangul, PuTextKeyboard, typeHangul } from './text-keyboard';

const typeAll = (keys: string, start = ''): string =>
  Array.from(keys).reduce((value, key) => typeHangul(value, key), start);

const eraseSteps = (value: string): string[] => {
  const steps: string[] = [];
  let current = value;
  while (current !== '') {
    current = eraseHangul(current);
    steps.push(current);
  }
  return steps;
};

describe('typeHangul — 2벌식 조합', () => {
  it.each([
    ['ㅅㅓㄹㅂㅣ', '설비'],
    ['ㄱㅡㅁㅎㅕㅇ', '금형'],
    ['ㄷㅏㄹㄱ', '닭'],
    ['ㄷㅏㄹㄱㅏ', '달가'],
    ['ㄱㅗㅏㄴㄹㅣ', '관리'],
    ['ㅇㅢㅅㅏ', '의사'],
    ['ㄱㅏㅂㅅ', '값'],
    ['ㄲㅗㅊ', '꽃'],
    ['ㅃㅏㄸ', '빠ㄸ'],
    ['ㄱㅅ', 'ㄱㅅ'],
    ['ㅗㅏ', 'ㅘ'],
  ])('%s → %s', (keys, expected) => {
    expect(typeAll(keys)).toBe(expected);
  });

  it('한글이 아닌 글자는 그대로 붙인다', () => {
    expect(typeAll('A-1 ㅅㅓㄹ')).toBe('A-1 설');
    expect(typeAll('ㅏ', 'MC')).toBe('MCㅏ');
  });
});

describe('eraseHangul — 한 단계씩 풀어 지운다', () => {
  it('닭 → 달 → 다 → ㄷ → 빈칸', () => {
    expect(eraseSteps('닭')).toEqual(['달', '다', 'ㄷ', '']);
  });

  it('겹모음은 앞 조각으로 돌아간다: 관 → 과 → 고 → ㄱ', () => {
    expect(eraseSteps('관')).toEqual(['과', '고', 'ㄱ', '']);
  });

  it('설비 → 설ㅂ → 설 → 서 → ㅅ', () => {
    expect(eraseSteps('설비')).toEqual(['설ㅂ', '설', '서', 'ㅅ', '']);
  });

  it('한글이 아니면 한 자를 지운다', () => {
    expect(eraseHangul('AB')).toBe('A');
  });
});

describe('PuTextKeyboard', () => {
  const Harness = () => {
    const [value, setValue] = useState('');
    return (
      <>
        <output>{value}</output>
        <PuTextKeyboard value={value} onChange={setValue} />
      </>
    );
  };

  const press = (name: string): void => {
    fireEvent.click(screen.getByRole('button', { name }));
  };

  it('영문 판으로 열리고 맨 위 숫자 줄은 늘 있다. ⇧ 은 한 글자만, 한/영 · 기호로 판을 바꾼다', () => {
    render(<Harness />);
    press('m');
    press('쌍자음·대문자');
    press('C');
    press('1');

    press('한/영');
    press('쌍자음·대문자');
    press('ㄲ');
    press('ㅗ');
    press('ㅊ');
    press('기호');
    press('-');
    press('2');
    press('띄어쓰기');
    expect(screen.getByRole('status')).toHaveTextContent(/^mC1꽃-2$/u);

    press('기호');
    expect(screen.getByRole('button', { name: 'ㅂ' })).toBeInTheDocument();
    press('전체 삭제');
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('⭐ ⇧ 을 연달아 두 번 누르면 대문자가 고정되고, 한 번 더 누르면 풀린다', () => {
    render(<Harness />);
    press('쌍자음·대문자');
    press('쌍자음·대문자');
    expect(screen.getByRole('button', { name: '대문자 고정' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    press('A');
    press('B');
    press('1');
    press('C');
    expect(screen.getByRole('status')).toHaveTextContent(/^AB1C$/u);

    press('대문자 고정');
    press('d');
    expect(screen.getByRole('status')).toHaveTextContent(/^AB1Cd$/u);
    expect(screen.getByRole('button', { name: '쌍자음·대문자' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('고정한 채 판(한/영)을 바꾸면 풀린다', () => {
    render(<Harness />);
    press('쌍자음·대문자');
    press('쌍자음·대문자');
    press('한/영');
    press('ㅂ');
    expect(screen.getByRole('status')).toHaveTextContent(/^ㅂ$/u);
  });

  it('불량 등록 칸은 initialMode="ko" 로 한글 판을 연다', () => {
    render(<PuTextKeyboard value="" onChange={() => undefined} initialMode="ko" />);
    expect(screen.getByRole('button', { name: 'ㅂ' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'q' })).not.toBeInTheDocument();
  });
});
