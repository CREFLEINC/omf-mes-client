import { Button, Dialog, Icon, TextField } from '@crefle/web-ui';
import type { ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useId, useState, type FormEvent, type ReactElement, type ReactNode } from 'react';

import { SaveErrorBanner } from '../../patterns/master';

import { Select } from '../../patterns/select';
import { isKnownCode, type CodeOption } from './code-options';
import { FieldLabel } from './field-label';

import {
  canConfirm,
  dropLeadingZeros,
  formatMicro,
  fromServerQty,
  hasQuantityError,
  toTotals,
  validateQuantities,
  type QuantityDraft,
} from './quantity-draft';
import type { InspectionResultRound } from './types';
import { withUom } from './uom-lookup';

/**
 * 수량 판정 구획 — **합계 제약이 이 구획을 지배한다.**
 *
 * ```
 * 합격 + 불합격 + 보류 = 검사수량
 * ```
 *
 * 세 칸을 손으로 넣고 합계·잔여를 실시간으로 보인다. ⛔ **자동 계산을 만들지 않는다** —
 * 어느 칸을 자동으로 채울지가 아직 정해지지 않았다(스펙 §8-4). 편의를 먼저 얹으면 규칙이
 * 정해질 때 사용자가 이미 익힌 동작을 뒤집어야 한다.
 *
 * ⛔ **확정된 회차는 고칠 수 있는 것처럼 보이지 않게 한다.** 이전 회차는 정정하지 않고
 * 재검사로 새 회차를 쌓는다(§5-3). 잠근 이유를 사유로 함께 밝힌다.
 *
 * ⛔ **검사자·단말을 보내지 않는다.** 계약에서 사라졌다 — 검사자는 로그인한 주체에서 서버가
 * 정하는 값이라 화면이 만들 수 없고, 세션 값을 실으면 품질 감사 기록에 엉뚱한 사람이 남는다
 * (omf-mes#173). 단말도 같다.
 *
 * ⭐ **합계가 맞지 않아도 저장된다.** 임시 저장은 판정을 확정하는 것이 아니라 하던 일을 남기는
 * 것이고, 계약도 「작성중」에는 합계 제약을 걸지 않는다(스펙 §6). **막는 것은 수량이 아닌 값이
 * 남아 있을 때뿐이다** — 보낼 수 없는 값이라서지 합계 때문이 아니다.
 *
 * ⛔ **오류를 타이핑마다 보이지 않는다.** 「0.5」를 치는 정상 경로가 `0` → `0.` → `0.5` 라,
 * 가운데 한 글자 동안 「수량이 아니다」가 뜨면 맞게 치는 사람에게 틀렸다고 말하는 셈이다.
 * 조건 줄(`queue-filter-bar.tsx`)과 같은 규율로 **저장을 누른 뒤부터** 보인다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */

const t = messages.iqcInspection.result;

export interface ResultFormPaneProps {
  /** 편집할 회차. 아직 아무도 손대지 않은 의뢰면 `null` */
  round: InspectionResultRound | null;
  /** 검사수량 — 회차가 있으면 그 값, 없으면 의뢰의 입하 등록 수량이다(§4-B 「자동」) */
  inspectedQty: number;
  /** 수량 옆에 붙일 단위 코드(표시 전용). 모르면 `null` — 숫자만 둔다 */
  uomCode: string | null;
  draft: QuantityDraft;
  /** 마지막 저장 상태와 달라진 것이 있는가(세 수량 칸·종합 판정). 없으면 [임시 저장]을 끈다 */
  hasChanges: boolean;
  onChange: (draft: QuantityDraft) => void;
  onSave: () => void;
  isSaving: boolean;
  /** 서버가 칸을 짚어 준 오류. 로컬 검증 결과와 합쳐 그 칸에 낸다 */
  fieldErrors: Record<string, string>;
  saveError: ApiError | null;
  /** 충돌일 때 「최신 불러오기」를 낸다. 재조회로 풀리지 않는 오류에는 배너가 내지 않는다 */
  onReload: () => void;

  /** 종합 판정 선택지. **비어 있을 수 있다** — 시드가 아직 안 들어간 상태다 */
  judgmentOptions: CodeOption[];
  judgment: string;
  onJudgmentChange: (code: string) => void;
  onConfirm: () => void;
  isConfirming: boolean;
  confirmError: ApiError | null;

