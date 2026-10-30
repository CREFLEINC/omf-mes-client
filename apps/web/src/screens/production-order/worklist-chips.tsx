import { Chip, type ChipStatus } from '@crefle/web-ui';
import { messages, type ReasonDetail } from '@omf-mes/i18n';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { CountChip as SharedCountChip } from '../../patterns/count-chip';
import type { ProcessState, WorklistReasonItem } from './worklist-model';

const t = messages.erpWorkOrderFlow;

/** 상태 하나에 색 하나(C-19): 조치 필요 경고, 배포 대기 성공, 배포 완료 정보, 계획 전 중립, 취소 오류. 조건 칩과 같은 이름과 색이다(C-16). */
export const STATE_TONE: Record<ProcessState, ChipStatus> = {
  BEFORE_PLAN: 'idle',
  ACTION_REQUIRED: 'warning',
  RELEASE_PENDING: 'success',
  RELEASED: 'info',
  CANCELLED: 'error',
};

const isKnownState = (state: string): state is ProcessState => Object.hasOwn(STATE_TONE, state);

/** 상태 칩. 화면이 모르는 상태 코드는 빈 칩 대신 중립 색으로 코드를 그대로 보인다. */
export const ProcessStateChip = ({ state }: { state: string }) => (
  <Chip variant="status" size="sm" status={isKnownState(state) ? STATE_TONE[state] : 'idle'}>
    {isKnownState(state) ? t.status[state] : state}
  </Chip>
);

type KnownReason = Exclude<keyof typeof t.reasonHelp & keyof typeof t.reasons, 'unknown'>;

const isKnownReason = (code: string): code is KnownReason =>
  code !== 'more' && code !== 'unknown' && Object.hasOwn(t.reasonHelp, code);

/** 사유 칩 이름. 화면이 모르는 코드는 빈 칩 대신 「조치 필요(코드)」로 보인다. */
export const reasonLabel = (code: string): string =>
  isKnownReason(code) ? t.reasons[code] : t.reasons.unknown(code);

/** 사유마다 「무엇이 잘못됐고 어디서 고치는지」 한 줄. 툴팁에 줄을 바꿔 모두 보인다. */
export const reasonHelpText = (
  reasons: readonly WorklistReasonItem[],
  detail: ReasonDetail = {},
): string =>
  reasons
    .map(({ code, workOrderCount }) =>
      isKnownReason(code)
        ? t.reasonHelp[code]({
            ...detail,
            ...(workOrderCount === undefined ? {} : { workOrderCount }),
          })
        : t.reasonHelp.unknown(),
    )
    .join('\n');

const HELP_OPEN_DELAY_MS = 400;
const HELP_EDGE_PX = 8;

/**
 * 말풍선은 표 안에 그리지 않고 `body`에 고정 위치로 그린다. 표의 스크롤 영역(overflow)이 말풍선을 자르는데,
 * 「조치 필요」만 걸러 행이 한두 개이면 영역이 말풍선보다 낮아 어느 쪽으로 열어도 가려진다.
 * 칩 아래에 열고, 아래가 모자라고 위가 넉넉하면 위로 연다. 가로는 화면 안으로 끌어 넣는다.
 */
const ReasonHelpBubble = ({ anchor, lines }: { anchor: HTMLElement; lines: string[] }) => {
  const bubbleRef = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const bubble = bubbleRef.current;
    if (bubble === null) return;
    const rect = anchor.getBoundingClientRect();
    const { offsetWidth: width, offsetHeight: height } = bubble;
    const fitsBelow = rect.bottom + HELP_EDGE_PX + height <= window.innerHeight;
    const fitsAbove = rect.top - HELP_EDGE_PX - height >= 0;
    const top =
      fitsBelow || !fitsAbove ? rect.bottom + HELP_EDGE_PX : rect.top - HELP_EDGE_PX - height;
    const centered = rect.left + rect.width / 2 - width / 2;
    bubble.style.top = `${String(top)}px`;
    bubble.style.left = `${String(Math.min(Math.max(HELP_EDGE_PX, centered), window.innerWidth - width - HELP_EDGE_PX))}px`;
  }, [anchor]);
  return createPortal(
    <span ref={bubbleRef} role="tooltip" className="reason-help-bubble">
      {lines.map((line, index) => (
        <span key={index}>{line}</span>
      ))}
    </span>,
    document.body,
  );
};

/**
 * C-17 사유 칩. 첫 사유와 「외 N」 칩. 사유마다 할 일은 말풍선이 보인다(마우스를 올리거나 초점을 두면 열리고 Esc로 닫는다).
 * 칩 묶음은 하나의 버튼이라 키보드로 닿고, 툴팁 내용이 그 버튼의 설명(aria-describedby)이 된다. 행 이동은 버튼에서 일어나지 않는다.
 */
export const ReasonChips = ({
  reasons,
  detail,
}: {
  reasons: readonly WorklistReasonItem[];
  detail?: ReasonDetail;
}) => {
  const helpId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const focused = useRef(false);
  const [open, setOpen] = useState(false);
  const show = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(true), HELP_OPEN_DELAY_MS);
  };
  const hide = () => {
    window.clearTimeout(timer.current);
    setOpen(false);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);
  /* 고정 위치라 화면이 스크롤되면 칩에서 떨어진다. 열린 채로 두지 않는다. */
  useEffect(() => {
    if (!open) return;
    window.addEventListener('scroll', hide, true);
    return () => window.removeEventListener('scroll', hide, true);
  }, [open]);
  const first = reasons[0];
  if (first === undefined) return null;
  const help = reasonHelpText(reasons, detail).split('\n');
  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="reason-chips"
        aria-describedby={helpId}
        onMouseEnter={show}
        onMouseLeave={() => {
          if (!focused.current) hide();
        }}
        onFocus={() => {
          focused.current = true;
          show();
        }}
        onBlur={() => {
          focused.current = false;
          hide();
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') hide();
        }}
      >
        <Chip variant="status" size="sm" status="warning">
          {reasonLabel(first.code)}
        </Chip>
        {reasons.length > 1 && (
          <Chip variant="status" size="sm" status="idle">
            {t.reasons.more(reasons.length - 1)}
          </Chip>
        )}
        <span className="info-mark" aria-hidden="true">
          ⓘ
        </span>
      </button>
      {open && buttonRef.current !== null && (
        <ReasonHelpBubble anchor={buttonRef.current} lines={help} />
      )}
      {/* 말풍선은 열릴 때만 그려지므로, 화면 읽기 프로그램이 늘 읽을 설명을 따로 둔다. */}
      <span id={helpId} className="visually-hidden">
        {help.join(' ')}
      </span>
    </>
  );
};

/** 페이지 머리 상태별 건수(C-17). 공용 `CountChip`에 상태 칩과 같은 색을 넘긴다(C-19). */
export const CountChip = ({
  state,
  label,
  selected,
  onSelect,
}: {
  state: ProcessState;
  label: string;
  selected: boolean;
  onSelect: () => void;
}) => (
  <SharedCountChip tone={STATE_TONE[state]} label={label} selected={selected} onSelect={onSelect} />
);
