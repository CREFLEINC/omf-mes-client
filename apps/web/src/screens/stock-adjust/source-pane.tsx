import { Button, Radio, RadioGroup } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import { SelectField } from './select-field';
import type { AdjustSourceKind } from './source';
import type { SelectOption } from './types';

const t = messages.stockAdjust;

export interface SourcePaneProps {
  kind: AdjustSourceKind;
  onChangeKind: (kind: AdjustSourceKind) => void;
  /** 원천을 바꾸면 사라지는 줄 수. 0이면 잃을 것이 없어 안내를 내지 않는다 */
  discardCount: number;

  countOptions: SelectOption[];
  countNote?: string;
  countId: string;
  onChangeCount: (value: string) => void;
  /** 고른 실사의 창고 이름. 위치와 장부가 어느 창고의 것인지 밝힌다 */
  countWarehouseName: string;

  warehouseOptions: SelectOption[];
  warehouseNote?: string;
  warehouseId: string;
  onChangeWarehouse: (value: string) => void;

  /**
   * 창고 이름·선택지를 불러오지 못했는가.
   *
   * **두 갈래 모두에서 창고가 필요하다** — 직접 등록은 창고를 고르는 것으로 시작하고, 실사
   * 갈래도 고른 실사의 창고 이름을 여기서 보인다. 그래서 이 실패의 복구는 갈래 안이 아니라
   * **구획 바닥**에 선다.
   */
  hasWarehouseError: boolean;
  onRetryWarehouses: () => void;

  /**
   * 대상을 바꾸는 길이 잠겼는가(C26).
   *
   * **대상 전환도 잠금 안에 있다**(전례 `po-register`가 같은 자리에 둔 규율). 나가는 중에
   * 바뀌면 도착한 되먹임이 다른 맥락에 놓이고, **이미 등록한 뒤에 바뀌면 만들어진 전표를
   * 보이는 구획이 사라진다** — 사용자가 적어 둘 겨를도 없이 전표번호를 잃는다.
   *
   * **사유는 이 구획이 내지 않는다** — 세 컨트롤이 같은 잠금을 쓰고, 그 사정은 등록 조작
   * 자리에 한 번 선다. 「불러오기」만은 자기 사유를 따로 받는다(그 버튼은 잠기는 사정이 더 많다).
   */
  isLocked?: boolean;

  /** 「불러오기」가 막힌 사유. `null`이면 열려 있다 */
  loadBlockReason: string | null;
  onLoadVariance: () => void;
}

