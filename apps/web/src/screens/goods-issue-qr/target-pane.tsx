import { Card, Radio, RadioGroup } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState } from 'react';

import { lookupDisplayLabel, type LookupSource } from '../../patterns/lookup-display';
import { PopSelect as Select } from '../../patterns/pop-select';
import { ISSUE_UNIT, type HandlingUnit, type IssueUnit } from './types';

const t = messages.goodsIssueQr;

/**
 * 우단 — **무엇을 어떤 회차로 찍는가.**
 *
 * ⛔ **회차를 화면이 세지 않는다**(스펙 §5-5). 서버가 매기므로 발행 전에는 「발행하면 매깁니다」
 * 라고 말하고, 발행 뒤에는 서버가 돌려준 값을 그대로 보인다. 화면이 `+1` 을 하면 두 단말이
 * 동시에 찍을 때 둘 다 같은 회차를 말하게 된다.
 *
 * ⚠ **재발행 사유는 세 경우에 선다** — 고른 라인 중 이미 발행된 것이 있을 때(필수), 발행
 * 현황을 확인하지 못한 라인이 섞였을 때(선택), 서버가 이 칸을 짚어 거부했을 때(선택).
 *
 * ⚠ **파렛트 단위의 대상 목록은 고른 라인의 LOT 으로 좁혀진다**(스펙 §5-2 · 2026-09-06 회신).
 * 창고 전체를 세우지 않는다 — 이 출고와 상관없는 파렛트가 목록에 서면 잘못 고른 것이 그대로
 * 이력에 남는다. 라인이 하나로 정해지기 전에는 목록 자리에 그 사유를 적는다.
 */
/** 한 파렛트 안에서 같은 단위끼리 합친 수량. */
export interface PalletQuantity {
  uomId: number;
  qty: number;
}

export interface TargetPaneProps {
  selectedCount: number;
  unit: IssueUnit;
  onUnitChange: (unit: IssueUnit) => void;
  /** 파렛트 대상 후보. 고른 라인이 하나로 정해졌을 때만 채워진다. */
  pallets: readonly HandlingUnit[];
  palletsPending: boolean;
  palletsFailed: boolean;
  /** 배포본에서 서버에 LOT 축이 없어 목록 자체를 세울 수 없는 상태인가(#1095). */
  palletsUnavailable: boolean;
  /** 서버가 말한 총 건수가 받은 수보다 커서 목록이 잘렸는가. */
  palletsTruncated: boolean;
  /** 서버가 말한 총 건수. 잘렸을 때 「N건 중 M건」으로 말한다. */
  palletTotal: number;
  /** 파렛트를 고를 수 있는 상태인가 — 라인이 정확히 하나 골라졌는가다. */
  palletSelectable: boolean;
  palletId: number | null;
  onPalletChange: (handlingUnitId: number) => void;
  /**
   * 고른 파렛트에 담긴 줄 수와 **단위별** 수량. 아직 모르면 `null`.
   *
   * ⚠ **단위를 섞어 하나로 더하지 않는다** — 한 취급 단위가 서로 다른 단위의 LOT 을 담을 수
   * 있고(계약 `HandlingUnitContent.uomId`), 더해 버리면 화면이 없는 수를 말하게 된다.
   */
  palletContents: { lineCount: number; quantities: readonly PalletQuantity[] } | null;
  /** 단위 이름 — 수량 옆에 붙는다(설계 §3 도면 「3라인 · 820 EA」). */
  uomNames: LookupSource;
  /** 발행 뒤 서버가 매긴 회차. 아직 발행 전이면 `null`. */
  issuedSeq: number | null;
  /** 사유 칸을 세우는가 — 재발행이거나, 현황을 모르거나, 서버가 사유를 물은 경우다. */
  showReason: boolean;
  /** 사유가 **필수**인가. 현황을 모를 때는 자리만 열고 요구하지 않는다. */
  needsReason: boolean;
  /** 고른 라인 중 발행 현황을 확인하지 못한 것이 있는가. 안내 문구가 이 값으로 갈린다. */
  hasUnknownStatus: boolean;
  /** 서버가 사유 칸을 짚어 거부한 말. 없으면 `null`. */
  reasonServerError: string | null;
  reasonCode: string;
  onReasonChange: (value: string) => void;
  reasonOptions: LookupSource;
  /** 미리보기 이미지 주소. 발행 전에는 `null`. */
  previewSrc: string | null;
}

