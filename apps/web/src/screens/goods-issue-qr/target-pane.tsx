import { Card, Radio, RadioGroup, Select } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState } from 'react';

import type { LookupSource } from '../../patterns/lookup-display';
import { ISSUE_UNIT } from './types';

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
 * ⚠ **파렛트 단위는 비활성이되 감추지 않는다.** 대상 유형 값은 계약이 닫았으나 **이 전표에
 * 실린 파렛트를 찾는 조회가 없어** 고를 대상을 세울 수 없다 — 그 사실과 사유를 함께 보인다.
 * 감추면 「없는 기능」으로 읽힌다.
 */
export interface TargetPaneProps {
  selectedCount: number;
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
  const reasonLabelId = useId();

  /*
   * 미리보기는 `<img>` 가 직접 받아 온다(주소만 만들어 준다). 그래서 실패도 브라우저가 알려
   * 주는 자리에서 받는다 — 받지 않으면 **깨진 그림 아이콘만 남고** 화면은 아무 말도 못 한다.
   */
  const [previewFailed, setPreviewFailed] = useState(false);

  useEffect(() => {
    setPreviewFailed(false);
  }, [previewSrc]);

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

        <div>
          <span id={unitLabelId}>{t.target.unitLabel}</span>
          <RadioGroup
            name="goods-issue-qr-unit"
            aria-labelledby={unitLabelId}
            value={ISSUE_UNIT.line}
            onChange={() => {
              /* 라인 단위 하나뿐이라 바뀔 값이 없다 — 파렛트가 열릴 때 상태가 함께 선다. */
            }}
          >
            <Radio value={ISSUE_UNIT.line}>{t.target.unitLine}</Radio>
            <Radio value={ISSUE_UNIT.pallet} disabled>
              {t.target.unitPallet}
            </Radio>
          </RadioGroup>
          <p className="field-note">{t.target.unitPalletPending}</p>
        </div>

        <p>{selectedCount === 0 ? t.target.none : t.target.selectedCount(selectedCount)}</p>

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
        ) : (
          <p className="field-note">{t.reissue.notNeeded}</p>
        )}

        <div>
          <span>{t.target.previewLabel}</span>
          {previewSrc === null ? (
            <p className="field-note">{t.target.previewEmpty}</p>
          ) : previewFailed ? (
            <p className="field-note">{t.target.previewFailed}</p>
          ) : (
            <img
              src={previewSrc}
              alt={t.target.previewAlt}
              onError={() => {
                setPreviewFailed(true);
              }}
            />
          )}
        </div>
      </Card.Body>
    </Card>
  );
};
