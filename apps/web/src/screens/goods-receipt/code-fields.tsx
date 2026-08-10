import { messages } from '@omf-mes/i18n';

import { codeNote, codePlaceholder, type CodeOptionSets } from './code-options';
import { SelectField } from './select-field';
import type { CodeDraft, GoodsReceiptCodeKey } from './types';
import { CODE_FIELD_NAMES } from './validation';

const t = messages.goodsReceipt;

export interface CodeFieldsProps {
  options: CodeOptionSets;
  values: CodeDraft;
  /** 화면이 잡은 오류와 서버가 준 필드 오류를 합친 것. 어느 쪽이든 같은 자리에 낸다 */
  fieldErrors: Record<string, string>;
  isLocked: boolean;
  onChange: (key: GoodsReceiptCodeKey, value: string) => void;
}

interface CodeField {
  key: GoodsReceiptCodeKey;
  label: string;
}

/**
 * 차례가 요청의 차례를 따른다 — 머리(입고 유형·원천 문서 유형) → 라인(품질·재고) → 선택(사유).
 * 확인 창의 나열 차례도 같다. 두 자리가 갈리면 사용자가 무엇을 확인했는지 맞춰 보기 어렵다.
 */
const CODE_FIELDS: CodeField[] = [
  { key: 'receiptType', label: t.fields.receiptType },
  { key: 'sourceDocumentType', label: t.fields.sourceDocumentType },
  { key: 'qualityStatus', label: t.fields.qualityStatus },
  { key: 'inventoryStatus', label: t.fields.inventoryStatus },
  { key: 'reason', label: t.fields.reason },
];

/**
 * 코드 다섯 칸.
 *
 * **값 목록이 확정되지 않아 다섯이 다 비어 있다**(`code-options.ts`). 비어 있는 선택칸만 두면
 * 고장으로 읽히므로 왜 비었는지를 항상 보이는 문구로 밝히고 `aria-describedby`로 잇는다.
 *
 * **자리표시 값을 하나 넣어 두지 않는다.** 넣으면 사용자가 그것을 고를 수 있고, 고르면
 * 서버가 모르는 코드가 되돌릴 수 없는 전표에 실린다. 대신 「입고 처리」가 잠기고 그 사유를
 * 액션 줄이 밝힌다 — **값 목록이 채워지면 이 부품은 고칠 것 없이 그대로 살아난다.**
 *
 * **`TextField`로 두지 않는다.** 자유 입력은 사용자가 지어낸 코드가 전표에 실리는 경로를
 * 화면이 여는 것이고, 그것은 값을 지어내지 않는다는 이 저장소의 규칙과 같은 갈래의 위반이다.
 *
 * 기존 디자인 시스템 컴포넌트의 조합이라 이 화면 슬라이스가 소유한다.
 */
export const CodeFields = ({
  options,
  values,
  fieldErrors,
  isLocked,
  onChange,
}: CodeFieldsProps) => (
  <div className="form-grid">
    {CODE_FIELDS.map(({ key, label }) => {
      const codeOptions = options[key];

      return (
        <SelectField
          key={key}
          label={label}
          options={codeOptions}
          value={values[key]}
          note={codeNote(codeOptions)}
          error={fieldErrors[CODE_FIELD_NAMES[key]]}
          /* 고를 것이 없는 칸과 고를 수 있는 칸은 트리거 문구가 달라야 한다. */
          placeholder={codeOptions.length === 0 ? codePlaceholder() : t.values.selectPlaceholder}
          disabled={isLocked}
          onChange={(value) => {
            onChange(key, value);
          }}
        />
      );
    })}
  </div>
);