export const TargetPane = ({
  selectedCount,
  unit,
  onUnitChange,
  pallets,
  palletsPending,
  palletsFailed,
  palletsUnavailable,
  palletsTruncated,
  palletTotal,
  palletSelectable,
  palletId,
  onPalletChange,
  palletContents,
  uomNames,
  issuedSeq,
  showReason,
  needsReason,
  hasUnknownStatus,
  reasonServerError,
  reasonCode,
  onReasonChange,
  reasonOptions,
  previewSrc,
}: TargetPaneProps) => {
  const unitLabelId = useId();
  const palletLabelId = useId();
  const reasonLabelId = useId();

  /*
   * 미리보기는 `<img>` 가 직접 받아 온다(주소만 만들어 준다). 그래서 실패도 브라우저가 알려
   * 주는 자리에서 받는다 — 받지 않으면 **깨진 그림 아이콘만 남고** 화면은 아무 말도 못 한다.
   */
  const [previewFailed, setPreviewFailed] = useState(false);

  useEffect(() => {
    setPreviewFailed(false);
  }, [previewSrc]);

  /*
   * 「820 EA」의 단위까지가 한 벌이다(설계 §3 도면). 단위가 섞이면 갈라 적는다 —
   * 서로 다른 단위를 하나로 더하면 화면이 없는 수를 말한다.
   */
  const quantityText =
    palletContents === null || palletContents.quantities.length === 0
      ? '0'
      : palletContents.quantities
          .map((entry) => `${String(entry.qty)} ${lookupDisplayLabel(uomNames, entry.uomId)}`)
          .join(' · ');

  const reasonNote = reasonOptions.isError
    ? t.reissue.failed
    : reasonOptions.isLoading
      ? t.reissue.loading
      : reasonOptions.entries.length === 0
        ? t.reissue.empty
        : needsReason
          ? t.reissue.required
          : hasUnknownStatus
            ? t.reissue.unknownStatus
            : t.reissue.serverAsked;

  return (
    <Card bordered className="pop-section" aria-label={t.target.sectionLabel}>
      <Card.Body>
        <h2 className="pane-title">{t.target.sectionLabel}</h2>

        {/* 유형과 그 사유는 **한 줄**이다(사용자 지시 2026-09-07) — 사유가 아래로 내려가면 값과 멀어진다. */}
        <div className="pop-giqr-unit">
          <span id={unitLabelId}>{t.target.unitLabel}</span>
          {/*
           * ⭐ **항상 활성이다**(스펙 §5-6). 두 값 다 계약 `enum` 에 있고 대상 축도 섰다 —
           * 비활성 + 사유(G-2)를 적용할 자리가 아니다.
           */}
          <RadioGroup
            name="goods-issue-qr-unit"
            aria-labelledby={unitLabelId}
            value={unit}
            onChange={(value) => {
              onUnitChange(value as IssueUnit);
            }}
          >
            <Radio value={ISSUE_UNIT.line}>{t.target.unitLine}</Radio>
            <Radio value={ISSUE_UNIT.pallet}>{t.target.unitPallet}</Radio>
          </RadioGroup>
        </div>

        <p>{selectedCount === 0 ? t.target.none : t.target.selectedCount(selectedCount)}</p>

        {/*
         * 파렛트 대상 — **라인이 하나로 정해져야 목록이 선다**(스펙 §5-2). 여러 줄을 고른
         * 상태에서 목록을 세우면 어느 LOT 으로 좁힌 것인지 화면이 말할 수 없다.
         */}
        {unit === ISSUE_UNIT.pallet && (
          <div>
            <span id={palletLabelId}>{t.target.palletLabel}</span>
            <Select
              aria-labelledby={palletLabelId}
              size="xl"
              placeholder={t.target.palletPlaceholder}
              value={palletId === null ? null : String(palletId)}
              onChange={(value) => {
                onPalletChange(Number(value));
              }}
              disabled={!palletSelectable || pallets.length === 0}
              options={pallets.map((pallet) => ({
                value: String(pallet.handlingUnitId),
                label: pallet.handlingUnitNo,
              }))}
            />
            <p className="field-note">
              {palletsUnavailable
                ? t.target.palletUnavailable
                : !palletSelectable
                  ? t.target.palletNeedsOneLine
                  : palletsFailed
                    ? t.target.palletFailed
                    : palletsPending
                      ? t.target.palletLoading
                      : pallets.length === 0
                        ? t.target.palletEmpty
                        : palletContents === null
                          ? t.target.palletContentsUnknown
                          : t.target.palletContents(palletContents.lineCount, quantityText)}
            </p>
            {/*
             * 목록이 한 쪽에서 잘렸다는 사실은 **고르기 전에** 말한다 — 고른 뒤에 알려 봐야
             * 이미 잘못 고른 것이 발행돼 있다.
             */}
            {palletsTruncated && (
              <p className="field-note">{t.target.palletTruncated(pallets.length, palletTotal)}</p>
            )}
          </div>
        )}

        <p>{`${t.target.seqLabel} ${issuedSeq === null ? t.target.seqUnknown : String(issuedSeq)}`}</p>

        {/*
         * 재발행 사유 — **고른 라인 중 이미 발행된 것이 있을 때만 선다.** 최초 발행에 사유를
         * 물으면 사용자는 고를 이유가 없는 값을 고르게 되고, 그렇게 들어간 값은 통계를 흐린다.
         */}
        {showReason ? (
          <div>
            <span id={reasonLabelId}>{t.reissue.label}</span>
            <Select
              aria-labelledby={reasonLabelId}
              size="xl"
              placeholder={t.reissue.placeholder}
              value={reasonCode === '' ? null : reasonCode}
              onChange={onReasonChange}
              disabled={reasonOptions.entries.length === 0}
              options={reasonOptions.entries.map((entry) => ({
                value: entry.value,
                label: entry.label,
              }))}
            />
            <p className="field-note">{reasonNote}</p>
            {/*
             * ⛔ **서버가 짚은 말을 삼키지 않는다.** 이 칸의 거부는 공용 오류 배너에서 빠져
             * 나와 있어(필드 오류로 갈린다), 여기서 내지 않으면 **버튼만 멎고 화면은 아무 말도
             * 하지 않는다** — 되돌릴 수 없는 쓰기의 실패가 무응답으로 보인다.
             */}
            {reasonServerError !== null && (
              <p className="field-error" role="alert">
                {reasonServerError}
              </p>
            )}
          </div>
        ) : /*
         * ⛔ **사유가 필요 없다는 말을 굳이 내지 않는다**(사용자 지시 2026-09-07). 최초
         *    발행이 이 화면의 보통 상태라, 그때마다 한 줄을 더 읽히면 정작 필요한 자리
         *    (회차·미리보기)와 자리를 다툰다. 사유가 «필요할 때»만 칸이 선다.
         */
        null}

        {/*
         * 미리보기 — **상자를 늘 세우고 그 «안»이 바뀐다**(설계 §3 도면 · 사용자 지시
         * 2026-09-07). 발행 전에는 무엇이 들어올 자리인지 한 줄로 말하고, 발행하면 서버가
         * 그린 그림이 같은 상자에 들어온다.
         *
         * ⛔ 있을 때만 상자를 만들지 않는다 — 그러면 발행하는 순간 상자가 생기며 아래가
         *    밀리고, 발행 전에는 이 자리가 무엇인지 알 수 없다.
         */}
        <div className="pop-giqr-preview-row">
          <span>{t.target.previewLabel}</span>
          <div className="pop-giqr-preview">
            {previewSrc === null ? (
              <p className="field-note">{t.target.previewEmpty}</p>
            ) : previewFailed ? (
              <p className="field-note">{t.target.previewFailed}</p>
            ) : (
              <img
                className="pop-giqr-preview-image"
                src={previewSrc}
                alt={t.target.previewAlt}
                onError={() => {
                  setPreviewFailed(true);
                }}
              />
            )}
          </div>

          {/*
           * 「왜 전량인데도 찍나」에 답할 근거(스펙 §5-3 · G-5)를 **미리보기 옆에** 둔다
           * (사용자 지시 2026-09-07) — 발행하기 직전에 보는 자리다.
           */}
          <p className="field-note">{t.alwaysIssueNote}</p>
        </div>
      </Card.Body>
    </Card>
  );
};
