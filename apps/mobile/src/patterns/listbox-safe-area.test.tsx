import { Select } from '@crefle/web-ui';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { keepListboxesInSafeArea, placeListbox } from './listbox-safe-area';

describe('placeListbox', () => {
  const room = { gap: 4, safeTop: 24, safeBottom: 720, listHeight: 288 };

  it('아래에 다 들어가면 아래로 열고 높이를 두지 않는다', () => {
    expect(placeListbox({ ...room, triggerTop: 100, triggerBottom: 148 })).toEqual({
      top: 152,
      maxHeight: null,
    });
  });

  it('아래가 바에 가리면 위로 연다', () => {
    // 창 높이(768) 기준이면 아래에 들어가지만, 바를 뺀 720 까지는 모자란다.
    expect(placeListbox({ ...room, triggerTop: 400, triggerBottom: 448 })).toEqual({
      top: 108,
      maxHeight: null,
    });
  });

  it('둘 다 모자라면 넓은 쪽으로 열고 그 공간만큼 줄인다', () => {
    expect(placeListbox({ ...room, listHeight: 600, triggerTop: 400, triggerBottom: 448 })).toEqual(
      { top: 24, maxHeight: 372 },
    );
    expect(placeListbox({ ...room, listHeight: 600, triggerTop: 200, triggerBottom: 248 })).toEqual(
      { top: 252, maxHeight: 468 },
    );
  });
});

describe('keepListboxesInSafeArea', () => {
  let release: () => void;
  let triggerTop = 400;

  beforeEach(() => {
    release = keepListboxesInSafeArea();
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      if (this.classList.contains('mobile-shell')) {
        return DOMRect.fromRect({ x: 0, y: 0, width: 360, height: 768 });
      }

      if (this.getAttribute('role') === 'combobox') {
        return DOMRect.fromRect({ x: 0, y: triggerTop, width: 200, height: 48 });
      }

      if (this.getAttribute('role') === 'listbox') {
        const top = Number.parseFloat(this.style.top) || 0;
        return DOMRect.fromRect({ x: 0, y: top, width: 200, height: 288 });
      }

      return DOMRect.fromRect();
    });
  });

  afterEach(() => {
    triggerTop = 400;
    release();
    vi.restoreAllMocks();
  });

  const options = Array.from({ length: 20 }, (_, index) => ({
    value: `v${index}`,
    label: `항목 ${index}`,
  }));

  it('창 높이로는 아래에 열릴 목록을 내비게이션 바 위로 올린다', async () => {
    render(
      <div className="mobile-shell" style={{ paddingBottom: '48px' }}>
        <Select aria-label="위치" options={options} />
      </div>,
    );

    fireEvent.click(screen.getByRole('combobox', { name: '위치' }));
    const listbox = await screen.findByRole('listbox');
    await Promise.resolve();

    // DS 는 448(트리거 바로 아래)에 두었다. 바 위 720 까지 288 이 안 들어가 위로 옮긴다.
    expect(listbox.style.top).toBe('112px');
    expect(listbox.style.maxHeight).toBe('');
  });

  it('위아래 모두 모자라면 넓은 쪽 공간에 테두리까지 맞춰 줄인다', async () => {
    triggerTop = 200;

    render(
      <div className="mobile-shell" style={{ paddingTop: '120px', paddingBottom: '300px' }}>
        <Select aria-label="위치" options={options} />
      </div>,
    );

    fireEvent.click(screen.getByRole('combobox', { name: '위치' }));
    const listbox = await screen.findByRole('listbox');
    await Promise.resolve();

    // 아래 468-248=220, 위 200-120=80. 아래로 열고 여백까지 220 안에 넣는다.
    expect(listbox.style.top).toBe('248px');
    expect(listbox.style.maxHeight).toBe('220px');
    expect(listbox.style.boxSizing).toBe('border-box');
  });
});
