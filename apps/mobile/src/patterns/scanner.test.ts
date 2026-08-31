import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createKeyboardWedgeScanner } from './scanner';

const pressKey = (field: HTMLInputElement, key: string): KeyboardEvent => {
  const event = new KeyboardEvent('keydown', { key, cancelable: true, bubbles: true });
  field.dispatchEvent(event);
  return event;
};

const mountField = (): HTMLInputElement => {
  const field = document.createElement('input');
  document.body.append(field);
  return field;
};

/* 스캐너가 밀어 넣는 속도를 시계로 정확히 재현한다. 실제 대기 없이 간격만 흉내 낸다. */
const typeInto = (
  field: HTMLInputElement,
  value: string,
  gapMs: number,
  options: KeyboardEventInit = {},
) => {
  for (const ch of value) {
    vi.advanceTimersByTime(gapMs);
    field.value += ch;
    field.dispatchEvent(new KeyboardEvent('keydown', { key: ch, bubbles: true, ...options }));
    field.dispatchEvent(new InputEvent('input', { bubbles: true }));
  }
};

const pasteInto = (field: HTMLInputElement, value: string, inputType = 'insertFromPaste') => {
  field.value += value;
  field.dispatchEvent(new InputEvent('input', { bubbles: true, inputType }));
};

const deleteChars = (field: HTMLInputElement, count: number, gapMs: number) => {
  for (let i = 0; i < count; i += 1) {
    vi.advanceTimersByTime(gapMs);
    field.value = field.value.slice(0, -1);
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
    field.dispatchEvent(
      new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }),
    );
  }
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

describe('키보드 입력 스캐너', () => {
  it('종료 문자가 오면 그때까지의 값을 스캔값으로 넘긴다', () => {
    const scanner = createKeyboardWedgeScanner();
    const field = mountField();
    const onScan = vi.fn();
    scanner.attach(field, onScan);

    field.value = 'SYN-LOT-0001';
    pressKey(field, 'Enter');

    expect(onScan).toHaveBeenCalledWith('SYN-LOT-0001');
  });

  it('넘긴 뒤 입력 칸을 비운다', () => {
    const scanner = createKeyboardWedgeScanner();
    const field = mountField();
    scanner.attach(field, vi.fn());

    field.value = 'SYN-LOT-0002';
    pressKey(field, 'Enter');

    expect(field.value).toBe('');
  });

  it('종료 문자가 폼 제출로 이어지지 않게 막는다', () => {
    const scanner = createKeyboardWedgeScanner();
    const field = mountField();
    scanner.attach(field, vi.fn());

    field.value = 'SYN-LOT-0003';
    const event = pressKey(field, 'Enter');

    expect(event.defaultPrevented).toBe(true);
  });

  it('종료 문자 전에는 넘기지 않는다', () => {
    const scanner = createKeyboardWedgeScanner();
    const field = mountField();
    const onScan = vi.fn();
    scanner.attach(field, onScan);

    field.value = 'SYN-LOT-0004';
    pressKey(field, 'S');
    pressKey(field, 'Tab');

    expect(onScan).not.toHaveBeenCalled();
    expect(field.value).toBe('SYN-LOT-0004');
  });

  it('빈 값이나 공백만 있으면 넘기지 않는다', () => {
    const scanner = createKeyboardWedgeScanner();
    const field = mountField();
    const onScan = vi.fn();
    scanner.attach(field, onScan);

    field.value = '   ';
    pressKey(field, 'Enter');

    expect(onScan).not.toHaveBeenCalled();
  });

  it('앞뒤 공백을 떼고 넘긴다', () => {
    const scanner = createKeyboardWedgeScanner();
    const field = mountField();
    const onScan = vi.fn();
    scanner.attach(field, onScan);

    field.value = '  SYN-LOT-0005  ';
    pressKey(field, 'Enter');

    expect(onScan).toHaveBeenCalledWith('SYN-LOT-0005');
  });

  it('연결을 끊으면 더 넘기지 않는다', () => {
    const scanner = createKeyboardWedgeScanner();
    const field = mountField();
    const onScan = vi.fn();
    const detach = scanner.attach(field, onScan);

    detach();
    field.value = 'SYN-LOT-0006';
    pressKey(field, 'Enter');

    expect(onScan).not.toHaveBeenCalled();
  });

  it('여러 번 연속으로 스캔할 수 있다', () => {
    const scanner = createKeyboardWedgeScanner();
    const field = mountField();
    const onScan = vi.fn();
    scanner.attach(field, onScan);

    field.value = 'SYN-LOT-0007';
    pressKey(field, 'Enter');
    field.value = 'SYN-LOT-0008';
    pressKey(field, 'Enter');

    expect(onScan).toHaveBeenNthCalledWith(1, 'SYN-LOT-0007');
    expect(onScan).toHaveBeenNthCalledWith(2, 'SYN-LOT-0008');
  });

  it('상태는 준비됨이고 구독 해제가 예외를 내지 않는다', () => {
    const scanner = createKeyboardWedgeScanner();

    expect(scanner.getStatus()).toBe('ready');
    expect(() => scanner.onStatusChange(vi.fn())()).not.toThrow();
  });
});

