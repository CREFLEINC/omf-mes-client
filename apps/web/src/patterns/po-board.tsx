import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';

/**
 * 발주 목록 · 발주 상세 두 표 배치(W-01-09 입하 예정)가 함께 쓰는 조각.
 * 모양은 app.css `.po-board-*` 가 정한다.
 */

/** 납기·발주일 표기 — `YYYY.MM.DD`(사용자 지시 2026-10-21). 주소·요청은 `YYYY-MM-DD` 그대로다. */
export const formatDotDate = (date: string): string => date.replaceAll('-', '.');

/**
 * 두 표가 창 바닥에서 멈추게 한다(사용자 지시 2026-10-21) — 표 구획의 **창 안 윗변**을 `--split-top` 으로
 * 실어, CSS 가 남은 높이만큼만 쓰고 넘치는 줄은 표 안에서 스크롤한다. 조건 줄이 펼쳐지거나 창 크기가
 * 바뀌면 윗변이 움직이므로 다시 잰다.
 */
export const useFitToViewport = () => {
  const splitRef = useRef<HTMLDivElement>(null);
  const aboveRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const split = splitRef.current;
    if (split === null) return;

    const measure = (): void => {
      split.style.setProperty('--split-top', `${String(split.getBoundingClientRect().top)}px`);
    };
    measure();

    /* 시험 환경(jsdom)에는 `ResizeObserver` 가 없다 — 없으면 창 크기 변화만 따른다. */
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    if (aboveRef.current !== null) observer?.observe(aboveRef.current);
    window.addEventListener('resize', measure);

    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  return { splitRef, aboveRef };
};

/**
 * 칸 안 한 줄 — 넘치면 말줄임. **잘렸을 때만** 마우스를 올리는 즉시 전체 값을 띄운다(사용자 지시 2026-10-21).
 * 브라우저 `title` 은 뜨기까지 늦어 쓰지 않는다. 이름 열이 쓴다(공급사명·품목명·창고 등).
 */
export const OneLine = ({ text }: { text: string }) => {
  const [tip, setTip] = useState<{ left?: number; right?: number; top: number } | null>(null);

  return (
    <span
      className="po-board-one-line"
      aria-label={text}
      onMouseEnter={(event) => {
        const el = event.currentTarget;
        if (el.scrollWidth <= el.clientWidth) return;
        const rect = el.getBoundingClientRect();
        /* 창 오른쪽 절반의 칸은 오른쪽 끝에 맞춰 띄운다 — 창 밖으로 넘치지 않게. */
        setTip(
          rect.left > window.innerWidth / 2
            ? { right: window.innerWidth - rect.right, top: rect.bottom + 4 }
            : { left: rect.left, top: rect.bottom + 4 },
        );
      }}
      onMouseLeave={() => {
        setTip(null);
      }}
    >
      {text}
      {tip !== null && (
        <span className="po-board-tip" role="tooltip" style={tip}>
          {text}
        </span>
      )}
    </span>
  );
};

/** 왼쪽 표가 차지하는 비율의 한계 — 어느 쪽도 읽을 수 없을 만큼 좁아지지 않게. */
const SPLIT_MIN = 0.2;
const SPLIT_MAX = 0.75;
const SPLIT_STEP = 0.02;

const clampRatio = (value: number): number => Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, value));

/**
 * 두 표 사이를 끌어 폭을 나눈다(사용자 지시 2026-10-21). 비율은 화면마다 브라우저에 남긴다 —
 * 다시 들어와도 고른 폭이 유지된다. 저장소가 막혀 있으면 기본 비율로 동작한다.
 */
export const usePaneSplit = (storageKey: string, initial = 1 / 3) => {
  const [ratio, setRatio] = useState<number>(() => {
    try {
      const saved = Number(window.localStorage.getItem(storageKey));

      return saved > 0 ? clampRatio(saved) : initial;
    } catch {
      return initial;
    }
  });

  const commit = (next: number): void => {
    const value = clampRatio(next);
    setRatio(value);
    try {
      window.localStorage.setItem(storageKey, String(value));
    } catch {
      /* 저장하지 못해도 이번 화면에서는 그대로 쓴다. */
    }
  };

  /** 나란히 설 때의 열 비율 — `.po-board-split` 이 읽는다. */
  const style = {
    '--split-left': `${String(ratio)}fr`,
    '--split-right': `${String(1 - ratio)}fr`,
  } as CSSProperties;

  return { ratio, commit, style };
};

