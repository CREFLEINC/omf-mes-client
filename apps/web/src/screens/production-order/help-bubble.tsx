import { IconButton } from '@crefle/web-ui';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface HelpBubbleProps {
  /** 단추의 접근 가능한 이름 */
  label: string;
  /** 말풍선에 보일 설명. 한 줄에 한 문장씩 그린다. */
  content: readonly string[];
}

/**
 * 표 머리줄에 붙는 도움말 — 단추 «위»에 말풍선을 띄운다.
 *
 * ⛔ **디자인 시스템 `Tooltip` 을 쓰지 않는다.** 이 표는 가로 스크롤 상자(`wide-table`) 안에 있어
 *    그 안에서 그린 말풍선이 상자 경계에서 잘린다(브라우저 확인 2026-09-20). 그래서 말풍선만
 *    화면 좌표(`position: fixed`)로 띄워 상자를 벗어나게 한다.
 *
 * 마우스를 올리거나 초점이 오면 열리고, 누르면 고정되어 열린 채로 남는다. Esc 로 닫는다.
 */
export const HelpBubble = ({ label, content }: HelpBubbleProps) => {
  const bubbleId = useId();
  const anchorRef = useRef<HTMLButtonElement>(null);
  const bubbleRef = useRef<HTMLSpanElement>(null);
  const [isPinned, setIsPinned] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [anchor, setAnchor] = useState<{ left: number; top: number } | null>(null);
  /** 화면 밖으로 나가지 않게 좌우로 민 거리. 단추가 바뀌면 0 으로 돌아간다. */
  const [shift, setShift] = useState(0);
  const isOpen = (isPinned || isHovered) && anchor !== null;

  /* 말풍선은 단추의 «가운데» 위에 뜬다. 화면 밖으로 나가면 그린 뒤 안쪽으로 민다. */
  const place = (): void => {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (rect === undefined) return;

    setShift(0);
    setAnchor({ left: rect.left + rect.width / 2, top: rect.top });
  };

  useEffect(() => {
    if (!isOpen) return undefined;

    /* 스크롤하거나 창이 바뀌면 말풍선이 단추를 따라간다 — 따로 떠 있는 상자이기 때문이다. */
    const follow = (): void => place();
    const close = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setIsPinned(false);
    };

    window.addEventListener('scroll', follow, true);
    window.addEventListener('resize', follow);
    window.addEventListener('keydown', close);

    return () => {
      window.removeEventListener('scroll', follow, true);
      window.removeEventListener('resize', follow);
      window.removeEventListener('keydown', close);
    };
  }, [isOpen]);

  /* 그린 뒤 화면 밖으로 나간 만큼만 한 번 밀어 넣는다 — 폭을 모르는 채로 미리 당기지 않는다. */
  useLayoutEffect(() => {
    const bubble = bubbleRef.current;
    if (!isOpen || bubble === null) return;

    const rect = bubble.getBoundingClientRect();
    if (rect.width === 0) return;

    const overflowRight = rect.right - (window.innerWidth - 16);
    const overflowLeft = 16 - rect.left;
    const next = overflowRight > 0 ? -overflowRight : overflowLeft > 0 ? overflowLeft : 0;

    setShift((current) => (Math.abs(next) < 1 ? current : current + next));
  }, [anchor, isOpen]);

  return (
    <>
      <IconButton
        ref={anchorRef}
        size="sm"
        icon="help"
        aria-label={label}
        aria-expanded={isOpen}
        aria-describedby={isOpen ? bubbleId : undefined}
        onClick={() => {
          place();
          setIsPinned((pinned) => !pinned);
        }}
        onMouseEnter={() => {
          place();
          setIsHovered(true);
        }}
        onMouseLeave={() => setIsHovered(false)}
        onFocus={() => {
          place();
          setIsHovered(true);
        }}
        onBlur={() => setIsHovered(false)}
      />
      {/*
        말풍선은 문서 맨 앞(body)에 그린다 — 표 머리줄이 붙박이(sticky)라 표 안에서 그리면
        머리줄에 가린다(브라우저 확인 2026-09-20).
      */}
      {isOpen &&
        createPortal(
          <span
            ref={bubbleRef}
            id={bubbleId}
            role="tooltip"
            className="production-order-help-bubble"
            style={{ left: `${String(anchor.left + shift)}px`, top: `${String(anchor.top)}px` }}
          >
            {content.map((line) => (
              <span key={line} className="production-order-help-bubble-line">
                {line}
              </span>
            ))}
          </span>,
          document.body,
        )}
    </>
  );
};
