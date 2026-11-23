import { act, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useFitCount, useFitTableRows } from './pager';

/**
 * 쪽 줄 수 재기(`useFitCount` · `useFitTableRows`)의 진동 · 다시 재기(피처 014 P-01-01 총괄 확인 2026-11-24).
 *
 * jsdom 은 배치를 하지 않으므로 칸 높이 · 줄 높이를 가짜로 준다. 줄 높이가 «그려진 줄 수»에 따라 바뀌면(두 줄 셀 ·
 * 칩이 있는 줄이 보이느냐에 따라) 줄 수 → 보이는 줄 → 가장 높은 줄 → 줄 수가 번갈아 바뀌어 끝없이 돈다
 * (「Maximum update depth exceeded」).
 */

let boxHeight = 300;
let boxWidth = 500;
/** 그려진 줄 수 → 줄마다 높이. */
let rowHeightFor: (rendered: number) => number = () => 40;

const observers: { callback: ResizeObserverCallback; targets: Set<Element> }[] = [];

class FakeResizeObserver {
  private readonly entry: { callback: ResizeObserverCallback; targets: Set<Element> };

  constructor(callback: ResizeObserverCallback) {
    this.entry = { callback, targets: new Set() };
    observers.push(this.entry);
  }

  observe(target: Element): void {
    this.entry.targets.add(target);
  }

  unobserve(target: Element): void {
    this.entry.targets.delete(target);
  }

  disconnect(): void {
    this.entry.targets.clear();
  }
}

/** 이 요소를 지금 지켜보는 관찰자에게 크기 바뀜을 알린다. */
const resize = (target: Element): void => {
  for (const each of observers) {
    if (each.targets.has(target)) each.callback([], each as unknown as ResizeObserver);
  }
};

const isBox = (element: HTMLElement): boolean => element.dataset.box === 'true';

const renderedRows = (element: HTMLElement): number => {
  const box = element.closest('[data-box="true"]');
  if (box === null) return 0;

  return box.querySelectorAll('tbody > tr, :scope > li').length;
};

beforeEach(() => {
  boxHeight = 300;
  boxWidth = 500;
  rowHeightFor = () => 40;
  observers.length = 0;
  vi.stubGlobal('ResizeObserver', FakeResizeObserver);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    return isBox(this) ? boxHeight : 0;
  });
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    return isBox(this) ? boxWidth : 0;
  });
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    if (this.tagName === 'THEAD') return 36;
    if (this.tagName === 'TR' || this.tagName === 'LI') return rowHeightFor(renderedRows(this));

    return 0;
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const TableProbe = ({ show = true }: { show?: boolean }) => {
  const ref = useRef<HTMLDivElement>(null);
  const size = useFitTableRows(ref, { fallback: 5 });

  return (
    <>
      <output aria-label="size">{size}</output>
      {show ? (
        <div ref={ref} data-box="true">
          <table>
            <thead>
              <tr>
                <th>칸</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: size }, (_, index) => (
                <tr key={index}>
                  <td>{index}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>빈 표</p>
      )}
    </>
  );
};

const ListProbe = () => {
  const ref = useRef<HTMLUListElement>(null);
  const size = useFitCount(ref, { fallback: 5 });

  return (
    <>
      <output aria-label="size">{size}</output>
      <ul ref={ref} data-box="true">
        {Array.from({ length: size }, (_, index) => (
          <li key={index}>{index}</li>
        ))}
      </ul>
    </>
  );
};

const sizeNow = (): number => Number(screen.getByLabelText('size').textContent);

/* 다섯 줄 이상 그려지면 줄이 높아진다(두 줄 셀이 든 줄이 보임) — 5 → 3 → 6 → 3 … 로 돌던 모양. */
const oscillating = (rendered: number): number => (rendered >= 5 ? 70 : 40);

describe('FR-010 세 칸 쪽 줄 수 — 줄 높이가 줄 수에 따라 바뀌어도 돌지 않는다', () => {
  it('useFitTableRows 줄 수가 줄었다 늘었다 하면 작은 쪽에 멈춘다(Maximum update depth 없음)', () => {
    rowHeightFor = oscillating;

    render(<TableProbe />);

    expect(sizeNow()).toBe(3);
  });

  it('useFitCount 도 같다', () => {
    rowHeightFor = oscillating;

    render(<ListProbe />);

    /* 5 → 4(줄 높이 70) → 7(40) → 4 에서 멈춘다. */
    expect(sizeNow()).toBe(4);
  });

  it('칸 크기가 바뀌면 다시 재고 늘어날 수 있다(1100 → 1920)', () => {
    rowHeightFor = oscillating;
    render(<TableProbe />);
    expect(sizeNow()).toBe(3);

    rowHeightFor = () => 40;
    boxHeight = 600;
    boxWidth = 900;
    act(() => {
      resize(screen.getByText('칸').closest('[data-box="true"]') as Element);
    });

    expect(sizeNow()).toBe(14);
  });

  it('처음 줄어드는 것은 천장을 만들지 않는다 — 줄이 다시 낮아지면 지금처럼 늘어난다', () => {
    const { rerender } = render(<TableProbe />);
    expect(sizeNow()).toBe(6);

    /* 데이터가 바뀌어 모든 줄이 높아짐 → 줄어든다. */
    rowHeightFor = () => 70;
    rerender(<TableProbe />);
    expect(sizeNow()).toBe(3);

    /* 다시 낮아지면 늘어난다(같은 칸 크기). */
    rowHeightFor = () => 40;
    rerender(<TableProbe />);
    expect(sizeNow()).toBe(6);
  });

  it('줄 높이가 고르면 지금처럼 칸 높이에 드는 만큼', () => {
    render(<TableProbe />);
    expect(sizeNow()).toBe(6);

    render(<ListProbe />);
    expect(screen.getAllByLabelText('size')[1]).toHaveTextContent('7');
  });

  it('표 칸이 빈 상태로 갈렸다 다시 서면 새 칸을 지켜본다 — 그 뒤 크기 바뀜에도 다시 잰다', () => {
    const { rerender } = render(<TableProbe />);
    expect(sizeNow()).toBe(6);

    rerender(<TableProbe show={false} />);
    rerender(<TableProbe />);

    boxHeight = 600;
    act(() => {
      resize(screen.getByText('칸').closest('[data-box="true"]') as Element);
    });

    expect(sizeNow()).toBe(14);
  });
});
