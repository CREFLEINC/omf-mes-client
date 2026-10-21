import { useLayoutEffect, useRef, useState } from 'react';

/**
 * 발주 목록 · 발주 상세 두 표 배치(W-01-09 입하 예정 · W-01-03 초과 입하 분리)가 함께 쓰는 조각.
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
