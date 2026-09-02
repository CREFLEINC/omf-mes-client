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
 * ⚠ **파렛트 단위는 비활성이되 감추지 않는다**(G-2). 값 목록이 도착하기 전까지 고를 수 없다는
 * 사실과 그 사유를 함께 보인다 — 감추면 「없는 기능」으로 읽힌다.
 */
export interface TargetPaneProps {
  selectedCount: number;
  /** 발행 뒤 서버가 매긴 회차. 아직 발행 전이면 `null`. */
  issuedSeq: number | null;
  needsReason: boolean;
  reasonCode: string;
  onReasonChange: (value: string) => void;
  reasonOptions: LookupSource;
  /** 미리보기 이미지 주소. 발행 전에는 `null`. */
  previewSrc: string | null;
}

export const TargetPane = ({
  selectedCount,
  issuedSeq,
  needsReason,
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
        : t.reissue.required;

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
        {needsReason ? (
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

        <p className="field-note">{t.target.documentTypePending}</p>
      </Card.Body>
    </Card>
  );
};