  /**
   * 지금 **재검사 회차를 쓰는 중**인가. 참이면 `round` 가 `null` 로 들어와 칸이 열려 있다.
   *
   * ⭐ 회차 번호를 받지 않는다 — **아직 만들어지지 않은 회차**라 번호가 없다. 서버가 저장할
   * 때 +1 하며, 화면이 미리 세면 두 사람이 동시에 열었을 때 같은 번호를 만든다.
   */
  /**
   * **방금** 확정했는가. 확정된 회차라는 «상태»와 다르다 — 상태는 어제 확정된 회차에도
   * 참이라, 그것으로 결과를 알리면 화면에 들어올 때마다 방금 한 일처럼 말한다.
   */
  isJustConfirmed: boolean;
  isReinspecting: boolean;
  /** 확정된 회차에서 재검사를 시작한다. **여는 것뿐이다** — 회차는 저장이 만든다 */
  onStartReinspection: () => void;
  onCancelReinspection: () => void;
  /**
   * 저장 «전»에 막는 사유(omf-all-around#104) — 계정에 작업자가 연결되지 않으면 서버가 검사자를 풀지 못해
   * 저장이 400 이 된다. 누르고 실패하기 전에 무엇을 해야 하는지 말하고 저장·확정을 잠근다.
   */
  saveBlockedReason?: string | null;
  /** 작업자 미연결로 막혔을 때 이 화면에서 바로 사번을 잇는 창을 연다(사용자 지시 2026-10-28 · #197). 주지 않으면 단추가 없다 */
  onConnectWorker?: (() => void) | null;
  /**
   * 입력으로 풀 수 없는 막힘(작업자 미연결 등) — 저장·확정이 막힌 채 칸만 열려 있지 않게 입력 칸도 잠근다(#135).
   * 수량·판정처럼 입력을 고쳐 푸는 막힘에는 쓰지 않는다.
   */
  isInputLocked?: boolean;
  /** 종합 판정 바로 아래 칸 — 불합격 사유(omf-all-around#106). 화면이 판정에 따라 채운다. */
  judgmentDetail?: ReactNode;
  /**
   * 검사 수량 바로 아래 불량 내역(사용자 지시 · 시안 2026-10-28 · #197). 주면 불합격 수량은 불량 내역 합계라 수량 줄에 불합격
   * 칸을 두지 않는다. 없으면 종전대로다
   */
  renderDefects?: (() => ReactNode) | null;
  /** 최종 판정 칸 바로 아래 — 판정 변경 사유(#133). 없으면 두지 않는다 */
  judgmentBelow?: ReactNode;
  /** 최종 판정 라벨 옆 보조 글 — 자동 판정 기준(#133). 없으면 두지 않는다 */
  judgmentHint?: string;
  /** 4M 변경 정보 — 판정과 다른 업무라 판정 아래 소제목을 두고 따로 선다(#133). 없으면 구획을 두지 않는다 */
  fourMSlot?: ReactNode;
  /**
   * 확정된 회차의 「재검사」 자리를 대신할 안내(omf-all-around#106 후속) — LOT 이 불량이면 재검 회차를 확정할 수
   * 없어 처분·반품으로 잇는다. 없으면 종전대로 「재검사」 단추다.
   */
  reinspectReplacement?: ReactNode;
  /** 확정된 회차를 다시 검사할 수 없는 까닭(LOT 이 검사 대기가 아님 · #185). 있으면 재검사 단추 대신 이 글줄이 선다. */
  reinspectBlockedReason?: string | null;
  /** 최종 판정을 검사 수량 줄에 세운다 — 상하 배치(사용자 지시 2026-10-27 · #185). */
  inlineJudgment?: boolean;
  /** 「판정 상세 입력」에 적을 것이 있는가(불합격 · 판정 변경 사유) — 수량 줄 판정일 때만 본다. */
  hasJudgmentDetail?: boolean;
  /** 2단계(판정)를 다 채웠다 — 판정을 골랐고 꼭 적을 상세가 비지 않았다. 단계 번호가 강조색이 된다. */
  judgmentDone?: boolean;
  /** 3단계(4M)를 다 채웠다 — 4M 변경품이고 비고를 적었다. */
  fourMDone?: boolean;
  /** 「판정 상세 입력」 창을 열 때 — 부르는 쪽이 지금 값을 담아 둔다. */
  onJudgmentDetailOpen?: () => void;
  /** 「판정 상세 입력」 창의 [취소] — 열 때 값으로 되돌린다. */
  onJudgmentDetailCancel?: () => void;
  /** 확정만 막는 사유(저장은 막지 않는다) — 불합격인데 불량 코드를 고르지 않았을 때다. */
  confirmOnlyBlockedReason?: string | null;
  /** 3단계(4M)를 접었을 때 한 줄 요약 — 「4M 변경품」 · 「변경 없음」(#197). */
  fourMSummary?: string;
  /** ① 수량 [확정]으로 판정 단계로 넘어갈 때 — 부르는 쪽이 최종 판정을 자동으로 채운다(사용자 지시 2026-10-29 · #197). */
  onQtyConfirm?: () => void;
  /** 불량 내역에 수량이 아닌 값이 있다 — 불량 합계를 믿을 수 없어 수량 줄을 「확인 필요」로 보인다(표시 전용 · #197). */
  rejectedUncountable?: boolean;
}

/** 단계 하나를 그릴까 — 펼침 · 감춤(차례로 열 때 지금 단계가 아님 · #197). */
type StepView = 'open' | 'hidden';

/** 계약이 짚어 줄 수 있는 칸 이름 ↔ 화면의 초안 칸. */
const FIELD_OF: Record<string, keyof QuantityDraft> = {
  acceptedQty: 'accepted',
  rejectedQty: 'rejected',
  heldQty: 'held',
};

/**
 * 단계 머리 — 「① 검사 수량 입력 ──── ② 판정 ──── ③ 4M 변경 정보」(사용자 지시 2026-10-27 · #185).
 * 입력에 따라 단계가 넘어간다(사용자 지시 2026-10-27 · #185) — 다 채운 단계는 번호 · 제목 · 이어지는 선이 강조색,
 * 아직 덜 채운 첫 단계가 「지금 단계」로 번호 · 제목이 강조색, 그 뒤 단계는 흐리다. 마지막 단계는 선이 없다.
 */
const StepHead = ({
  step,
  title,
  done,
  current,
  hint,
  children,
}: {
  step: number;
  title: string;
  done: boolean;
  current: boolean;
  hint?: string;
  children?: ReactNode;
}) => (
  <div
    className="iqc-inspection-step-head"
    data-done={done ? '' : undefined}
    data-current={current ? '' : undefined}
    aria-current={current ? 'step' : undefined}
  >
    <span className="iqc-inspection-step-no" aria-hidden>
      {step}
    </span>
    <h3 title={hint}>{title}</h3>
    {children}
    <span className="iqc-inspection-step-line" aria-hidden />
  </div>
);