describe('종료 문자가 없는 스캐너', () => {
  it('빠르게 이어진 입력이 멎으면 넘긴다', () => {
    const scanner = createKeyboardWedgeScanner();
    const field = mountField();
    const onScan = vi.fn();
    scanner.attach(field, onScan);

    typeInto(field, 'SYN-LOT-0100', 5);
    vi.advanceTimersByTime(120);

    expect(onScan).toHaveBeenCalledWith('SYN-LOT-0100');
    expect(field.value).toBe('');
  });

  it('사람이 천천히 친 값은 넘기지 않는다', () => {
    const scanner = createKeyboardWedgeScanner();
    const field = mountField();
    const onScan = vi.fn();
    scanner.attach(field, onScan);

    typeInto(field, 'SYN-LOT', 200);
    vi.advanceTimersByTime(500);

    expect(onScan).not.toHaveBeenCalled();
    expect(field.value).toBe('SYN-LOT');
  });

  it('천천히 친 값도 종료 문자를 주면 넘어간다', () => {
    const scanner = createKeyboardWedgeScanner();
    const field = mountField();
    const onScan = vi.fn();
    scanner.attach(field, onScan);

    typeInto(field, 'SYN-LOT-0101', 200);
    pressKey(field, 'Enter');

    expect(onScan).toHaveBeenCalledWith('SYN-LOT-0101');
  });

  it('입력이 아직 이어지는 동안에는 넘기지 않는다', () => {
    const scanner = createKeyboardWedgeScanner();
    const field = mountField();
    const onScan = vi.fn();
    scanner.attach(field, onScan);

    typeInto(field, 'SYN-LOT', 5);
    vi.advanceTimersByTime(50);

    expect(onScan).not.toHaveBeenCalled();
  });

  it('통째로 들어온 값도 멎으면 넘긴다', () => {
    const scanner = createKeyboardWedgeScanner();
    const field = mountField();
    const onScan = vi.fn();
    scanner.attach(field, onScan);

    pasteInto(field, 'SYN-LOT-0102');
    vi.advanceTimersByTime(120);

    expect(onScan).toHaveBeenCalledWith('SYN-LOT-0102');
  });

  it('키를 누르고 있는 것은 스캔으로 보지 않는다', () => {
    const scanner = createKeyboardWedgeScanner();
    const field = mountField();
    const onScan = vi.fn();
    scanner.attach(field, onScan);

    typeInto(field, 'AAAAAA', 5, { repeat: true });
    vi.advanceTimersByTime(200);

    expect(onScan).not.toHaveBeenCalled();
  });

  it('종료 문자로 넘긴 뒤 대기 시간이 다시 넘기지 않는다', () => {
    const scanner = createKeyboardWedgeScanner();
    const field = mountField();
    const onScan = vi.fn();
    scanner.attach(field, onScan);

    typeInto(field, 'SYN-LOT-0103', 5);
    pressKey(field, 'Enter');
    vi.advanceTimersByTime(500);

    expect(onScan).toHaveBeenCalledTimes(1);
  });

  it('통째로 들어오는 스캔을 연달아 받는다', () => {
    const scanner = createKeyboardWedgeScanner();
    const field = mountField();
    const onScan = vi.fn();
    scanner.attach(field, onScan);

    pasteInto(field, 'SYN-LOT-0107');
    vi.advanceTimersByTime(120);
    pasteInto(field, 'SYN-LOT-0108');
    vi.advanceTimersByTime(120);

    expect(onScan).toHaveBeenNthCalledWith(1, 'SYN-LOT-0107');
    expect(onScan).toHaveBeenNthCalledWith(2, 'SYN-LOT-0108');
  });

  /* 앞 스캔의 판정이 남아 있으면 그다음 손으로 친 한 글자가 스캔으로 나간다. */
  it('스캔 뒤 손으로 친 값은 넘기지 않는다', () => {
    const scanner = createKeyboardWedgeScanner();
    const field = mountField();
    const onScan = vi.fn();
    scanner.attach(field, onScan);

    pasteInto(field, 'SYN-LOT-0109');
    vi.advanceTimersByTime(120);
    typeInto(field, 'X', 300);
    vi.advanceTimersByTime(500);

    expect(onScan).toHaveBeenCalledTimes(1);
    expect(field.value).toBe('X');
  });

  it('연결을 끊으면 대기 중이던 것도 넘기지 않는다', () => {
    const scanner = createKeyboardWedgeScanner();
    const field = mountField();
    const onScan = vi.fn();
    const detach = scanner.attach(field, onScan);

    typeInto(field, 'SYN-LOT-0104', 5);
    detach();
    vi.advanceTimersByTime(500);

    expect(onScan).not.toHaveBeenCalled();
  });

  it('연속 스캔 둘을 각각 넘긴다', () => {
    const scanner = createKeyboardWedgeScanner();
    const field = mountField();
    const onScan = vi.fn();
    scanner.attach(field, onScan);

    typeInto(field, 'SYN-LOT-0105', 5);
    vi.advanceTimersByTime(120);
    typeInto(field, 'SYN-LOT-0106', 5);
    vi.advanceTimersByTime(120);

    expect(onScan).toHaveBeenNthCalledWith(1, 'SYN-LOT-0105');
    expect(onScan).toHaveBeenNthCalledWith(2, 'SYN-LOT-0106');
  });
});

