import { Button, NumberPad, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import { MAX_ISSUE_QUANTITY, type SerialNumber } from './types';
import type { QuantityRejection } from './issue-quantity';

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

  if (lotNo === null) return <p className="field-note">{t.issue.notSelected}</p>;

  /* 양품이 아예 없으면 수량 사유보다 이것이 먼저다 — 고칠 것이 입력칸에 없다. */
  const noGoodQty = goodQty === 0;
  const inlineError = noGoodQty
    ? t.quantity.noGoodQty
    : (serverQuantityError ??
      (rejection === null || rejection === 'empty' ? undefined : rejectionMessage(rejection)));

  const canSubmit = !isSubmitting && blockedReason === null && rejection === null && !noGoodQty;

  return (
    <>
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
      </dl>

      <div className="pop-issue-input">
        <TextField
          id={quantityId}
          label={`${t.issue.quantityLabel} (${t.issue.quantityUnit})`}
          size="xl"
          inputMode="numeric"
          value={quantity}
          error={inlineError}
          onChange={(event) => {
            onQuantityChange(event.target.value);
          }}
        />
        <NumberPad
          value={quantity}
          onChange={onQuantityChange}
          maxLength={QUANTITY_MAX_LENGTH}
          max={MAX_ISSUE_QUANTITY}
          size="xl"
          aria-label={t.issue.quantityLabel}
        />
      </div>

      <p className="pop-preview">
        <span className="pop-preview-label">{t.preview.label}</span>
        <span>{preview ?? t.preview.beforeIssue}</span>
      </p>

      {blockedReason !== null && <p className="field-note">{blockedReason}</p>}

      <div className="pop-actions">
        <Button size="2xl" loading={isSubmitting} disabled={!canSubmit} onClick={onSubmit}>
          {t.issue.submit}
        </Button>
        <Button variant="outlined" size="2xl" onClick={onReissue}>
          {t.issue.reissue}
        </Button>
      </div>
    </>
  );
};