export const ResultFormPane = ({
  round,
  inspectedQty,
  uomCode,
  draft,
  hasChanges,
  onChange,
  onSave,
  isSaving,
  fieldErrors,
  saveError,
  onReload,
  judgmentOptions,
  judgment,
  onJudgmentChange,
  onConfirm,
  isConfirming,
  confirmError,
  isJustConfirmed,
  isReinspecting,
  onStartReinspection,
  onCancelReinspection,
  saveBlockedReason = null,
  onConnectWorker = null,
  isInputLocked = false,
  judgmentDetail = null,
  renderDefects = null,
  fourMSlot = null,
  judgmentHint,
  judgmentBelow = null,
  confirmOnlyBlockedReason = null,
  reinspectReplacement = null,
  reinspectBlockedReason = null,
  inlineJudgment = false,
  hasJudgmentDetail = false,
  onJudgmentDetailOpen,
  onJudgmentDetailCancel,
  judgmentDone = false,
  fourMDone = false,
  fourMSummary,
  rejectedUncountable = false,
  onQtyConfirm,
}: ResultFormPaneProps) => {
  const judgmentId = useId();
  const qtyIdBase = useId();
  const partialNoteId = useId();
  /* 꺼진 단계 단추의 사유 글(C-4) — 단추가 aria-describedby 로 잇는다(#197). */
  const blockedNoteId = useId();
  const isConfirmed = round?.statusCode === 'CONFIRMED';
  const errors = validateQuantities(draft);
  const totals = toTotals(draft, inspectedQty);
  const [showErrors, setShowErrors] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  /**
   * 저장. **합계가 맞지 않아도 보낸다** — 막는 것은 보낼 수 없는 값이 남아 있을 때뿐이다.
   */
  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    setShowErrors(true);

    if (hasQuantityError(errors)) return;

    onSave();
  };

  /**
   * 확정이 막혔다면 **무엇이** 막혔는지. 풀렸으면 `null`.
   *
   * ⛔ 세 갈래를 뭉개지 않는다 — 푸는 방법이 다르다. 합계는 수량을 고쳐야 하고, 판정은
   * 골라야 하며, 확정된 회차는 재검사로 새 회차를 쌓아야 한다(스펙 §6 · §5-3).
   */
  const confirmBlockedReason: string | null = isConfirmed
    ? t.confirmBlockedByConfirmed
    : saveBlockedReason !== null
      ? saveBlockedReason
      : /*
         * ⛔ **회차가 없으면 확정할 것이 없다.** 확정은 회차 하나를 경로로 지목하는 쓰기라,
         * 아직 만들어지지 않은 회차를 지목하면 치환되지 않은 «주소 틀» 이 그대로 나간다.
         * 그러면 사용자는 화면에서 가장 중요한 단추를 눌렀는데 알 수 없는 오류만 받는다 —
         * 실제로 할 일은 먼저 임시 저장을 하는 것이고 그것을 사유가 말한다.
         */
        round === null
        ? t.confirmBlockedByUnsaved
        : !canConfirm(totals)
          ? t.confirmBlockedByTotals
          : judgment === ''
            ? t.confirmBlockedByJudgment
            : confirmOnlyBlockedReason;

  /** 서버가 짚어 준 칸 오류를 화면의 칸 이름으로 옮긴다. */
  const serverErrorOf = (key: keyof QuantityDraft): string | undefined => {
    const entry = Object.entries(FIELD_OF).find(([, local]) => local === key);

    return entry === undefined ? undefined : fieldErrors[entry[0]];
  };

  /*
   * 총 검사 수량 카드에 넘치면 「+3 EA」, 모자라면 「-1 EA」를 붙인다(사용자 지시 2026-10-27 · #185).
   * ⛔ 셀 수 없으면(한 칸이라도 수량이 아니면) 아무 말도 하지 않는다 — 그 칸의 오류가 이미 말한다.
   */
  const isOver = totals.kind === 'counted' && totals.remaining < 0n;
  const deltaText =
    totals.kind !== 'counted' || totals.remaining === 0n
      ? null
      : isOver
        ? t.overDelta(withUom(formatMicro(-totals.remaining), uomCode))
        : t.shortDelta(withUom(formatMicro(totals.remaining), uomCode));

  const inspectedText = withUom(String(inspectedQty), uomCode);
  const qtyDone = totals.kind === 'counted' && totals.matches && !isOver;
  const roundKey = isReinspecting ? 'reinspect' : String(round?.inspectionResultId ?? 'new');
  /*
   * 단계 진행(사용자 지시 2026-10-28 · #197) — `view` 는 지금 펼친 단계(없으면 저장된 진행을 따른다), `qtyConfirmed` 는 이
   * 회차에서 수량 [확정]을 눌렀는가. 펼친 단계를 옮겨도 완료 여부는 바뀌지 않는다.
   */
  const [progress, setProgress] = useState<{
    roundKey: string;
    view: number | null;
    qtyConfirmed: boolean;
    /* [확정]으로 도달한 가장 뒤 단계 — 그 단계까지만 보인다. */
    reached: number;
  }>({ roundKey, view: null, qtyConfirmed: false, reached: 1 });
  /*
   * 회차가 바뀌면 처음부터 — 단, 첫 임시 저장으로 회차가 막 생긴 것(«new» · 재검사 → 회차)은 같은 회차라 진행을 잇는다.
   * 다른 의뢰로 옮기면 부르는 쪽이 이 구획을 새로 그린다(`key`).
   */
  if (
    (progress.roundKey === 'new' || progress.roundKey === 'reinspect') &&
    roundKey !== 'new' &&
    roundKey !== 'reinspect'
  ) {
    setProgress({ ...progress, roundKey });
  }
  const sameRound = progress.roundKey === roundKey || progress.roundKey === 'new';
  const viewStep = sameRound ? progress.view : null;
  const qtyConfirmed = sameRound && progress.qtyConfirmed;
  const reachedStep = sameRound ? progress.reached : 1;
  /*
   * 수량 [확정](또는 Enter)은 합계가 총 검사 수량과 맞지 않아도 누를 수 있다 — 덜 채운 채 판정을 고르고 임시 저장하던
   * 종전 흐름을 지킨다(사용자 지시 2026-10-28 · #197). 칸이 수량이 아니면(셀 수 없으면)만 막는다. 판정 확정은 종전대로
   * 합계가 맞아야 열린다.
   */
  const canConfirmQty = totals.kind === 'counted';
  /* ① 을 마쳤다 — 합계가 맞거나, 이 회차에서 수량 [확정]을 눌렀다. */
  const qtyStepDone = qtyDone || (canConfirmQty && qtyConfirmed);
  /* 지금 단계 — 덜 채운 첫 단계. 확정된 회차는 고칠 것이 없어 두지 않는다. 4M 칸이 없으면 3단계도 없다. */
  const currentStep = isConfirmed
    ? null
    : !qtyStepDone
      ? 1
      : !judgmentDone
        ? 2
        : fourMSlot !== null && !fourMDone
          ? 3
          : null;

  /*
   * 단계를 차례로 연다(사용자 지시 2026-10-28 · #197) — 위 가로 단계 줄은 진행만 보이고, 지금 단계의 입력은 그 아래 한 자리에
   * 바로 선다(창을 띄우지 않는다). ① 수량 [확정](또는 Enter) → ② 판정 [확정] → ③ 4M. 마친 단계의 [변경]으로 그 입력을 같은
   * 자리에 다시 연다. 다시 열었을 때는 저장된 값으로 단계를 정한다.
   * ⛔ 확정된 회차는 고칠 것이 없어 종전처럼 모두 펼친다.
   */
  const lastStep = fourMSlot !== null ? 3 : 2;
  /* 덜 채운 첫 단계 — 다 채웠으면 마지막 단계 다음(모든 카드가 「마침」)이다. */
  const firstOpenStep = currentStep ?? lastStep + 1;
  const isSequential = inlineJudgment && !isConfirmed;
  /* 저장된 진행 — 수량 합계가 맞게 저장됐으면 ②, 판정까지 저장됐으면 ③(4M 이 없으면 ②까지). */
  const savedStep = (() => {
    if (round === null || isReinspecting) return 1;
    const saved = toTotals(
      {
        accepted: String(round.acceptedQty),
        rejected: String(round.rejectedQty),
        held: String(round.heldQty),
      },
      inspectedQty,
    );
    if (!canConfirm(saved)) return 1;
    return round.overallJudgmentCode === '' ? 2 : lastStep;
  })();
  /*
   * 펼칠 단계 — [변경]으로 고른 단계, 아니면 저장된 진행. 앞 단계가 다시 덜 채워지면 그 단계로 돌아온다. 입력하는 동안
   * 합계가 맞아도 저절로 다음 단계로 넘기지 않는다 — [확정]을 눌러야 넘어간다.
   */
  const shownStep = Math.min(viewStep ?? savedStep, firstOpenStep);
  const stepDone = (step: number): boolean =>
    step === 1 ? qtyStepDone : step === 2 ? judgmentDone : fourMDone;
  const stepView = (_step: number): StepView => (isSequential ? 'hidden' : 'open');
  /* 보이는 단계 — [확정]으로 도달했거나 저장된 진행까지. 그 뒤 단계는 그리지 않는다(사용자 지시 2026-10-28 · #197). */
  const visibleUpTo = Math.max(reachedStep, savedStep, shownStep);
  const openStep = (step: number): void =>
    setProgress({ roundKey, view: step, qtyConfirmed, reached: reachedStep });
  const confirmQty = (): void => {
    onQtyConfirm?.();
    setProgress({ roundKey, view: 2, qtyConfirmed: true, reached: Math.max(reachedStep, 2) });
  };
  /* 판정 [확정] → ③ 4M. 4M 이 없으면 펼칠 단계가 없다(3 은 마지막 단계 다음이다). */
  const confirmJudgment = (): void =>
    setProgress({ roundKey, view: 3, qtyConfirmed, reached: Math.max(reachedStep, 3) });
  const qtyText = (raw: string): string => withUom(raw.trim() === '' ? '0' : raw, uomCode);
  const judgmentText =
    judgmentOptions.find((option) => option.value === judgment)?.label ?? judgment;

  /* 회차 · 재검사 라벨 — 단계 머리 옆(모두 펼칠 때) 또는 가로 단계 줄 위(차례로 열 때)에 선다. */
  const roundBadges = (
    <>
      {/* 회차는 제목 옆 라벨로(사용자 지시 2026-10-27 · #185). 회차가 아직 없으면 두지 않는다. */}
      {isReinspecting ? (
        <span className="iqc-inspection-head-badge iqc-inspection-round-badge">
          {t.reinspectRound}
        </span>
      ) : round !== null ? (
        <span className="iqc-inspection-head-badge iqc-inspection-round-badge">
          {t.round(round.inspectionRound)}
        </span>
      ) : null}
      {/* 재검사 안내 — 「재검사」 라벨 옆, 정보 아이콘이 붙은 라벨(사용자 지시 2026-10-27 · #185). */}
      {isReinspecting && (
        <span className="iqc-inspection-head-badge iqc-inspection-locked-badge">
          <Icon name="info" size={14} aria-hidden />
          {t.reinspectNote}
        </span>
      )}
    </>
  );
  const hasRoundBadges = isReinspecting || round !== null;

  /*
   * 가로 단계 줄 — 「① 검사 수량 입력 ② 판정 ③ 4M 변경 정보」를 한 줄에 나란히(사용자 지시 2026-10-27 · #197). 마친 단계는
   * 체크 표시 · 입력 요약 · [변경], 지금 단계는 강조 테두리, 남은 단계는 흐리다. 그 아래에 지금 단계의 입력만 선다.
   */
  const stepItems = [
    {
      step: 1,
      title: t.sectionTitle,
      summary: t.stepSummary.quantities(
        qtyText(draft.accepted),
        qtyText(draft.rejected),
        qtyText(draft.held),
      ),
    },
    { step: 2, title: t.judgmentSectionTitle, summary: judgmentText },
    { step: 3, title: t.fourMChange.sectionTitle, summary: fourMSummary ?? '' },
  ].filter((item) => item.step <= lastStep);
  /*
   * 단계 접기 · 펼치기(사용자 지시 2026-10-28 · #197) — 세 단계를 위아래로 쌓고, 단계 머리를 누르면 그 단계 입력이 바로 아래에
   * 펼쳐진다(한 번에 하나). 펼친 단계를 다시 누르면 접힌다. 남은 단계는 열 수 없다. 함수로 두는 까닭 — 펼친 자리에 아래에서
   * 만드는 칸(수량 · 판정)을 그린다.
   */
  const toggleStep = (step: number): void => {
    if (shownStep === step) setProgress({ roundKey, view: 0, qtyConfirmed, reached: reachedStep });
    else openStep(step);
  };
  const stepper = (): ReactNode =>
    isSequential ? (
      <div className="iqc-inspection-stepper-wrap">
        {hasRoundBadges && <div className="iqc-inspection-stepper-meta">{roundBadges}</div>}
        <ol className="iqc-inspection-stepper">
          {stepItems.map((item) => {
            const isOpen = item.step === shownStep;
            const state = stepDone(item.step)
              ? 'done'
              : item.step === firstOpenStep
                ? 'current'
                : 'todo';
            /* 남은 단계는 아예 그리지 않는다 — 앞 단계를 마쳐야 그 단계가 선다(사용자 지시 2026-10-28 · #197). */
            if (state === 'todo' || item.step > visibleUpTo) return null;
            const head = (
              <>
                {/* 번호만 — 체크 표시는 수량 일치 · 저장 완료로 읽힐 수 있어 두지 않는다(사용자 지시 2026-10-29 · #197). */}
                <span className="iqc-inspection-step-no" aria-hidden>
                  {item.step}
                </span>
                <span className="iqc-inspection-stepper-text">
                  <span className="iqc-inspection-stepper-title">{item.title}</span>
                  {/* 접힌 마친 단계는 적은 값을 한 줄로 보인다. */}
                  {state === 'done' && !isOpen && item.summary !== '' && (
                    <span className="iqc-inspection-stepper-summary" title={item.summary}>
                      {item.summary}
                    </span>
                  )}
                </span>
                {state === 'done' && !isOpen && (
                  <span className="iqc-inspection-stepper-change">{t.stepSummary.change}</span>
                )}
              </>
            );
            return (
              <li
                key={item.step}
                data-step-state={state}
                data-open={isOpen ? '' : undefined}
                aria-current={state === 'current' ? 'step' : undefined}
              >
                <button
                  type="button"
                  className="iqc-inspection-step-toggle"
                  aria-expanded={isOpen}
                  onClick={() => toggleStep(item.step)}
                >
                  {head}
                  <Icon name={isOpen ? 'expand_less' : 'expand_more'} size={20} aria-hidden />
                </button>
                {isOpen && stepPanel(item.step, item.title)}
              </li>
            );
          })}
        </ol>
      </div>
    ) : null;

  /*
   * `input` — 검사 수량 단계의 수량 줄(#197): 라벨(「합격 수량 · EA」) 위 · 테두리 칸(사용자 시안 2026-10-29). `card` — 확정 회차 등
   * 종전 카드 넷.
   */
  const field = (
    key: keyof QuantityDraft,
    label: string,
    invalid: boolean,
    variant: 'card' | 'input' = 'card',
  ): ReactElement => (
    /* 단위 코드는 칸 바로 옆 글자로 — 입력값 자체에는 넣지 않는다. 모르면 붙이지 않는다. */
    /* 칸 종류 — 숫자 색을 판정 색으로(합격 초록 · 불합격 빨강 · 보류 노랑 · 사용자 지시 2026-10-27 · #185). */
    <div
      className={variant === 'card' ? 'iqc-inspection-qty-field' : 'iqc-inspection-qty-input'}
      data-kind={key}
    >
      {variant === 'input' && <FieldLabel htmlFor={`${qtyIdBase}-${key}`} label={label} />}
      <TextField
        id={variant === 'input' ? `${qtyIdBase}-${key}` : undefined}
        label={variant === 'card' ? label : undefined}
        inputMode="decimal"
        /* 「0」은 흐린 안내 글자일 뿐 값이 아니다 — 빈 칸은 저장 때 0 으로 보내던 그대로다. */
        placeholder="0"
        value={draft[key]}
        disabled={isConfirmed || isSaving || isInputLocked}
        /* 서버가 짚어 준 것을 먼저 낸다 — 그쪽이 이 값에 대해 더 아는 쪽이다. */
        error={serverErrorOf(key) ?? (showErrors && invalid ? t.quantityInvalid : undefined)}
        /* 단위는 입력 상자 안 오른쪽 끝(사용자 시안 2026-10-29). */
        trailingIcon={
          variant === 'input' && uomCode !== null ? (
            <span className="iqc-inspection-qty-computed-unit">{uomCode}</span>
          ) : undefined
        }
        onChange={(event) => onChange({ ...draft, [key]: dropLeadingZeros(event.target.value) })}
        /* Enter 는 임시 저장이 아니라 ② 판정으로 넘어가기다 — [확정]과 같은 조건(사용자 지시 2026-10-27 · 2026-10-28 · #197). */
        onKeyDown={(event) => {
          if (event.key !== 'Enter' || !isSequential) return;
          event.preventDefault();
          if (canConfirmQty) confirmQty();
        }}
      />
      {variant === 'card' && uomCode !== null && (
        <span className="iqc-inspection-qty-unit">{uomCode}</span>
      )}
    </div>
  );

  /* 합격 · 불합격 · 보류 · 총 검사 수량 카드 넷 — 모두 펼칠 때는 ① 구획에, 차례로 열 때는 수량 입력 창에 선다. */
  /*
   * 검사 수량 단계의 수량 줄(사용자 지시 2026-10-29 · #197) — 직접 넣는 합격 · 보류 칸, 그 옆에 읽기 전용 불량 합계(자동 합산).
   * 검사 대상 수량은 단계 제목 옆 기준값이다. 합계가 맞으면 더 말하지 않고, 맞지 않을 때만 「N EA 미입력 · 초과」를 붙인다.
   * 셀 수 없으면(수량이 아닌 값) 맞는 것처럼 보이지 않게 「수량 확인 필요」.
   */
  /*
   * 「전체 34 EA 중 34 EA 미입력」 — 총 검사 수량과 미입력(넘치면 초과) 수량(사용자 시안 2026-10-29 · #197). 미입력은 파랑,
   * 초과 · 셀 수 없음은 빨강, 다 맞으면(0 EA 미입력) 중립색. 총 검사 수량이 이 줄에만 있어 맞아도 남긴다.
   */
  const totalsStatus: { tone: 'neutral' | 'info' | 'error'; prefix: string | null; text: string } =
    totals.kind !== 'counted' || rejectedUncountable
      ? { tone: 'error', prefix: null, text: t.totalsUncountable }
      : totals.remaining < 0n
        ? {
            tone: 'error',
            prefix: t.totalsOf(inspectedText),
            text: t.overBy(withUom(formatMicro(-totals.remaining), uomCode)),
          }
        : {
            tone: totals.remaining > 0n ? 'info' : 'neutral',
            prefix: t.totalsOf(inspectedText),
            text: t.shortBy(withUom(formatMicro(totals.remaining), uomCode)),
          };
  /* 수량 줄 오른쪽 끝에 단계 단추([다음: 판정])를 세운다(사용자 시안 2026-10-29). */
  const progressCards = (trailing: ReactNode): ReactNode => (
    <div className="iqc-inspection-qty-line">
      {/* 합격 · 보류(직접 입력) · 불량(자동 계산) 두 묶음(사용자 시안 2026-10-29 · #197). */}
      <div className="iqc-inspection-qty-group" data-group="manual">
        <div className="iqc-inspection-qty-group-fields">
          {field('accepted', t.fields.accepted, errors.accepted, 'input')}
          {field('held', t.fields.held, errors.held, 'input')}
        </div>
      </div>
      <div className="iqc-inspection-qty-group" data-group="auto">
        <dl className="iqc-inspection-qty-computed" data-kind="rejected">
          <dt>{t.rejection.defectQty}</dt>
          <dd>
            <span className="iqc-inspection-qty-computed-value">
              {draft.rejected.trim() === '' ? '0' : draft.rejected}
            </span>
            {uomCode !== null && (
              <span className="iqc-inspection-qty-computed-unit">{uomCode}</span>
            )}
            {/* 「자동 계산」 라벨은 불량 수량 값 오른쪽(사용자 지시 2026-10-29). */}
            <span className="iqc-inspection-qty-group-head">
              <Icon name="calculate" size={14} aria-hidden />
              {t.autoSum}
            </span>
          </dd>
        </dl>
      </div>
      <p className="iqc-inspection-qty-status" data-tone={totalsStatus.tone} role="status">
        {totalsStatus.prefix !== null && (
          <span className="iqc-inspection-qty-status-total">{totalsStatus.prefix}</span>
        )}
        <strong>{totalsStatus.text}</strong>
      </p>
      <div className="iqc-inspection-qty-line-action">{trailing}</div>
    </div>
  );
  const qtyCards = (
    <div className="iqc-inspection-qty" data-over={isOver ? '' : undefined}>
      {field('accepted', t.fields.accepted, errors.accepted)}
      {field('rejected', t.fields.rejected, errors.rejected)}
      {field('held', t.fields.held, errors.held)}
      <dl className="iqc-inspection-qty-field iqc-inspection-qty-total">
        <dt>{t.fields.inspectedQty}</dt>
        <dd>
          <span className="iqc-inspection-qty-total-value">{inspectedText}</span>
          {deltaText !== null && <span className="iqc-inspection-qty-over">{deltaText}</span>}
        </dd>
      </dl>
    </div>
  );

  /*
   * 최종 판정 칸 — 상하 배치(넓은 상세)에서는 검사 수량 줄의 세 칸 옆에 선다(사용자 지시 2026-10-27 · #185).
   * 좌우 배치에서는 종전처럼 「판정」 구획 첫 칸이다.
   */
  const judgmentField = (
    <div
      className="field-cell iqc-inspection-judgment-field"
      data-judgment={judgment === '' ? undefined : judgment}
    >
      <FieldLabel htmlFor={judgmentId} label={t.judgment} required hint={judgmentHint} />
      <Select
        id={judgmentId}
        options={judgmentOptions}
        value={judgment}
        placeholder={t.judgmentPlaceholder}
        /* 필수 칸이 비어 있으면 빨간 테두리(사용자 지시 2026-10-26) — 고칠 수 없는 회차는 제외. */
        invalid={judgment === '' && !isConfirmed && !isInputLocked}
        disabled={isConfirmed || isInputLocked || judgmentOptions.length === 0}
        onChange={onJudgmentChange}
      />
      {judgmentOptions.length === 0 && <p className="field-note">{t.judgmentUnavailable}</p>}
      {/*
       * ⚠ 저장된 판정이 목록에서 사라졌다(사용 중지된 코드일 수 있다). 조용히 비우면
       * 사용자가 고르지 않았는데 고른 것이 지워진다 — 그 사실을 밝힌다.
       */}
      {!isKnownCode(judgmentOptions, judgment) && (
        <p className="field-note">{t.judgmentUnknown(judgment)}</p>
      )}
    </div>
  );

  /*
   * 펼친 단계의 입력 — 그 단계 머리 바로 아래에 선다(창을 띄우지 않는다 · 사용자 지시 2026-10-28 · #197). 칸 · 검증 · [확정]은
   * 종전 창의 것을 그대로 쓴다. ③ 4M 은 선택이라 [확정] 없이 아래 [임시 저장] · [판정 확정]으로 마친다.
   */
  /* 단계의 [확정] — ① 은 「다음: 판정」(저장이 아니라 판정 단계로 넘어간다 · 사용자 지시 2026-10-29 · #197). */
  const stepConfirm = (step: number): ReactNode => (
    <Button
      type="button"
      size="md"
      disabled={isInputLocked || (step === 1 ? !canConfirmQty : !judgmentDone)}
      aria-describedby={isInputLocked ? blockedNoteId : undefined}
      onClick={step === 1 ? confirmQty : confirmJudgment}
    >
      {step === 1 ? t.stepSummary.qtyDone : t.stepSummary.next}
    </Button>
  );
  const stepPanel = (step: number, title: string): ReactNode => (
    <section
      className="iqc-inspection-step-panel"
      data-step={step}
      aria-label={title}
      /*
       * 칸을 건드리면 그 단계에 머문다 — 적는 동안 단계가 다 채워져도 저절로 다음 단계로 넘어가지 않고 [확정]을 기다린다.
       * (저장된 진행이 더 뒤인데 앞 단계가 덜 채워져 돌아온 경우도 같다.)
       */
      onFocusCapture={() => {
        if (viewStep !== step) openStep(step);
      }}
    >
      {step === 1 &&
        (renderDefects === null ? (
          <div className="iqc-inspection-qty-body">{qtyCards}</div>
        ) : (
          <div className="iqc-inspection-step-qty-split">
            <div className="iqc-inspection-qty-body">{progressCards(stepConfirm(step))}</div>
            {renderDefects()}
          </div>
        ))}
      {step === 2 && (
        <div className="iqc-inspection-judgment-dialog">
          {/* 최종 판정 칸과 [확정]은 한 줄(사용자 지시 2026-10-29). */}
          <div className="iqc-inspection-step-judgment-row">
            {judgmentField}
            {stepConfirm(step)}
          </div>
          {hasJudgmentDetail && judgmentBelow}
          {hasJudgmentDetail && judgmentDetail}
        </div>
      )}
      {step === 3 && fourMSlot}
      {step === 1 && renderDefects === null && (
        <div className="iqc-inspection-step-panel-actions">{stepConfirm(step)}</div>
      )}
    </section>
  );

  /*
   * 상하 배치에서 확정된 회차는 할 일이 재검사뿐이라 그 줄(확정 라벨 · [재검사 회차 추가])을 입력 현황 줄 오른쪽 끝에
   * 둔다(사용자 지시 2026-10-27 · #185). 그 밖은 종전처럼 카드 아래 한 줄이다.
   */
  const actionInQty = inlineJudgment && isConfirmed;
  const lockedBadge = (
    <span className="iqc-inspection-head-badge iqc-inspection-locked-badge">
      <Icon name="lock" size={14} aria-hidden />
      {t.confirmed}
    </span>
  );
  const actionArea = (
    <>
      {/*
       * 저장 · 확정 줄 — 한 줄에 왼쪽 부분 입고, 가운데 지금 상황의 안내(막힌 까닭 · 확정 경고 · 저장 결과), 오른쪽 끝에
       * [임시 저장](보조) [판정 확정](주). 안내는 그 상황에서만 서고, 단추 자리는 판정 칸이 늘어도 그대로다(#133).
       * ⛔ 확정된 회차에서 유일하게 할 수 있는 일이 재검사다 — 저장 자리·부분 입고를 두지 않는다(G-23).
       */}
      <div className="iqc-inspection-action-area">
        {isConfirmed && reinspectReplacement !== null ? (
          reinspectReplacement
        ) : isConfirmed && reinspectBlockedReason !== null ? (
          <div className="iqc-inspection-action-row">
            <div className="iqc-inspection-action-notes">
              <p className="iqc-inspection-action-note" data-tone="info">
                <Icon name="info" size={14} aria-hidden />
                {reinspectBlockedReason}
              </p>
            </div>
          </div>
        ) : isConfirmed ? (
          <div className="iqc-inspection-action-row">
            <div className="iqc-inspection-action-buttons">
              {/*
               * 잠근 이유는 [재검사 회차 추가] 바로 왼쪽 라벨로 한 번만 밝힌다(사용자 지시 2026-10-27 · #185).
               * 상하 배치에서는 수량 구획이 이 문구 길이만큼 넓어지지 않게 회차 옆(제목 줄)으로 간다.
               */}
              {!actionInQty && lockedBadge}
              <Button
                type="button"
                variant="outlined"
                size="md"
                leadingIcon={<Icon name="add" size={18} aria-hidden />}
                onClick={onStartReinspection}
              >
                {t.reinspect}
              </Button>
            </div>
          </div>
        ) : (
          <div className="iqc-inspection-action-row">
            {/*
             * 부분 입고 허용 — ⚠ **자리를 두되 비활성으로 시작한다**(스펙 §8 #2). 「업데이트 예정」 안내는 늘 같은 말이라
             * 화면에 세우지 않고 단추의 설명(마우스를 올리면 보이는 글 · 화면 읽기)으로 둔다.
             */}
            <Button
              type="button"
              variant="outlined"
              size="md"
              disabled
              title={t.partialReceiptPending}
              aria-describedby={partialNoteId}
            >
              {t.partialReceipt}
            </Button>
            <span id={partialNoteId} className="iqc-inspection-visually-hidden">
              {t.partialReceiptPending}
            </span>

            <div className="iqc-inspection-action-notes">
              {showErrors && hasQuantityError(errors) && (
                <p className="field-note">{t.saveBlockedByInvalid}</p>
              )}
              {/* 막혔으면 «무엇이» 막혔는지 단추 바로 왼쪽 한 줄로 밝힌다(공유계약 G-23 · 띠 대신 글줄 #133). */}
              {confirmBlockedReason !== null && (
                <p
                  id={blockedNoteId}
                  className="iqc-inspection-action-note"
                  data-tone="info"
                  /* 줄이 좁아 말줄임이 되면 마우스를 올려 전체 글을 본다(#197). */
                  title={confirmBlockedReason}
                >
                  <Icon name="info" size={14} aria-hidden />
                  <span className="iqc-inspection-action-note-text">{confirmBlockedReason}</span>
                </p>
              )}
              {onConnectWorker !== null && (
                <Button type="button" variant="outlined" size="md" onClick={onConnectWorker}>
                  {messages.usersRoles.workerLink.connect}
                </Button>
              )}
              {/*
               * ⛔ **확정은 되돌릴 수 없다** — 누르기 전에 그 사실을 경고색 글줄로 알린다. 이 순간 LOT 상태가 전이하고
               * 보류 해제가 기록된다. 막힌 동안에는 막힌 까닭 하나만 보인다 — 둘이면 무엇을 할지 흐려진다.
               */}
              {confirmBlockedReason === null && (
                <p className="iqc-inspection-action-note" data-tone="warning" title={t.confirmNote}>
                  <Icon name="warning" size={14} aria-hidden />
                  <span className="iqc-inspection-action-note-text">{t.confirmNote}</span>
                </p>
              )}
            </div>

            <div className="iqc-inspection-action-buttons">
              {/* 그만두는 길을 함께 둔다 — 열고 나서 되돌아갈 데가 없으면 갇힌다. */}
              {isReinspecting && (
                <Button
                  type="button"
                  variant="outlined"
                  size="md"
                  disabled={isSaving || isConfirming}
                  onClick={onCancelReinspection}
                >
                  {t.reinspectCancel}
                </Button>
              )}
              {/* 바뀐 것이 없으면 끈다 — 입력하면 켜지고 저장 뒤 다시 꺼진다. */}
              <Button
                type="submit"
                variant="outlined"
                size="md"
                disabled={!hasChanges || isSaving || isConfirming || saveBlockedReason !== null}
              >
                {isSaving ? t.saving : t.save}
              </Button>
              <Button
                type="button"
                variant="filled"
                size="md"
                disabled={confirmBlockedReason !== null || isSaving || isConfirming}
                onClick={onConfirm}
              >
                {isConfirming ? t.confirming : t.confirm}
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );

  return (
    <form aria-label={t.heading} onSubmit={submit}>
      {/*
       * 위에서 아래로 한 줄기 — 검사 수량 → 판정 → 4M 변경 정보, 그 아래 저장·확정(omf-all-around#133).
       * 판정 칸이 늘어도 수량 칸 옆에 빈 자리가 생기지 않는다. 저장·확정은 화면 아래에 붙이지 않는다(#185).
       */}
      <div className="iqc-inspection-work">
        {/*
         * 상하 배치는 한 줄을 반으로 — 왼쪽 검사 수량 입력, 오른쪽 「판정」(최종 판정)(사용자 지시 2026-10-27 · #185).
         * 좌우 배치는 종전처럼 수량 구획 하나다.
         */}
        <div
          className={inlineJudgment ? 'iqc-inspection-qty-judgment-row' : 'iqc-inspection-qty-only'}
          /* 단계를 차례로 열 때는 위아래로 쌓는다 — 접힌 단계 요약 줄 아래에 지금 단계가 선다(#197). */
          data-sequential={isSequential ? '' : undefined}
          /* 확정된 회차 — 판정 상자는 제 높이만(단추 자리를 잡지 않는다 · 사용자 지시 2026-10-27 · #185). */
          data-locked={isConfirmed ? '' : undefined}
          /* 재검사 중 — 안내 한 줄, 수량 카드 넷을 한 줄로(사용자 지시 2026-10-27 · #185). */
          data-reinspect={isReinspecting ? '' : undefined}
        >
          {stepper()}
          {/* ── 검사 결과 수량 — 검사수량을 합격·불합격·보류로 나눈 결과와 그 입력 현황 ── */}
          {!isSequential && (
            <section className="iqc-inspection-section" data-step="1" data-step-view={stepView(1)}>
              <div className="iqc-inspection-static">
                {!isSequential && (
                  <StepHead
                    step={1}
                    title={t.sectionTitle}
                    done={qtyDone}
                    current={currentStep === 1}
                  >
                    {roundBadges}
                    {actionInQty && lockedBadge}
                  </StepHead>
                )}
                {stepView(1) === 'open' && (
                  <div className="iqc-inspection-collapsible-body iqc-inspection-qty-body">
                    {/*
                     * ⭐ **저장해야 회차가 생긴다.** 「검사 시작」 액션을 두지 않고 첫 임시 저장을 검사
                     * 시작으로 삼은 규율과 같다(omf-mes 확정 2026-08-21 §1.2) — 열어 두고 떠난 사람이
                     * 빈 회차를 남기지 않는다.
                     *
                     * 재검사 사유 칸은 두지 않는다 — 계약이 선택으로 받지만 고를 값 목록이 정해지지 않았다(omf-mes#179).
                     * 「추후 제공」 안내 줄은 사용자 지시(2026-10-27 · #185)로 뺐다.
                     */}

                    {/*
                     * 합격 · 불합격 · 보류 · 총 검사 수량을 같은 모양 카드 넷으로(사용자 지시 2026-10-27 · #185). 다 맞으면 1단계
                     * 번호가 강조색이 된다. 넘치면 총 검사 수량 카드에 「+N EA」가 붙는다.
                     */}
                    {qtyCards}
                    {actionInQty && <div className="iqc-inspection-qty-actions">{actionArea}</div>}
                  </div>
                )}
              </div>
            </section>
          )}
          {inlineJudgment && stepView(2) !== 'hidden' && (
            <section
              className="iqc-inspection-section iqc-inspection-inline-judgment"
              data-step="2"
              data-step-view={stepView(2)}
            >
              <div className="iqc-inspection-static">
                {!isSequential && (
                  <StepHead
                    step={2}
                    title={t.judgmentSectionTitle}
                    done={judgmentDone}
                    current={currentStep === 2}
                  />
                )}
                {stepView(2) === 'open' && (
                  <div className="iqc-inspection-collapsible-body iqc-inspection-step-box">
                    <div className="iqc-inspection-judgment-inline-row">
                      {judgmentField}
                      {/* 판정 상세(불합격 사유 · 판정 변경 사유)는 [상세 입력] 창에서 적는다 — 적을 것이 있을 때만 선다(#185). */}
                      {hasJudgmentDetail && (
                        <div className="iqc-inspection-judgment-detail-cell">
                          <div className="iqc-inspection-judgment-detail-action">
                            <Button
                              type="button"
                              variant="outlined"
                              size="md"
                              onClick={() => {
                                onJudgmentDetailOpen?.();
                                setIsDetailOpen(true);
                              }}
                            >
                              {t.judgmentDetailOpen}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}
          {/* 4M 변경 정보 — 판정 오른쪽에 제 제목으로 따로 선다. 체크 · [비고 입력](사용자 지시 2026-10-27 · #185). 안내는 마우스를 올리면 보인다. */}
          {inlineJudgment && fourMSlot !== null && stepView(3) !== 'hidden' && (
            <section
              className="iqc-inspection-section iqc-inspection-inline-four-m"
              data-step="3"
              data-step-view={stepView(3)}
            >
              <div className="iqc-inspection-static">
                {!isSequential && (
                  <StepHead
                    step={3}
                    title={t.fourMChange.sectionTitle}
                    hint={t.fourMChange.hint}
                    done={fourMDone}
                    current={currentStep === 3}
                  />
                )}
                {stepView(3) === 'open' && (
                  <div className="iqc-inspection-collapsible-body iqc-inspection-step-box">
                    {fourMSlot}
                  </div>
                )}
              </div>
            </section>
          )}
        </div>

        {/*
         * ── 판정 — 종합 판정을 고르고, 임시 저장 뒤 확정한다 ──
         * 상하 배치에서는 최종 판정이 수량 줄로 올라가고, 이 구획은 「판정 상세 입력」으로 불합격 · 판정 변경 사유가 있을 때만 선다(#185).
         */}
        {/*
         * 판정 상세 입력 창 — 수량 줄 판정일 때(#185). [완료]는 적은 값을 남기고, [취소] · Esc 는 열 때 값으로
         * 되돌린다(사용자 지시 2026-10-27 · #185).
         */}
        {inlineJudgment && hasJudgmentDetail && !isSequential && (
          <Dialog
            open={isDetailOpen}
            onClose={() => {
              onJudgmentDetailCancel?.();
              setIsDetailOpen(false);
            }}
            size="lg"
            title={t.judgmentDetailTitle}
            showCloseButton={false}
            footer={
              <>
                <Button
                  type="button"
                  variant="outlined"
                  size="md"
                  onClick={() => {
                    onJudgmentDetailCancel?.();
                    setIsDetailOpen(false);
                  }}
                >
                  {t.judgmentDetailCancel}
                </Button>
                <Button type="button" size="md" onClick={() => setIsDetailOpen(false)}>
                  {t.judgmentDetailDone}
                </Button>
              </>
            }
          >
            <div className="iqc-inspection-judgment-dialog">
              {judgmentBelow}
              {judgmentDetail}
            </div>
          </Dialog>
        )}

        {!inlineJudgment && (
          <section
            className="iqc-inspection-section iqc-inspection-judgment-section"
            data-inline={inlineJudgment ? '' : undefined}
          >
            <div className="iqc-inspection-static">
              <div className="iqc-inspection-section-head">
                <h3>{inlineJudgment ? t.judgmentDetailTitle : t.judgmentSectionTitle}</h3>
              </div>
              <div className="iqc-inspection-collapsible-body">
                {/*
                 * 종합 판정 — ⛔ **값 목록을 화면에 고정하지 않는다.** 공통코드 조회로 채우고,
                 * 목록이 비어도 **감추지 않고 사유를 밝힌다**(공유계약 G-2). 시드가 아직 안 들어가
                 * 빌 수 있는데, 감추면 그 자리가 왜 없는지 사용자가 알 수 없다.
                 */}
                {/* 고른 판정을 테두리 색으로 바로 알아보게 한다(합격·불합격·보류 — app.css `[data-judgment]`). */}
                <div className="iqc-inspection-judgment-main">
                  {!inlineJudgment && judgmentField}
                  {/* 판정 변경 사유는 최종 판정 바로 아래 — 무엇을 왜 바꿨는지 한 자리에서 읽힌다(#133). */}
                  {judgmentBelow}
                </div>
                {/* 판정에 따라 열리는 칸(불합격 사유) — 구르지 않고 제 높이대로 선다(#133). */}
                <div className="iqc-inspection-judgment-detail">{judgmentDetail}</div>
              </div>
            </div>
          </section>
        )}

        <SaveErrorBanner error={saveError ?? confirmError} onReload={onReload} />

        {/*
         * ⛔ **되돌릴 수 없는 쓰기가 끝난 것을 말한다.** 확정 여부와 무관하게 쓰기가 성공한
         * «그 순간» 낸다 — 확정 상태는 회차를 다시 부른 «뒤에» 참이 된다.
         */}
        {isJustConfirmed && <p className="field-note">{t.confirmSucceeded}</p>}

        {/* ── 4M 변경 정보 — 수량 줄 판정이 아닐 때만 판정 아래 따로 선다(#133). 접지 않는다(사용자 지시 2026-10-27 · #185) ── */}
        {fourMSlot !== null && !inlineJudgment && (
          <section className="iqc-inspection-section iqc-inspection-four-m-block">
            <div className="iqc-inspection-static">
              <div className="iqc-inspection-section-head">
                <h3>
                  {t.fourMChange.sectionTitle}
                  <span className="iqc-inspection-label-hint">{t.fourMChange.hint}</span>
                </h3>
              </div>
              <div className="iqc-inspection-collapsible-body">{fourMSlot}</div>
            </div>
          </section>
        )}
      </div>

      {!actionInQty && actionArea}
    </form>
  );
};