/**
 * 조정 원천 구획 — **라디오는 둘이고 자료의 출처는 셋이다**(조심 ⑤).
 *
 * 실사 차이 · 현장 실측 · 직접 등록 중 뒤의 둘은 실사를 거치지 않으므로 같은 갈래로 들어온다.
 * **그 갈래에서 실사 참조가 비어 있는 것이 정상이다** — 빈 자리에 경고 표식을 붙이면 사용자가
 * 무언가 잘못됐다고 읽고 실사를 찾아 헤맨다. 그래서 「—」와 **사실만 적은 안내**를 낸다.
 *
 * **창고를 고르는 자리가 직접 등록 갈래에 있다.** 계약이 위치 조회와 잔액 조회에 창고를 요구해
 * (위치는 필수 조건 · 잔액은 「창고·품목·LOT 중 하나」) 창고를 모르면 위치도 장부도 확인할 수
 * 없다. 실사 갈래에서는 고른 실사가 창고를 정하므로 이름만 보인다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const SourcePane = ({
  kind,
  onChangeKind,
  discardCount,
  countOptions,
  countNote,
  countId,
  onChangeCount,
  countWarehouseName,
  warehouseOptions,
  warehouseNote,
  warehouseId,
  onChangeWarehouse,
  hasWarehouseError,
  onRetryWarehouses,
  isLocked = false,
  loadBlockReason,
  onLoadVariance,
}: SourcePaneProps) => {
  const kindLabelId = useId();
  const loadReasonId = useId();

  return (
    <>
      <span id={kindLabelId} className="field-label">
        {t.source.kindLabel}
      </span>
      <RadioGroup
        name="stock-adjust-source"
        orientation="horizontal"
        value={kind}
        disabled={isLocked}
        aria-labelledby={kindLabelId}
        onChange={(value) => {
          onChangeKind(value === 'count' ? 'count' : 'direct');
        }}
      >
        <Radio value="count">{t.source.count}</Radio>
        <Radio value="direct">{t.source.direct}</Radio>
      </RadioGroup>

      {/*
       * **바꾸기 전에 무엇을 잃는지 읽힌다.** 누른 뒤에 알리면 이미 사라진 뒤다 —
       * 사라질 줄 수는 실제로 지우는 자리와 같은 판정(`applySourceChange`)에서 온다.
       */}
      {discardCount > 0 && <p className="field-note">{t.source.changeDiscardNote(discardCount)}</p>}

      {kind === 'count' ? (
        <>
          <SelectField
            label={t.source.countField}
            options={countOptions}
            value={countId}
            note={countNote}
            placeholder={t.source.countPlaceholder}
            disabled={isLocked}
            onChange={onChangeCount}
          />

          <div className="field-cell">
            <span className="field-label">{t.source.warehouseField}</span>
            <span>{countWarehouseName}</span>
          </div>

          {/*
           * 「불러오기」는 **대상을 다시 세우는 조작**이라 사용자가 명시해야 한다 —
           * 실사를 고르는 것만으로 부르면 고르는 도중에 스쳐 간 실사마다 요청이 나가고
           * 그 응답이 도착할 때마다 세운 대상이 다시 선다.
           */}
          <div className="field-cell">
            <Button
              variant="outlined"
              disabled={loadBlockReason !== null}
              aria-describedby={loadBlockReason === null ? undefined : loadReasonId}
              onClick={onLoadVariance}
            >
              {t.actions.loadVariance}
            </Button>
            {loadBlockReason !== null && (
              <span id={loadReasonId} className="field-note">
                {loadBlockReason}
              </span>
            )}
          </div>
        </>
      ) : (
        <>
          {/*
           * **비어 있는 것이 정상이다**(조심 ⑤). 경고 표식을 붙이지 않고 「—」와 사실만 적는다 —
           * 현장 실측과 직접 등록은 실사를 거치지 않는 정상 경로다.
           */}
          <div className="field-cell">
            <span className="field-label">{t.source.countRefLabel}</span>
            <span>{t.values.empty}</span>
            <span className="field-note">{t.source.directNote}</span>
          </div>

          <SelectField
            label={t.source.warehouseField}
            options={warehouseOptions}
            value={warehouseId}
            note={warehouseNote}
            placeholder={t.source.warehousePlaceholder}
            required
            disabled={isLocked}
            onChange={onChangeWarehouse}
          />
        </>
      )}

      {/*
       * **창고 실패의 복구는 갈래 밖에 선다**(리뷰 R-1).
       *
       * 창고만 실패하면 직접 등록 갈래는 고를 창고가 없어 「라인 추가」가 잠기고 줄이 0행이
       * 되는데, 복구 수단을 대상 구획 안쪽에 두면 그 빈 상태에 가려 **화면 전체에 「다시 시도」가
       * 한 개도 없는** 막다른 길이 된다. 이름이 실패로 보이는 자리가 여기이므로 복구도 여기다.
       *
       * **안내가 말하는 것과 복구가 되살리는 것이 같다** — 이 블록은 창고 하나를 말하고
       * 창고 하나를 되살린다.
       */}
      {hasWarehouseError && (
        <div className="field-cell">
          <span className="field-note">{t.reasons.warehousesFailed}</span>
          <Button variant="outlined" size="sm" onClick={onRetryWarehouses}>
            {messages.common.retry}
          </Button>
        </div>
      )}
    </>
  );
};
