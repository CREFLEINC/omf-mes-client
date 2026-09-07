import { Button, EmptyState, TextField } from '@crefle/web-ui';
import { NumericKeypad } from '@omf-mes/ui';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import { MAX_ISSUE_QUANTITY, type SerialNumber } from './types';
import type { QuantityRejection } from './issue-quantity';
import { POP_TOUCH_SIZE } from './touch-spec';

const t = messages.identificationTagIssue;

/** 상한이 4자리라 그 위는 오타다. 키패드가 그 위를 무시한다. */
const QUANTITY_MAX_LENGTH = String(MAX_ISSUE_QUANTITY).length;

const rejectionMessage = (reason: QuantityRejection): string => t.quantity[reason];

/** 서버가 매긴 번호의 범위. **발행 «전»에는 그리지 않는다** — 지어낸 번호를 미리 보이지 않는다. */
const previewRange = (serials: readonly SerialNumber[]): string | null => {
  if (serials.length === 0) return null;

  const first = serials[0];
  const last = serials[serials.length - 1];

  if (first === undefined || last === undefined) return null;

  return first.serialNo === last.serialNo
    ? first.serialNo
    : `${first.serialNo}${t.preview.rangeSeparator}${last.serialNo}`;
};

const figure = (value: number | null, unit: string): string =>
  value === null ? t.issue.unknownValue : `${String(value)} ${unit}`;

export interface IssuePaneProps {
  lotNo: string | null;
  goodQty: number | null;
  issuedCount: number | null;
  unissued: number | null;
  quantity: string;
  onQuantityChange: (next: string) => void;
  /** 입력이 막힌 사유. 통과했으면 `null` */
  rejection: QuantityRejection | null;
  /**
   * 서버가 수량 칸에 붙여 준 오류. 없으면 `null`.
   *
   * ⭐ **화면의 판정보다 앞선다** — 화면이 통과시킨 값을 서버가 거부했다는 뜻이고, 그 사유는
   * 화면이 알 수 없는 것(그 사이에 다른 단말이 발번했다 등)이다.
   */
  serverQuantityError: string | null;
  /** 발행이 열리지 않는 사유(게이팅·사번 등). 열려 있으면 `null` */
  blockedReason: string | null;
  issuedSerials: readonly SerialNumber[];
  isSubmitting: boolean;
  onSubmit: () => void;
  onReissue: () => void;
}

/**
 * 우단 《발행》.
 *
 * ⭐ **수량 입력이 두 갈래다** — 키패드(장갑 낀 손)와 입력칸(손 입력·화면 판독기). 같은 값을
 * 가리키므로 상태는 하나이고, 어느 쪽으로 고쳐도 같은 자리에 들어간다.
 *
 * ⚠ **입력류의 최대 크기는 `xl`(60px)이다** — 버튼과 달리 `2xl` 이 없다(통지 개정).
 */