describe('버스트 판정의 경계', () => {
  it('마지막 한 글자가 늦게 와도 놓치지 않는다', () => {
    const scanner = createKeyboardWedgeScanner();
    const field = mountField();
    const onScan = vi.fn();
    scanner.attach(field, onScan);

    typeInto(field, 'SYN-LOT-01', 5);
    typeInto(field, '2', 70);
    vi.advanceTimersByTime(120);

    expect(onScan).toHaveBeenCalledWith('SYN-LOT-012');
    expect(field.value).toBe('');
  });

  it('천천히 시작한 뒤 빨라진 입력은 넘기지 않는다', () => {
    const scanner = createKeyboardWedgeScanner();
    const field = mountField();
    const onScan = vi.fn();
    scanner.attach(field, onScan);

    typeInto(field, 'AB', 200);
    typeInto(field, 'CDE', 50);
    vi.advanceTimersByTime(200);

    expect(onScan).not.toHaveBeenCalled();
    expect(field.value).toBe('ABCDE');
  });

  it('지우는 중에는 넘기지 않고 입력을 남긴다', () => {
    const scanner = createKeyboardWedgeScanner();
    const field = mountField();
    const onScan = vi.fn();
    scanner.attach(field, onScan);

    typeInto(field, 'SYN-LOTX', 250);
    deleteChars(field, 3, 50);
    vi.advanceTimersByTime(300);

    expect(onScan).not.toHaveBeenCalled();
    expect(field.value).toBe('SYN-L');
  });

  it('통째로 넣은 뒤 지우면 넘기지 않는다', () => {
    const scanner = createKeyboardWedgeScanner();
    const field = mountField();
    const onScan = vi.fn();
    scanner.attach(field, onScan);

    pasteInto(field, 'SYN-LOT-0200');
    deleteChars(field, 1, 20);
    vi.advanceTimersByTime(300);

    expect(onScan).not.toHaveBeenCalled();
    expect(field.value).toBe('SYN-LOT-020');
  });

  it('자동완성으로 들어온 값은 스캔으로 보지 않는다', () => {
    const scanner = createKeyboardWedgeScanner();
    const field = mountField();
    const onScan = vi.fn();
    scanner.attach(field, onScan);

    pasteInto(field, 'SYN-LOT', 'insertReplacementText');
    vi.advanceTimersByTime(300);

    expect(onScan).not.toHaveBeenCalled();
  });

  it('평균 간격이 기준 안이면 넘긴다', () => {
    const scanner = createKeyboardWedgeScanner();
    const field = mountField();
    const onScan = vi.fn();
    scanner.attach(field, onScan);

    typeInto(field, 'ABCD', 60);
    vi.advanceTimersByTime(120);

    expect(onScan).toHaveBeenCalledWith('ABCD');
  });

  it('평균 간격이 기준을 넘으면 넘기지 않는다', () => {
    const scanner = createKeyboardWedgeScanner();
    const field = mountField();
    const onScan = vi.fn();
    scanner.attach(field, onScan);

    typeInto(field, 'ABCD', 61);
    vi.advanceTimersByTime(120);

    expect(onScan).not.toHaveBeenCalled();
  });

  it('두 글자로는 속도를 판정하지 않는다', () => {
    const scanner = createKeyboardWedgeScanner();
    const field = mountField();
    const onScan = vi.fn();
    scanner.attach(field, onScan);

    typeInto(field, 'AB', 5);
    vi.advanceTimersByTime(200);

    expect(onScan).not.toHaveBeenCalled();
  });

  it('문자 간격이 느린 단말은 기준을 넓혀 받는다', () => {
    const scanner = createKeyboardWedgeScanner({ burstAvgGapMs: 100 });
    const field = mountField();
    const onScan = vi.fn();
    scanner.attach(field, onScan);

    typeInto(field, 'SYN-LOT-0201', 80);
    vi.advanceTimersByTime(220);

    expect(onScan).toHaveBeenCalledWith('SYN-LOT-0201');
  });

  it('대기 시간도 바꿔 받을 수 있다', () => {
    const scanner = createKeyboardWedgeScanner({ quietMs: 400 });
    const field = mountField();
    const onScan = vi.fn();
    scanner.attach(field, onScan);

    typeInto(field, 'SYN-LOT-0202', 5);
    vi.advanceTimersByTime(200);
    expect(onScan).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300);
    expect(onScan).toHaveBeenCalledWith('SYN-LOT-0202');
  });
});

