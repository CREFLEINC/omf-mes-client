import './review-help.css';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/** Help escapes pane clipping and follows its anchor within the visible viewport. */
export const ReviewHelp = ({ title, children }: { title: string; children: string }) => {
  const id = useId();
  const anchor = useRef<HTMLButtonElement>(null);
  const tooltip = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelClose = () => {
    if (closeTimer.current !== null) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  const show = () => {
    cancelClose();
    setOpen(true);
  };
  const hide = () => {
    cancelClose();
    setOpen(false);
    setPosition(null);
  };
  const leave = () => {
    cancelClose();
    if (document.activeElement !== anchor.current) closeTimer.current = setTimeout(hide, 160);
  };
  useEffect(
    () => () => {
      if (closeTimer.current !== null) clearTimeout(closeTimer.current);
    },
    [],
  );
  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      if (!anchor.current || !tooltip.current) return;
      const box = anchor.current.getBoundingClientRect();
      const tip = tooltip.current.getBoundingClientRect();
      const margin = 12,
        gap = 8;
      const width = document.documentElement.clientWidth || window.innerWidth;
      const height = window.innerHeight;
      if (box.bottom < 0 || box.top > height || box.right < 0 || box.left > width) {
        setOpen(false);
        setPosition(null);
        return;
      }
      const below = height - box.bottom - margin,
        above = box.top - margin;
      const top =
        below >= tip.height || below >= above ? box.bottom + gap : box.top - tip.height - gap;
      const next = {
        left: Math.max(
          margin,
          Math.min(box.left + box.width / 2 - tip.width / 2, width - tip.width - margin),
        ),
        top: Math.max(margin, Math.min(top, height - tip.height - margin)),
      };
      setPosition((current) =>
        current?.left === next.left && current?.top === next.top ? current : next,
      );
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    window.visualViewport?.addEventListener('resize', update);
    window.visualViewport?.addEventListener('scroll', update);
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    if (tooltip.current) resize?.observe(tooltip.current);
    const intersection =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver((entries) => {
            if (entries.some((entry) => !entry.isIntersecting)) {
              setOpen(false);
              setPosition(null);
            }
          });
    if (anchor.current) intersection?.observe(anchor.current);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
      window.visualViewport?.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('scroll', update);
      resize?.disconnect();
      intersection?.disconnect();
    };
  }, [open, children]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !anchor.current?.contains(event.target) &&
        !tooltip.current?.contains(event.target)
      )
        hide();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') hide();
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  return (
    <>
      <button
        ref={anchor}
        type="button"
        className="info-mark"
        aria-label={`${title} 도움말`}
        aria-describedby={open ? id : undefined}
        onMouseEnter={show}
        onMouseLeave={leave}
        onFocus={show}
        onBlur={hide}
        onClick={show}
      >
        ?
      </button>
      {open &&
        createPortal(
          <div
            ref={tooltip}
            id={id}
            role="tooltip"
            className="proposal-review-help"
            style={{
              left: position?.left ?? 12,
              top: position?.top ?? 12,
              visibility: position ? 'visible' : 'hidden',
            }}
            onMouseEnter={cancelClose}
            onMouseLeave={leave}
          >
            {children}
          </div>,
          document.body,
        )}
    </>
  );
};
