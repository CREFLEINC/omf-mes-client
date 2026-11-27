import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** 커서를 두고 힌트가 뜨기까지(ms) — 표를 훑으며 지나갈 때마다 깜빡이지 않게. */
const OPEN_DELAY_MS = 300;
/** 힌트와 칸 · 화면 끝 사이 간격(px). */
const EDGE_PX = 6;

/** 말줄임이 걸린 글 요소 — 상자 안에서 이것을 잰다. 없으면 상자 자신을 잰다. */
const CUT_TEXT_SELECTOR = '[data-cut-text]';

const isCut = (box: HTMLElement): boolean => {
  const target = box.querySelector<HTMLElement>(CUT_TEXT_SELECTOR) ?? box;
  return target.scrollWidth > target.clientWidth;
};

/**
 * 힌트는 표 안에 그리지 않고 `body` 에 고정 위치로 그린다 — 표 상자 · 가로 구름 상자의 넘침 가림(overflow)이 자른다.
 * 칸 아래 왼쪽 끝에 맞춰 열고, 아래가 모자라면 위로 연다. 가로는 화면 안으로 끌어 넣는다. 커서를 막지 않는다.
 */
const HintBubble = ({ anchor, text }: { anchor: HTMLElement; text: string }) => {
  const bubbleRef = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const bubble = bubbleRef.current;
    if (bubble === null) return;
    const rect = anchor.getBoundingClientRect();
    const { offsetWidth: width, offsetHeight: height } = bubble;
    const fitsBelow = rect.bottom + EDGE_PX + height <= window.innerHeight;
    const top = fitsBelow ? rect.bottom + EDGE_PX : Math.max(EDGE_PX, rect.top - EDGE_PX - height);
    const left = Math.min(Math.max(EDGE_PX, rect.left), window.innerWidth - width - EDGE_PX);
    bubble.style.top = `${String(top)}px`;
    bubble.style.left = `${String(left)}px`;
  }, [anchor]);

  return createPortal(
    <span ref={bubbleRef} role="tooltip" className="cut-hint-bubble">
      {text}
    </span>,
    document.body,
  );
};

export interface CutHintProps {
  /** 잘렸을 때 힌트로 보일 전체 글 */
  text: string;
  className?: string;
  /** 칸 내용 — 말줄임이 걸린 글 요소에 `data-cut-text` 를 단다. */
  children: ReactNode;
}

/**
 * 잘린 글 힌트(사용자 지시 2026-11-27) — 표 칸의 글이 말줄임으로 잘렸을 때만, 커서를 두면 전체 글을 띄운다.
 * 브라우저 기본 힌트(`title`)는 창에 초점이 없거나 커서가 멈춘 자리에 따라 뜨지 않아 「힌트가 안 뜬다」고 했다.
 * 다 보이는 글에는 띄우지 않는다. 칸 폭은 창 · 열 끌기로 바뀌므로 커서를 올린 그때 잰다.
 * 글은 칸 안에 그대로 있어 화면 낭독기는 전체를 읽는다 — 힌트는 눈으로 보는 사람의 것이다.
 */
export const CutHint = ({ text, className, children }: CutHintProps) => {
  const boxRef = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const clearTimer = (): void => {
    if (timer.current === null) return;
    clearTimeout(timer.current);
    timer.current = null;
  };
  const close = (): void => {
    clearTimer();
    setIsOpen(false);
  };

  /* 칸이 사라질 때 기다리던 힌트를 거둔다. */
  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );
  /* 열린 채 표 · 화면을 굴리면 힌트가 칸을 떠나 엉뚱한 자리에 남는다 — 닫는다. */
  useEffect(() => {
    if (!isOpen) return;
    const onScroll = (): void => setIsOpen(false);
    window.addEventListener('scroll', onScroll, true);
    return () => window.removeEventListener('scroll', onScroll, true);
  }, [isOpen]);

  return (
    <span
      ref={boxRef}
      className={className}
      onMouseEnter={(event) => {
        clearTimer();
        if (!isCut(event.currentTarget)) return;
        timer.current = setTimeout(() => setIsOpen(true), OPEN_DELAY_MS);
      }}
      onMouseLeave={close}
    >
      {children}
      {isOpen && boxRef.current !== null && <HintBubble anchor={boxRef.current} text={text} />}
    </span>
  );
};
