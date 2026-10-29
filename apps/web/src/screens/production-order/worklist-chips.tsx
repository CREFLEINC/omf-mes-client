import { Chip, Tooltip, type ChipStatus } from '@crefle/web-ui';
import { messages, type ReasonDetail } from '@omf-mes/i18n';
import { useId } from 'react';

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

/**
 * C-17 사유 칩. 첫 사유와 「외 N」 칩. 사유마다 할 일은 DS 툴팁이 보인다(마우스를 올리거나 초점을 두거나 누르면 열린다).
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
  const first = reasons[0];
  if (first === undefined) return null;
  const help = reasonHelpText(reasons, detail).split('\n');
  return (
    <>
      <Tooltip
        content={
          <span className="reason-help">
            {help.map((line, index) => (
              <span key={index}>{line}</span>
            ))}
          </span>
        }
      >
        <button type="button" className="reason-chips" aria-describedby={helpId}>
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
      </Tooltip>
      {/* 툴팁은 열릴 때만 그려지므로, 화면 읽기 프로그램이 늘 읽을 설명을 따로 둔다. */}
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