/**
 * 끌기 막대 — 두 구획 사이의 세로 막대. 마우스·터치로 끌고, 초점을 두고 ←·→ 로도 옮긴다.
 * 창이 좁아 위아래로 쌓일 때는 CSS 가 감춘다.
 */
export const PaneSplitter = ({
  label,
  ratio,
  onChange,
}: {
  label: string;
  ratio: number;
  onChange: (ratio: number) => void;
}) => (
  <div
    className="po-board-splitter"
    role="separator"
    aria-orientation="vertical"
    aria-label={label}
    /* 마우스를 올리면 무엇을 하는 막대인지 글로도 읽힌다. */
    title={label}
    aria-valuemin={Math.round(SPLIT_MIN * 100)}
    aria-valuemax={Math.round(SPLIT_MAX * 100)}
    aria-valuenow={Math.round(ratio * 100)}
    tabIndex={0}
    onPointerDown={(event) => {
      const container = event.currentTarget.parentElement;
      if (container === null) return;
      event.preventDefault();
      const rect = container.getBoundingClientRect();
      const move = (moveEvent: PointerEvent): void => {
        onChange((moveEvent.clientX - rect.left) / rect.width);
      };
      const up = (): void => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        document.body.classList.remove('po-board-resizing');
      };
      document.body.classList.add('po-board-resizing');
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    }}
    onKeyDown={(event) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        onChange(ratio - SPLIT_STEP);
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        onChange(ratio + SPLIT_STEP);
      }
    }}
  />
);

/** 두 구획을 나란히(`side`) 둘지 위아래(`stack`)로 둘지. */
export type PaneLayout = 'side' | 'stack';

/**
 * 목록 · 상세 배치 바꾸기(사용자 지시 2026-10-26 · omf-all-around#186). 고른 배치는 화면마다 브라우저에 남긴다 —
 * 다시 들어와도 같은 배치다. 저장소가 막혀 있으면 나란히 둔다. 창이 1440px 보다 좁으면 CSS 가 늘 위아래로 쌓으므로
 * 이 값은 넓은 창에서만 뜻이 있다(`.po-board-split.is-stacked`).
 */
export const usePaneLayout = (storageKey: string) => {
  const [layout, setLayout] = useState<PaneLayout>(() => {
    try {
      return window.localStorage.getItem(storageKey) === 'stack' ? 'stack' : 'side';
    } catch {
      return 'side';
    }
  });

  const change = (next: PaneLayout): void => {
    setLayout(next);
    try {
      window.localStorage.setItem(storageKey, next);
    } catch {
      /* 저장하지 못해도 이번 화면에서는 그대로 쓴다. */
    }
  };

  /** 두 구획을 감싼 상자(`.po-board-split`)에 덧붙일 이름. */
  const className = layout === 'stack' ? 'po-board-split is-stacked' : 'po-board-split';

  return { layout, change, className };
};

/**
 * 배치 고르기 — 「좌우 배치 | 상하 배치」 두 단추 중 지금 배치가 채워져 보인다(사용자 지시 2026-10-26). 목록 위
 * 오른쪽에 선다. 창이 좁아 늘 위아래로 쌓일 때는 CSS 가 감춘다 — 눌러도 바뀌는 것이 없다.
 */
export const PaneLayoutToggle = ({
  layout,
  onChange,
  labels,
}: {
  layout: PaneLayout;
  onChange: (next: PaneLayout) => void;
  labels: { group: string; side: string; stack: string };
}) => (
  <div className="po-board-layout-toggle" role="group" aria-label={labels.group}>
    {(['side', 'stack'] as const).map((value) => (
      <button
        key={value}
        type="button"
        className="po-board-layout-option"
        aria-pressed={layout === value}
        onClick={() => {
          if (layout !== value) onChange(value);
        }}
      >
        {labels[value]}
      </button>
    ))}
  </div>
);
