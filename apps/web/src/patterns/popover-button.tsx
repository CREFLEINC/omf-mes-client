import { Icon } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

/**
 * 누르면 바로 아래에 작은 판이 펼쳐지는 단추 — 드물게 쓰는 기능을 화면에 늘 세우지 않고 한 곳에 접어 둔다.
 *
 * ⭐ **메뉴(`role="menu"`)가 아니라 펼침(disclosure)이다.** 판 안에 링크 · 선택 칸 · 단추가 섞이는데, 메뉴 역할은
 * 방향키로만 옮겨 다니는 메뉴 항목만 담는다는 약속이라 선택 칸을 넣으면 보조기기가 길을 잃는다. 단추가
 * `aria-expanded` 로 열림을 알리고, 판 밖을 누르거나 Esc 를 누르면 닫힌다(Esc 는 단추로 초점을 돌린다).
 *
 * DS 에 메뉴 부품이 없어 앱이 갖는다(상단 바 이름 메뉴 · 탭 막대 「⋯」).
 */
export interface PopoverButtonProps {
  /** 단추에 보이는 내용. */
  trigger: ReactNode;
  /** 단추의 접근명 — 아이콘만 있는 단추에 준다. */
  label?: string;
  className?: string;
  /** 판의 내용. `close` 로 항목을 고른 뒤 닫는다. */
  children: (close: () => void) => ReactNode;
}

/**
 * 판 안의 칸이 판 밖에 펼친 것(선택 칸의 목록)을 눌렀는가.
 *
 * 디자인 시스템 선택 칸은 목록을 `body` 에 그린다 — DOM 으로는 판 밖이라, 이것을 「밖을 눌렀다」로 보면 선택지를
 * 누르는 순간 판이 닫혀 선택 칸째 사라지고 고른 값이 전해지지 않는다(상단 바 언어 선택 · 사용자 2026-11-27).
 * 펼친 칸은 `aria-controls` 로 제 목록을 가리키므로 그 연결로 판의 것인지 가린다.
 */
const isInsideOwnedLayer = (root: HTMLElement | null, target: Node): boolean => {
  if (root === null) return false;
  return [...root.querySelectorAll('[aria-controls]')].some((owner) => {
    const layerId = owner.getAttribute('aria-controls');
    if (layerId === null || layerId === '') return false;
    return document.getElementById(layerId)?.contains(target) === true;
  });
};

export const PopoverButton = ({ trigger, label, className, children }: PopoverButtonProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event: PointerEvent): void => {
      if (!(event.target instanceof Node)) return;
      if (rootRef.current?.contains(event.target) === true) return;
      if (isInsideOwnedLayer(rootRef.current, event.target)) return;
      setIsOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      setIsOpen(false);
      buttonRef.current?.focus();
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const close = (): void => setIsOpen(false);

  return (
    <div className={className === undefined ? 'popover' : `popover ${className}`} ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="popover-trigger"
        aria-label={label}
        title={label}
        aria-expanded={isOpen}
        aria-controls={isOpen ? panelId : undefined}
        onClick={() => setIsOpen((open) => !open)}
      >
        {trigger}
      </button>
      {isOpen ? (
        <div id={panelId} className="popover-panel">
          {children(close)}
        </div>
      ) : null}
    </div>
  );
};

/** 탭 막대 끝 「⋯」 — 그 화면에서 드물게 쓰는 기능(배치 바꾸기 등)을 모은다. */
export const MoreMenu = ({
  className,
  label = messages.common.shell.moreActions,
  children,
}: {
  /** 화면이 덧붙이는 이름 — 좁은 창에서 통째로 감출 때 쓴다. */
  className?: string;
  /** 단추 이름. 한 화면에 「⋯」가 둘 이상이면 무엇을 여는지 적는다(예: 「ERP W/O 목록과 상세 배치」). */
  label?: string;
  children: (close: () => void) => ReactNode;
}) => (
  <PopoverButton
    className={className === undefined ? 'more-menu' : `more-menu ${className}`}
    label={label}
    trigger={<Icon name="more_horiz" size={20} />}
  >
    {children}
  </PopoverButton>
);