describe('세션 경계', () => {
  it('손으로 친 한 글자 뒤 한참 있다 스캔하면 그 스캔만 본다', () => {
    const scanner = createKeyboardWedgeScanner();
    const field = mountField();
    const onScan = vi.fn();
    scanner.attach(field, onScan);

    typeInto(field, 'A', 300);
    vi.advanceTimersByTime(3000);
    typeInto(field, 'SYN-LOT-0300', 10);
    vi.advanceTimersByTime(120);

    expect(onScan).toHaveBeenCalledWith('ASYN-LOT-0300');
  });

  it('키를 눌렀던 흔적이 다음 스캔을 막지 않는다', () => {
    const scanner = createKeyboardWedgeScanner();
    const field = mountField();
    const onScan = vi.fn();
    scanner.attach(field, onScan);

    typeInto(field, 'AA', 40, { repeat: true });
    vi.advanceTimersByTime(3000);
    typeInto(field, 'SYN-LOT-0301', 10);
    vi.advanceTimersByTime(120);

    expect(onScan).toHaveBeenCalledWith('AASYN-LOT-0301');
  });

  it('키에서 손을 떼면 곧바로 다음 스캔을 받는다', () => {
    const scanner = createKeyboardWedgeScanner();
    const field = mountField();
    const onScan = vi.fn();
    scanner.attach(field, onScan);

    typeInto(field, 'AA', 40, { repeat: true });
    vi.advanceTimersByTime(500);
    typeInto(field, 'SYN-LOT-0303', 10);
    vi.advanceTimersByTime(200);

    expect(onScan).toHaveBeenCalledWith('AASYN-LOT-0303');
  });

  it('잠깐 쉬었다 이어 친 것은 한 세션으로 본다', () => {
    const scanner = createKeyboardWedgeScanner();
    const field = mountField();
    const onScan = vi.fn();
    scanner.attach(field, onScan);

    typeInto(field, 'AB', 200);
    vi.advanceTimersByTime(400);
    typeInto(field, 'CDE', 50);
    vi.advanceTimersByTime(200);

    expect(onScan).not.toHaveBeenCalled();
    expect(field.value).toBe('ABCDE');
  });

  it('세션이 끊기는 시간을 바꿔 받을 수 있다', () => {
    const scanner = createKeyboardWedgeScanner({ sessionBreakMs: 200 });
    const field = mountField();
    const onScan = vi.fn();
    scanner.attach(field, onScan);

    typeInto(field, 'A', 300);
    vi.advanceTimersByTime(300);
    typeInto(field, 'BCD', 10);
    vi.advanceTimersByTime(120);

    expect(onScan).toHaveBeenCalledWith('ABCD');
  });

  it('유형을 알 수 없는 통째 입력은 넘기지 않는다', () => {
    const scanner = createKeyboardWedgeScanner();
    const field = mountField();
    const onScan = vi.fn();
    scanner.attach(field, onScan);

    pasteInto(field, 'SYN-LOT-0302', 'insertText');
    vi.advanceTimersByTime(300);

    expect(onScan).not.toHaveBeenCalled();
  });

  /* 지운 뒤 곧바로 스캔이 들어오면 앞선 대기가 살아 있어 조기에 제출된다. */
  it('지운 직후의 스캔을 조기에 넘기지 않는다', () => {
    const scanner = createKeyboardWedgeScanner();
    const field = mountField();
    const onScan = vi.fn();
    scanner.attach(field, onScan);

    typeInto(field, 'ABCD', 250);
    deleteChars(field, 1, 20);
    typeInto(field, '1234', 10);
    vi.advanceTimersByTime(60);

    expect(onScan).not.toHaveBeenCalled();

    vi.advanceTimersByTime(80);
    expect(onScan).toHaveBeenCalledWith('ABC1234');
  });

  it('34자리에서 앞 두 글자가 늦어도 스캔으로 본다', () => {
    const scanner = createKeyboardWedgeScanner();
    const field = mountField();
    const onScan = vi.fn();
    scanner.attach(field, onScan);

    typeInto(field, '77', 90);
    typeInto(field, '70001118880002229901015554447777', 8);
    vi.advanceTimersByTime(120);

    expect(onScan).toHaveBeenCalledWith('7770001118880002229901015554447777');
  });
});

describe('임계값 조합', () => {
  /* 조용해짐 판정이 문자 사이보다 짧으면 버스트 한가운데서 터져 한 건이 쪼개진다. */
  it('평균 기준을 크게 올려도 한 건으로 넘긴다', () => {
    const scanner = createKeyboardWedgeScanner({ burstAvgGapMs: 150 });
    const field = mountField();
    const onScan = vi.fn();
    scanner.attach(field, onScan);

    typeInto(field, 'SYN-LOT-0400', 120);
    vi.advanceTimersByTime(400);

    expect(onScan).toHaveBeenCalledTimes(1);
    expect(onScan).toHaveBeenCalledWith('SYN-LOT-0400');
  });

  it('대기 시간을 짧게 줘도 평균 기준보다는 길게 쓴다', () => {
    const scanner = createKeyboardWedgeScanner({ burstAvgGapMs: 150, quietMs: 20 });
    const field = mountField();
    const onScan = vi.fn();
    scanner.attach(field, onScan);

    typeInto(field, 'SYN-LOT-0401', 120);
    vi.advanceTimersByTime(400);

    expect(onScan).toHaveBeenCalledTimes(1);
  });
});
