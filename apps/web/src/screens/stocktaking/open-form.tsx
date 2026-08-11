import { Checkbox, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import { codeNote, codePlaceholder } from './code-options';
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
 * **창에 넣지 않고 목록 아래 구획에 둔다**(계획 결정 15). 개시에는 선택칸이 둘 필요한데
 * 창 본문이 펼침 목록을 자르는 결함(#45 · DS `design-system-v2-webui#68`)이 아직 고쳐지지
 * 않았다 — 창에 넣으면 정면으로 걸린다. 확인은 값을 **고치는** 자리가 아니라 **다시 보는**
 * 자리이므로 그쪽에만 창을 둔다.
 *
 * **블라인드 토글이 여기에만 있다**(계획 결정 4 · 어긋남 9). 착수 이슈는 「개시 후에는 컨트롤을
 * 비활성으로」라 했으나 실사 헤더를 고치는 오퍼레이션이 계약에 아예 없다(실측) — 개시한 뒤에
 * 비활성 컨트롤을 두면 「언젠가 켜질 수 있는 것」으로 읽히므로 상세 구획에서는 읽기 전용
 * 표기로 낸다. 대신 **고르는 자리에서** 되돌릴 수 없다는 사실을 미리 밝힌다.
 *
 * **실사 유형을 `TextField`로 두지 않는다.** 자유 입력은 사용자가 지어낸 코드가 되돌릴 수 없는
 * 전표에 실리는 경로를 화면이 여는 것이다 — 값 목록이 채워지면 이 부품은 고칠 것 없이 살아난다.
 *
 * **필수 표시(*)를 붙이지 않는다.** 넷 중 셋이 필수라 표시가 거의 모든 칸에 붙어 뜻을 잃는다 —
 * 무엇이 모자라는지는 「실사 개시」 옆의 사유 한 줄이 **한 번에 하나씩** 가리킨다.
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
  const blindNoteId = `${useId()}-blind`;

  return (
    <>
      {/* 여기서 만드는 것이 **새 실사**이지 위에서 고른 실사를 고치는 것이 아님을 밝힌다. */}
      <p className="field-note">{t.notes.openLead}</p>

      <div className="form-grid">
        {/*
         * 칸 차례가 버튼 사유의 차례와 같다(`openBlockReason`) — 무엇을 세는가 → 어디를
         * 세는가 → 언제 세는가. 확인 창의 나열 차례도 같다. 세 자리가 갈리면 사용자가
         * 무엇을 확인했는지 맞춰 보기 어렵다.
         */}
        <SelectField
          label={t.fields.countType}
          options={countTypeOptions}
          value={draft.countType}
          note={codeNote(countTypeOptions)}
          error={fieldErrors[OPEN_FIELD_NAMES.countType]}
          placeholder={codePlaceholder()}
          disabled={isLocked}
          onChange={onChangeCountType}
        />

        {/*
         * 규범 3-2 — 선택칸이 「코드 · 이름」을 고른다. 최소 폭을 주지 않으면 선택지 목록이
         * 트리거 폭에 갇혀 잘리고, 무엇을 고르는지 읽을 수 없다.
         */}
        <SelectField
          wide
          label={t.fields.warehouse}
          options={warehouseOptions}
          value={draft.warehouse}
          note={warehouseNote}
          error={fieldErrors[OPEN_FIELD_NAMES.warehouse]}
          disabled={isLocked}
          onChange={onChangeWarehouse}
        />

        {/* 설치본에 `DatePicker`가 없다 — 네이티브 타입으로 대체한다(W-01-07이 세운 처리). */}
        <TextField
          type="date"
          label={t.fields.plannedDate}
          value={draft.plannedDate}
          error={fieldErrors[OPEN_FIELD_NAMES.plannedDate]}
          disabled={isLocked}
          onChange={(event) => {
            onChangePlannedDate(event.target.value);
          }}
        />

        {/* 확인칸은 라벨 층이 없다 — 규범 2의 `.field-cell-unlabeled`가 줄을 맞춘다. */}
        <div className="field-cell field-cell-unlabeled">
          <div className="check-group">
            <Checkbox
              checked={draft.blindCount}
              disabled={isLocked}
              aria-describedby={blindNoteId}
              onChange={(event) => {
                onChangeBlindCount(event.target.checked);
              }}
            >
              {t.fields.blindCount}
            </Checkbox>
          </div>
          {/*
           * 되돌릴 수 없다는 사실을 **고르는 자리에서** 밝힌다. 확인 창에도 값이 다시 나오지만,
           * 그때는 이미 정한 뒤라 여기서 읽지 못하면 무엇을 정하는 것인지 모르고 고른다.
           */}
          <span id={blindNoteId} className="field-note">
            {t.notes.blindOnlyAtOpen}
          </span>
        </div>
      </div>
    </>
  );
};
