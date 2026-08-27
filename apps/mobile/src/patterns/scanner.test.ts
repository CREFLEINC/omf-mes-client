import { afterEach, describe, expect, it, vi } from 'vitest';

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

afterEach(() => {
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
