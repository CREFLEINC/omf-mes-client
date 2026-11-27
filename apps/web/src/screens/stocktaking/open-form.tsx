import { Checkbox, DatePicker } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import { codePlaceholder } from './code-options';
import { FieldLabel } from './field-label';
import type { OpenDraft } from './open-request';
import { SelectField } from './select-field';
import type { SelectOption } from './types';
import { OPEN_FIELD_NAMES } from './validation';

const t = messages.stocktaking;

export interface OpenFormProps {
  draft: OpenDraft;
  /** 창고 선택지. 화면이 이름으로 풀어 넘긴다 — 번호를 사용자가 칠 일이 없다. */
  warehouseOptions: SelectOption[];
  /** 실사 유형 선택지. **지금은 비어 있다**(승인 G1 · `code-options.ts`). */
  countTypeOptions: SelectOption[];
  /** 참조 선택지의 한계(잘림·실패) 안내. 밝히지 않으면 값이 사라진 것으로 읽힌다. */
  warehouseNote?: string;
  /** 화면이 잡은 오류와 서버가 준 필드 오류를 합친 것. 어느 쪽이든 같은 자리에 낸다. */
  fieldErrors: Record<string, string>;
  isLocked: boolean;
  onChangeCountType: (value: string) => void;
  onChangeWarehouse: (value: string) => void;
  onChangePlannedDate: (value: string) => void;
  onChangeBlindCount: (checked: boolean) => void;
}

/**
 * 개시 입력 — **사용자가 정하는 것은 이 넷뿐이다.**
 *
 * 실사 라인은 서버가 장부에서 만들고(계약 설명) 실사번호·상태는 서버가 붙인다 —
 * 화면이 대상을 열거하지 않는다. 그래서 이 폼에는 표도 목록도 없다.
 *
 * **「실사 개시」 등록 팝업 안에 선다**(사용자 지시 2026-11-27 · #360 — 조회 조건 줄 [조회] 오른쪽 [실사 개시]로 연다).
 * 팝업 틀 · 필수 * · 빈 필수 칸 바탕 · 「(선택)」은 앱 공통 팝업 규칙(app.css)이 입힌다.
 *
 * **블라인드 토글이 여기에만 있다**(계획 결정 4 · 어긋남 9). 착수 이슈는 「개시 후에는 컨트롤을
 * 비활성으로」라 했으나 실사 헤더를 고치는 오퍼레이션이 계약에 아예 없다(실측) — 개시한 뒤에
 * 비활성 컨트롤을 두면 「언젠가 켜질 수 있는 것」으로 읽히므로 상세 구획에서는 읽기 전용
 * 표기로 낸다.
 *
 * 폼 위 안내문, 블라인드 칸 아래 안내, 실사 유형의 「선택지 준비 중」 안내는 걷었다(사용자 지시
 * 2026-11-18). 되돌릴 수 없다는 사실은 개시 확인 창이 한 줄로 밝힌다.
 *
 * **실사 유형을 `TextField`로 두지 않는다.** 자유 입력은 사용자가 지어낸 코드가 되돌릴 수 없는
 * 전표에 실리는 경로를 화면이 여는 것이다 — 값 목록이 채워지면 이 부품은 고칠 것 없이 살아난다.
 *
 * 기존 디자인 시스템 컴포넌트의 조합이라 이 화면 슬라이스가 소유한다.
 */
export const OpenForm = ({
  draft,
  warehouseOptions,
  countTypeOptions,
  warehouseNote,
  fieldErrors,
  isLocked,
  onChangeCountType,
  onChangeWarehouse,
  onChangePlannedDate,
  onChangeBlindCount,
}: OpenFormProps) => {
  const plannedDateId = useId();
  const plannedDateErrorId = `${plannedDateId}-error`;
  const plannedDateError = fieldErrors[OPEN_FIELD_NAMES.plannedDate];

  return (
    <>
      <div className="form-grid">
        {/*
         * 칸 차례가 버튼 사유의 차례와 같다(`openBlockReason`) — 무엇을 세는가 → 어디를
         * 세는가 → 언제 세는가. 확인 창의 나열 차례도 같다. 세 자리가 갈리면 사용자가
         * 무엇을 확인했는지 맞춰 보기 어렵다.
         */}
        <SelectField
          required
          label={t.fields.countType}
          options={countTypeOptions}
          value={draft.countType}
          error={fieldErrors[OPEN_FIELD_NAMES.countType]}
          placeholder={codePlaceholder(t.fields.countType, countTypeOptions)}
          disabled={isLocked}
          onChange={onChangeCountType}
        />

        {/*
         * 규범 3-2 — 선택칸이 「코드 · 이름」을 고른다. 최소 폭을 주지 않으면 선택지 목록이
         * 트리거 폭에 갇혀 잘리고, 무엇을 고르는지 읽을 수 없다.
         */}
        <SelectField
          wide
          required
          label={t.fields.warehouse}
          options={warehouseOptions}
          value={draft.warehouse}
          note={warehouseNote}
          error={fieldErrors[OPEN_FIELD_NAMES.warehouse]}
          placeholder={messages.screenPatterns.referencePicker.select(t.fields.warehouse)}
          disabled={isLocked}
          onChange={onChangeWarehouse}
        />

        {/* 계획일은 앱 공용 날짜 칸(`DatePicker`) — 브라우저 기본 「연도. 월. 일.」 칸 대신(사용자 지시 2026-11-27 · #360). */}
        <div className="field-cell">
          <FieldLabel htmlFor={plannedDateId} label={t.fields.plannedDate} required />
          <DatePicker
            id={plannedDateId}
            mode="single"
            placeholder={messages.common.selectDate}
            value={draft.plannedDate === '' ? null : draft.plannedDate}
            disabled={isLocked}
            invalid={plannedDateError !== undefined}
            aria-required
            aria-describedby={plannedDateError === undefined ? undefined : plannedDateErrorId}
            onChange={onChangePlannedDate}
          />
          {plannedDateError !== undefined && (
            <span id={plannedDateErrorId} className="field-error">
              {plannedDateError}
            </span>
          )}
        </div>

        {/* 확인칸은 라벨 층이 없다 — 규범 2의 `.field-cell-unlabeled`가 줄을 맞춘다. */}
        <div className="field-cell field-cell-unlabeled">
          <div className="check-group">
            <Checkbox
              checked={draft.blindCount}
              disabled={isLocked}
              onChange={(event) => {
                onChangeBlindCount(event.target.checked);
              }}
            >
              {t.fields.blindCount}
            </Checkbox>
          </div>
        </div>
      </div>
    </>
  );
};
