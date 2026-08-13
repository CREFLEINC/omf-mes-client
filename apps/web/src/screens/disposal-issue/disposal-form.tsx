import { DatePicker, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import { codeNote, codePlaceholder, type CodeOptionSets } from './code-options';
import { FieldLabel } from './field-label';
import { SelectField } from './select-field';
import type { DisposalCodeKey, DisposalDraft } from './types';
import { CODE_FIELD_NAMES } from './validation';

const t = messages.disposalIssue;

export interface DisposalFormProps {
  values: DisposalDraft;
  /**
   * 값 목록이 확정되지 않은 코드 다섯. **화면이 넘긴다** — 자리표시 상수를 부품이 직접 읽으면
   * 「값이 확정되면 배열만 채운다」는 전환을 화면 수준에서 잴 수 없다(감지기 M53).
   */
  codeOptions: CodeOptionSets;
  /** 계약 필드 이름으로 매긴 오류. 화면이 잡은 것과 서버가 준 것이 여기서 합쳐져 온다. */
  fieldErrors: Record<string, string>;
  /** 전송 중인가. **첫째 겹**이다 — 핸들러 가드(둘째 겹)와 짝이다. */
  isLocked: boolean;
  onChangeCode: (key: DisposalCodeKey, value: string) => void;
  onChangeIssuedDate: (value: string) => void;
  onChangeIssuedTime: (value: string) => void;
  onChangeRemarks: (value: string) => void;
  onChangeReason: (value: string) => void;
}

/**
 * 품의 정보 구획 — **무엇으로·언제·왜 폐기하는지**를 적는 자리다.
 *
 * **창이 아니라 라인 표 아래 구획이다**(계획 결정 14). 선택칸이 다섯이라 창에 넣으면 창 본문이
 * 펼침 목록을 자르는 결함(`omf-mes#45`)에 정면으로 걸린다 — 고칠 수 없는 결함은 **걸릴 자리를
 * 만들지 않는 것**으로 피한다.
 *
 * **상신 사유가 이 폼에 있는 것이 이 화면의 형태다**(승인 기록 정정 1-1). 사용자 조작이
 * 「품의 상신」 하나이고 그 한 번에 전표 생성과 상신이 잇달아 나가므로, 결재에 올릴 문장을
 * **보내기 전에** 여기서 받는다. **「폐기 사유」(코드)와 「상신 사유」(문장)를 갈라 놓고**
 * 보조 문구가 그 차이를 말한다 — 낱말이 비슷해 사용자가 헷갈리는 자리다.
 *
 * **사유 형식을 유도하되 길이를 강제하지 않는다**(공유계약 A-12 · 승인 기록 §13-6). 자리표시
 * 문구의 예시와 보조 문구가 「첫 줄이 결재함 목록의 요약이 된다」를 말하고, 확인 창이 전문과
 * 첫 줄을 나눠 다시 보인다. 글자 수를 화면이 정하면 그것도 지어내는 것이다.
 *
 * **폐기 계정 칸은 잠긴 채로 보인다**(완료 조건 C50 · 착수 이슈 §4). 값 목록이 확정되지 않아
 * 고를 것이 없다 — 감추면 사용자는 이 화면에 없는 개념으로 읽고, 값이 왔을 때 놓을 자리도
 * 사라진다. 잠근 사유는 칸 아래 보이는 글자로 서고 접근 이름에 이어진다(배치 규범 4).
 *
 * **미리 채우는 값이 없다.** 출고 일시를 지금 시각으로 채우면 사용자가 확인하지 않은 시각이
 * 되돌릴 수 없는 전표에 실리고, 어제 폐기한 것을 오늘 올리는 흔한 경우에 조용히 틀린다.
 *
 * **ERP 송신 토글을 두지 않는다**(계획 결정 5) — 폐기 출고를 ERP로 보내는지 착수 이슈가 말하지
 * 않아 화면이 정하지 않는다. 정하지 않았다는 사실만 보조 문구가 적는다.
 *
 * **여러 줄 입력이 없다**(디자인 시스템 실측 — `TextField`가 `input` 기반이다 · 갭 b). 사유는
 * 한 줄로 받되 붙여넣기로 들어온 줄바꿈은 그대로 보낸다(`reason-draft.ts`).
 *
 * 기존 디자인 시스템 컴포넌트의 조합이라 이 화면 슬라이스가 소유한다.
 */
export const DisposalForm = ({
  values,
  codeOptions,
  fieldErrors,
  isLocked,
  onChangeCode,
  onChangeIssuedDate,
  onChangeIssuedTime,
  onChangeRemarks,
  onChangeReason,
}: DisposalFormProps) => {
  const issuedDateId = useId();
  const issuedErrorId = `${issuedDateId}-error`;
  const issuedError = fieldErrors.issuedAt;

  /**
   * 코드 칸 다섯은 모양이 같다 — 선택지·안내·자리표시·오류를 같은 규칙으로 만든다.
   * 규칙을 칸마다 손으로 적으면 한 칸만 다르게 고쳐진다.
   */
  const codeField = (key: DisposalCodeKey, label: string, extraNote?: string) => {
    const options = codeOptions[key];
    /* 잠긴 사유가 값 목록 안내보다 앞이다 — 고를 것이 없다는 사실이 더 무겁다. */
    const note = extraNote ?? codeNote(options);

    return (
      <SelectField
        label={label}
        options={options}
        value={values.codes[key]}
        note={note}
        placeholder={options.length === 0 ? codePlaceholder() : undefined}
        disabled={isLocked || options.length === 0}
        error={fieldErrors[CODE_FIELD_NAMES[key]]}
        onChange={(value) => {
          onChangeCode(key, value);
        }}
      />
    );
  };

  return (
    <>
      <div className="form-grid">
        {codeField('issueType', t.formFields.issueType)}
        {codeField('sourceDocumentType', t.formFields.sourceDocumentType)}
        {codeField('destinationType', t.formFields.destinationType)}
        {/*
         * **폐기 계정**(착수 이슈 §4 · 계획 §13-5). 값 목록도, 계약의 어느 필드로 가는지도
         * 확정되지 않았다 — 잠근 채로 보이고 사유를 밝힌다. 값이 오면 이 칸이 그대로 열린다.
         */}
        {codeField('disposalAccount', t.formFields.disposalAccount, t.form.disposalAccountPending)}
        {codeField('reason', t.formFields.reason)}

        <div className="field-cell">
          <FieldLabel htmlFor={issuedDateId} label={t.formFields.issuedDate} />
          <DatePicker
            id={issuedDateId}
            mode="single"
            placeholder={messages.common.selectDate}
            value={values.issuedDate === '' ? null : values.issuedDate}
            disabled={isLocked}
            invalid={issuedError !== undefined}
            aria-describedby={issuedError === undefined ? undefined : issuedErrorId}
            onChange={onChangeIssuedDate}
          />
        </div>

        <div className="field-cell">
          {/*
           * **시각은 시각 입력칸이다.** 날짜를 달력으로 통일한 뒤에도 시각은 그 위젯이 다루지
           * 않는다 — 네이티브 속성을 그대로 받는 입력칸에 `type="time"`을 준다.
           *
           * 오류 문구를 이 칸이 그리지 않고 **아래 한 자리**에서 그린다. 두 칸이 한 값이라
           * 각자 그리면 같은 문장이 두 번 서고, 그때 두 문장의 `id`가 달라 날짜 칸이 자기
           * 오류를 가리킬 수 없게 된다.
           */}
          <TextField
            type="time"
            label={t.formFields.issuedTime}
            value={values.issuedTime}
            disabled={isLocked}
            aria-invalid={issuedError !== undefined}
            aria-describedby={issuedError === undefined ? undefined : issuedErrorId}
            onChange={(event) => {
              onChangeIssuedTime(event.target.value);
            }}
          />
          {issuedError !== undefined && (
            <span id={issuedErrorId} className="field-error">
              {issuedError}
            </span>
          )}
        </div>

        <div className="field-cell">
          <TextField
            fullWidth
            label={t.formFields.remarks}
            value={values.remarks}
            disabled={isLocked}
            error={fieldErrors.remarks}
            onChange={(event) => {
              onChangeRemarks(event.target.value);
            }}
          />
        </div>
      </div>

      {/*
       * **상신 사유는 폼의 마지막 칸이고 폭을 다 쓴다.** 결재함 목록의 요약을 겸하는 문장이라
       * (공유계약 A-12) 다른 칸과 같은 격자에 두면 반 폭에 갇혀 쓴 글을 다시 읽을 수 없다.
       */}
      <div className="field-cell">
        <TextField
          fullWidth
          label={t.formFields.submitReason}
          value={values.reason}
          placeholder={t.form.reasonPlaceholder}
          helperText={t.form.reasonHelper}
          disabled={isLocked}
          error={fieldErrors.reason}
          onChange={(event) => {
            onChangeReason(event.target.value);
          }}
        />
      </div>

      {/* 사용자가 넣지 않은 값이 전표에 실린다 — 그 사실을 폼에서 밝힌다. */}
      <p className="field-note">{t.form.businessDateDerived}</p>
      {/* 화면이 정하지 않는 값이 있다는 사실도 밝힌다 — 없는 토글을 찾아 헤매지 않게 한다. */}
      <p className="field-note">{t.form.sendToErpNote}</p>
    </>
  );
};
