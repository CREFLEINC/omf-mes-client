/*
 * 열린 드롭다운 목록을 시스템 바 안쪽으로 맞춘다(omf-all-around#22).
 *
 * DS Select 는 목록을 셸 밖 body 에 그리고, 아래로 열지 위로 열지를 window.innerHeight 로
 * 정한다. Android 15 는 앱을 화면 끝까지 늘려 그 높이에 내비게이션 바가 들어 있으므로,
 * 바에 가리는 자리를 「들어간다」로 판정해 항목이 뒤로가기·홈 밑으로 내려간다. DS 는 외부
 * 패키지라 셸이 여백을 뺀 영역을 기준으로 다시 놓는다.
 */

export interface ListboxRoom {
  triggerTop: number;
  triggerBottom: number;
  /** DS 최대 높이까지 찬 목록 높이. */
  listHeight: number;
  gap: number;
  safeTop: number;
  safeBottom: number;
}

export interface ListboxPlacement {
  top: number;
  /** null 이면 DS 높이를 그대로 둔다. */
  maxHeight: number | null;
}

/** 아래에 다 들어가면 아래, 위에 다 들어가면 위. 둘 다 모자라면 넓은 쪽에 맞춰 줄인다. */
export const placeListbox = (room: ListboxRoom): ListboxPlacement => {
  const below = room.safeBottom - room.triggerBottom - room.gap;
  const above = room.triggerTop - room.gap - room.safeTop;

  if (room.listHeight <= below) {
    return { top: room.triggerBottom + room.gap, maxHeight: null };
  }

  if (room.listHeight <= above) {
    return { top: room.triggerTop - room.gap - room.listHeight, maxHeight: null };
  }

  if (below >= above) {
    return { top: room.triggerBottom + room.gap, maxHeight: Math.max(below, 0) };
  }

  return { top: room.safeTop, maxHeight: Math.max(above, 0) };
};

const ADJUSTED = 'safeAreaPlaced';

/** 셸의 여백 안쪽. 여백이 시스템 바 높이라 이 상자는 바에 가리지 않는다. */
const safeBounds = (): { top: number; bottom: number } | null => {
  const shell = document.querySelector<HTMLElement>('.mobile-shell');

  if (shell === null) {
    return null;
  }

  const rect = shell.getBoundingClientRect();
  const style = window.getComputedStyle(shell);

  return {
    top: rect.top + (Number.parseFloat(style.paddingTop) || 0),
    bottom: rect.bottom - (Number.parseFloat(style.paddingBottom) || 0),
  };
};

const adjust = (listbox: HTMLElement) => {
  // DS 가 자리를 재기 전(숨김)에는 손대지 않는다. 한 번 연 목록은 한 번만 맞춘다.
  if (listbox.style.visibility !== 'visible' || listbox.dataset[ADJUSTED] !== undefined) {
    return;
  }

  const trigger = document.querySelector<HTMLElement>(`[aria-controls="${listbox.id}"]`);
  const bounds = safeBounds();

  if (trigger === null || bounds === null) {
    return;
  }

  listbox.dataset[ADJUSTED] = '';

  const triggerRect = trigger.getBoundingClientRect();
  const listRect = listbox.getBoundingClientRect();
  const placement = placeListbox({
    triggerTop: triggerRect.top,
    triggerBottom: triggerRect.bottom,
    listHeight: listRect.height,
    gap: Number.parseFloat(window.getComputedStyle(listbox).getPropertyValue('--space-1')) || 0,
    safeTop: bounds.top,
    safeBottom: bounds.bottom,
  });

  // DS 가 준 top 은 포털 기준 좌표다. 화면 좌표의 차이만큼만 옮겨 기준을 따지지 않는다.
  const currentTop = Number.parseFloat(listbox.style.top) || 0;
  listbox.style.top = `${currentTop + placement.top - listRect.top}px`;

  if (placement.maxHeight !== null) {
    listbox.style.maxHeight = `${placement.maxHeight}px`;
  }
};

/** 셸이 떠 있는 동안 열리는 목록을 맞춘다. 해제 함수를 낸다. */
export const keepListboxesInSafeArea = (): (() => void) => {
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      const target = record.target;

      if (target instanceof HTMLElement && target.matches('[role="listbox"][data-placement-v]')) {
        adjust(target);
      }
    }
  });

  observer.observe(document.body, {
    subtree: true,
    attributes: true,
    attributeFilter: ['style'],
  });

  return () => observer.disconnect();
};
