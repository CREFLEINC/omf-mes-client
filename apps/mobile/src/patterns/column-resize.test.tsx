import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MIN_COLUMN_WIDTH, moveColumnBorder, useColumnResize } from './column-resize';

const store = vi.hoisted(() => new Map<string, string>());

vi.mock('./local-store', () => ({
  readLocal: (key: string) => Promise.resolve(store.get(key) ?? null),
  writeLocal: (key: string, value: string) => {
    store.set(key, value);
    return Promise.resolve();
  },
}));

/** jsdom 은 배치를 하지 않는다. 칸마다 그려진 폭을 정해 준다. */
const DRAWN = [120, 100, 60, 60];

const Table = () => {
  const columns = useColumnResize('syn-columns', 1);

  return (
    <table>
      <thead>
        <tr>
          {['번호', '이름', '날짜', '수량'].map((name, index) => (
            <th
              key={name}
              ref={(cell) => {
                if (cell !== null) {
                  cell.getBoundingClientRect = () => ({ width: DRAWN[index] ?? 0 }) as DOMRect;
                }
              }}
              data-testid={name}
              /* 여백 없는 칸 - 건 폭이 그려진 폭과 같다. */
              style={{ padding: 0, ...columns.styleOf(index) }}
            >
              {name}
              {index < 3 ? columns.handle(index, `${name} 칸 폭`) : null}
            </th>
          ))}
        </tr>
      </thead>
    </table>
  );
};

describe('칸 경계 옮기기', () => {
  it('왼쪽이 넓어진 만큼 오른쪽이 좁아진다', () => {
    expect(moveColumnBorder(120, 100, 30)).toEqual([150, 70]);
    expect(moveColumnBorder(120, 100, -30)).toEqual([90, 130]);
  });

  /* 칸이 0 이 되면 머리도 값도 사라져 다시 잡을 곳이 없다. */
  it('어느 쪽도 최소 폭 밑으로 내려가지 않는다', () => {
    expect(moveColumnBorder(120, 100, 500)).toEqual([220 - MIN_COLUMN_WIDTH, MIN_COLUMN_WIDTH]);
    expect(moveColumnBorder(120, 100, -500)).toEqual([MIN_COLUMN_WIDTH, 220 - MIN_COLUMN_WIDTH]);
  });
});

describe('칸 폭 조절', () => {
  beforeEach(() => {
    store.clear();
  });

  it('남는 폭을 가지는 칸에는 폭을 걸지 않는다', async () => {
    render(<Table />);

    /* 번호|이름 경계 - 이름이 남는 폭을 가지므로 번호에만 폭이 걸린다. */
    fireEvent.keyDown(screen.getByRole('separator', { name: '번호 칸 폭' }), { key: 'ArrowLeft' });

    await waitFor(() => {
      expect(screen.getByTestId('번호').style.width).toBe('112px');
    });
    expect(screen.getByTestId('이름').style.width).toBe('');
  });

  it('남는 칸이 아닌 두 칸 사이에서는 양쪽 폭을 함께 옮긴다', async () => {
    render(<Table />);

    fireEvent.keyDown(screen.getByRole('separator', { name: '날짜 칸 폭' }), { key: 'ArrowRight' });

    await waitFor(() => {
      expect(screen.getByTestId('날짜').style.width).toBe('68px');
    });
    expect(screen.getByTestId('수량').style.width).toBe('52px');
  });

  /* 현장 단말은 한 번 맞춘 폭을 계속 쓴다 - 화면을 다시 열 때마다 맞추게 하지 않는다. */
  it('정한 폭을 기기에 남겨 다음에 열어도 같다', async () => {
    const { unmount } = render(<Table />);
    fireEvent.keyDown(screen.getByRole('separator', { name: '번호 칸 폭' }), { key: 'ArrowRight' });
    await waitFor(() => {
      expect(store.get('syn-columns')).toBe(JSON.stringify({ 0: 128 }));
    });
    unmount();

    render(<Table />);

    await waitFor(() => {
      expect(screen.getByTestId('번호').style.width).toBe('128px');
    });
  });

  it('남긴 값이 깨졌으면 CSS 폭 그대로 둔다', async () => {
    store.set('syn-columns', '{깨짐');

    render(<Table />);
    await Promise.resolve();

    expect(screen.getByTestId('번호').style.width).toBe('');
  });

  it('화살표가 아닌 키는 폭을 바꾸지 않는다', () => {
    render(<Table />);

    fireEvent.keyDown(screen.getByRole('separator', { name: '번호 칸 폭' }), { key: 'Enter' });

    expect(screen.getByTestId('번호').style.width).toBe('');
    expect(store.has('syn-columns')).toBe(false);
  });
});