export const IssuePane = ({
  lotNo,
  goodQty,
  issuedCount,
  unissued,
  quantity,
  onQuantityChange,
  rejection,
  serverQuantityError,
  blockedReason,
  issuedSerials,
  isSubmitting,
  onSubmit,
  onReissue,
}: IssuePaneProps) => {
  const quantityId = useId();
  const preview = previewRange(issuedSerials);

  /*
   * 고른 LOT 이 없을 때 — **빈 상태로 세운다.** 맨 문단 하나로 두면 구획이 통째로 비어 보여
   * 「아직 아무것도 없다」인지 「못 불러왔다」인지 구분되지 않는다(다른 POP 화면이 같은 자리에
   * `EmptyState` 를 쓴다). 문구는 그대로 — 무엇을 하면 되는지를 말하는 문장이다.
   */
  if (lotNo === null) return <EmptyState size="sm" title={t.issue.notSelected} />;

  /* 양품이 아예 없으면 수량 사유보다 이것이 먼저다 — 고칠 것이 입력칸에 없다. */
  const noGoodQty = goodQty === 0;
  const inlineError = noGoodQty
    ? t.quantity.noGoodQty
    : (serverQuantityError ??
      (rejection === null || rejection === 'empty' ? undefined : rejectionMessage(rejection)));

  const canSubmit = !isSubmitting && blockedReason === null && rejection === null && !noGoodQty;

  return (
    <div className="pop-issue-layout">
      <div className="pop-issue-main">
        <dl className="pop-figures">
          <div>
            <dt>{t.issue.lotLabel}</dt>
            <dd>{lotNo}</dd>
          </div>
          <div>
            <dt>{t.issue.goodQtyLabel}</dt>
            <dd>{figure(goodQty, t.issue.countUnit)}</dd>
          </div>
          <div>
            <dt>{t.issue.issuedLabel}</dt>
            <dd>{figure(issuedCount, t.issue.countUnit)}</dd>
          </div>
          <div>
            <dt>{t.issue.unissuedLabel}</dt>
            <dd>{figure(unissued, t.issue.countUnit)}</dd>
          </div>

          {/*
           * 구분선 — 설계 §3 도면이 그은 선이다. 위는 «지금 사실»이고 아래는 «저장하면 그렇게
           * 된다»라, 선 하나가 그 경계를 말한다. 선례는 공구 사용 화면(`pop-figures-rule`).
           */}
          <div className="pop-figures-rule" />
        </dl>

        <div className="pop-issue-input">
          <TextField
            id={quantityId}
            label={`${t.issue.quantityLabel} (${t.issue.quantityUnit})`}
            size="xl"
            inputMode="numeric"
            fullWidth
            value={quantity}
            error={inlineError}
            onChange={(event) => {
              onQuantityChange(event.target.value);
            }}
          />
        </div>

      </div>

      {/*
        ⭐ **키패드를 옆에 세운다.** 아래로 쌓으면 1024×768 단말에서 «발행·인쇄»가 접힌 아래로
        내려간다 — 스펙 §3 이 세로 여유를 119px 로 못박은 화면이고, 주 액션이 스크롤 밖에 있는
        것은 현장에서 없는 것과 같다(실측: 쌓았을 때 구획 높이가 830px 였다).
      */}
      {/*
       * ⭐ **POP 이 공유하는 키패드를 쓴다**(공유계약 D-4 · `@omf-mes/ui`). 한때 DS `NumberPad`
       * 였는데, 그쪽은 «전체 잠금»만 있어 키마다 조건을 걸 수 없다 — 입력이 비었는데도
       * [ C ]·[ ← ]가 눌렸다. 사번 화면(`P-CO-01`)과 **같은 부품을 써야 같게 동작한다.**
       *
       * ⚠ 상한(`max`)은 이 부품에 새로 더한 값이다 — 자릿수(`maxLength`)만으로는 `9999` 를
       *    막지 못한다.
       */}
      <NumericKeypad
        className="pop-issue-keypad"
        value={quantity}
        onChange={onQuantityChange}
        maxLength={QUANTITY_MAX_LENGTH}
        max={MAX_ISSUE_QUANTITY}
        keySize={POP_TOUCH_SIZE}
        label={t.keypad.label}
        /*
         * ⚠ **모양은 이 화면이 쓰던 그대로다** — [ C ] · [ 0 ] · [ ⌫ ]. 부품을 바꾼 것은
         *   «동작»(입력이 비면 두 키가 잠긴다) 때문이지 모양 때문이 아니다.
         *   읽는 기계에는 글자 이름이 가고(`backspaceLabel`) 눈에는 기호가 보인다.
         */
        backspaceLabel={t.keypad.backspace}
        backspaceGlyph="⌫"
        clearLabel={t.keypad.clearGlyph}
      />

      {/*
       * ⭐ **미리보기와 조작은 아래 «전체 폭»으로 내린다.**
       *
       * 위쪽은 「무엇을 얼마나」를 정하는 자리(수치 · 발행 수량 · 키패드)이고, 아래는 그 결과와
       * 그것을 실행하는 자리다. 미리보기를 왼쪽 좁은 칸에 두면 일련번호 범위가 접혀 **한눈에
       * 읽히지 않고**(실측 — 마지막 줄이 잘렸다), 조작도 키패드 옆에 눌려 작게 선다.
       *
       * 가로 한 줄을 통째로 쓰면 번호 범위가 한 줄로 서고 조작이 오른쪽 끝에 온전히 선다.
       */}
      <div className="pop-issue-foot">
        {/*
         * ⛔ **발행 «전»에는 아무것도 그리지 않는다.** 설계 §3 도면이 이 자리에 그린 것은
         * 번호 «범위» 하나이고, 범위가 없는 상태를 무엇으로 채우라는 지시는 없다. 한때
         * 「일련번호는 발행할 때 서버가 매깁니다」를 우리가 지어 넣었는데, 설계가 정하지 않은
         * 자리를 화면이 스스로 메운 것이었다.
         *
         * 발행 전 이 자리를 무엇으로 둘지는 요청서로 확인을 올렸다.
         */}
        {preview !== null && (
          <p className="pop-preview">
            <span className="pop-preview-label">{t.preview.label}</span>
            <span>{preview}</span>
          </p>
        )}

        {blockedReason !== null && <p className="field-note">{blockedReason}</p>}

        <div className="pop-actions">
          <Button size={POP_TOUCH_SIZE} loading={isSubmitting} disabled={!canSubmit} onClick={onSubmit}>
            {t.issue.submit}
          </Button>
          {/*
           * ⭐ **기발행이 0 이면 누를 수 없다.** 재인쇄는 «이미 발행된 개체»의 회차를 올리는
           * 것이다(§5-5 — `issue_seq = 1` 최초 발행 · `issue_seq ≥ 2` 재인쇄). 발행된 개체가
           * 없으면 회차를 올릴 대상 자체가 없다.
           *
           * ⚠ **`can_print_label` 은 여기에 걸지 않았다.** §6 이 「비활성」이라고 적은 것은
           *    **발행**이고, 재인쇄까지 같은 규칙인지는 자료에 없다 — 「재인쇄도 인쇄다」는
           *    추론이라 설계 회신 전에는 넣지 않는다(요청서 G-4).
           */}
          <Button
            variant="outlined"
            size={POP_TOUCH_SIZE}
            disabled={issuedCount === 0}
            onClick={onReissue}
          >
            {t.issue.reissue}
          </Button>
        </div>
      </div>
    </div>
  );
};
