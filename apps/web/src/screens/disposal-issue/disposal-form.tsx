import { Checkbox, DatePicker, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import {
  canChooseDisposalPartner,
  codeNote,
  codePlaceholder,
  disposalPartnerNote,
  disposalPartnerPlaceholder,
  type CodeOptionSets,
  type DisposalPartnerCondition,
} from './code-options';
import { FieldLabel } from './field-label';
import { SelectField } from './select-field';
import type { DisposalCodeKey, DisposalDraft, SelectOption } from './types';
import { CODE_FIELD_NAMES } from './validation';

const t = messages.disposalIssue;

export interface DisposalFormProps {
  values: DisposalDraft;
  /**
   * 값 목록이 확정되지 않은 코드 셋. **화면이 넘긴다** — 자리표시 상수를 부품이 직접 읽으면
   * 「값이 확정되면 배열만 채운다」는 전환을 화면 수준에서 잴 수 없다(감지기 M53).
   */
  codeOptions: CodeOptionSets;
  /**
   * 폐기 거래처 선택지. **화면이 넘긴다** — 코드 셋과 같은 이유다. 비어 있으면 칸이 잠긴다.
   * 목록은 역할 코드로 좁힌 조회가 채운다(`lookups.ts`의 `useDisposalPartnerOptions`).
   */
  disposalPartnerOptions: readonly SelectOption[];
  /**
   * 그 선택칸이 **어떤 사정인가** — 화면이 정해 넘기는 **한 값**(리뷰 Major B1).
   *
   * 칸이 비는 사정이 넷인데(역할 코드 미확정 · 오는 중 · 조회 실패 · 0건) **뒤 셋은 조회를
   * 소유한 화면만 안다.** 부품이 목록 길이로 사유를 지어내면 「불러오지 못했는데 준비 중이라
   * 적힌」 칸이 되고, 사용자는 기다리면 열릴 것으로 읽는다.
   *
   * ⛔ **안내·자리표시·잠금을 이 한 값에서 함께 만든다.** 셋을 따로 정하면 한 컨트롤이 서로
   * 다른 사실을 말한다 — 실제로 앞 회차에서 얼굴은 「준비 중」인데 설명은 「불러오지 못했다」인
   * 상태가 있었다. **자체 폐기로 잠긴 사유만 이 부품이 안다** — 그 값은 초안에 있다.
   */
  disposalPartnerCondition: DisposalPartnerCondition;
  /** 계약 필드 이름으로 매긴 오류. 화면이 잡은 것과 서버가 준 것이 여기서 합쳐져 온다. */
  fieldErrors: Record<string, string>;
  /** 전송 중인가. **첫째 겹**이다 — 핸들러 가드(둘째 겹)와 짝이다. */
  isLocked: boolean;
  onChangeCode: (key: DisposalCodeKey, value: string) => void;
  onChangeIssuedDate: (value: string) => void;
  onChangeIssuedTime: (value: string) => void;
  onChangeRemarks: (value: string) => void;
  /**
   * 자체 폐기 체크가 바뀌었다. **값 비움까지 화면이 한 전이로 처리한다**(`withSelfDisposal`) —
   * 부품이 두 콜백으로 나눠 부르면 한쪽만 도착한 중간 상태가 생긴다.
   */
  onToggleSelfDisposal: (isSelfDisposal: boolean) => void;
  onChangeDisposalPartner: (value: string) => void;
  onChangeReason: (value: string) => void;
}

/**
 * 폐기 요청 정보 구획 — **무엇으로·언제·왜 폐기하는지**를 적는 자리다.
 *
 * **창이 아니라 라인 표 아래 구획이다**(계획 결정 14). 선택칸이 여럿이라 창에 넣으면 창 본문이
 * 펼침 목록을 자르는 결함(`omf-mes#45`)에 정면으로 걸린다 — 고칠 수 없는 결함은 **걸릴 자리를
 * 만들지 않는 것**으로 피한다.
 *
 * **요청 사유가 이 폼에 있는 것이 이 화면의 형태다**(승인 기록 정정 1-1). 사용자 조작이
 * 「승인 요청」 하나이고 그 한 번에 전표 생성과 승인 요청이 잇달아 나가므로, 결재에 올릴 문장을
 * **보내기 전에** 여기서 받는다. **「폐기 사유」(코드)와 「요청 사유」(문장)를 갈라 놓고**
 * 보조 문구가 그 차이를 말한다 — 낱말이 비슷해 사용자가 헷갈리는 자리다.
 *
 * **사유 형식을 유도하되 길이를 강제하지 않는다**(공유계약 A-12 · 승인 기록 §13-6). 자리표시
 * 문구의 예시와 보조 문구가 「첫 줄이 결재함 목록의 요약이 된다」를 말하고, 확인 창이 전문과
 * 첫 줄을 나눠 다시 보인다. 글자 수를 화면이 정하면 그것도 지어내는 것이다.
 *
 * **폐기 계정 칸이 없다 — 잠긴 칸조차 없다**(변경 통지 #124 ⛔). 회계 계정은 MES 밖의 값이라
 * 「값이 오면 열릴 자리」가 아니고, 잠근 채로 두면 사용자는 언젠가 열릴 칸으로 읽는다.
 * **도착지 유형 칸도 함께 없다**(#128) — 유형은 폐기 거래처를 골랐다는 사실에서 따라오는
 * 상수라(`DISPOSAL_DESTINATION_TYPE_CODE`) 사용자가 고를 값이 아니다.
 *
 * **대신 도착지 컨트롤 둘이 있다**(#128) — 「자체 폐기」 체크와 「폐기 거래처」 선택칸.
 * ⛔ **③ 승인 후 구획이 아니라 여기 있는 이유**는 계약이 도착지 짝을 전표 **생성** 본문에서만
 * 실어 나르고 전표 헤더를 고치는 경로가 없기 때문이다(실측 · 승인 기록 D-1 안 A). 승인 뒤에
 * 두면 사용자가 고른 거래처가 **조용히 사라진다** — 되돌릴 수 없는 쓰기 화면에서 가장 나쁜
 * 형태다. 시점이 옮겨졌다는 사실은 보조 문구가 밝히고, 어긋남은 이슈로 올라가 있다.
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
  disposalPartnerOptions,
  disposalPartnerCondition,
  fieldErrors,
  isLocked,
  onChangeCode,
  onChangeIssuedDate,
  onChangeIssuedTime,
  onChangeRemarks,
  onToggleSelfDisposal,
  onChangeDisposalPartner,
  onChangeReason,
}: DisposalFormProps) => {
  const issuedDateId = useId();
  const issuedErrorId = `${issuedDateId}-error`;
  const issuedError = fieldErrors.issuedAt;

  /*
   * 선택칸의 안내가 **둘로 갈린다** — 사용자가 정한 결과(자체 폐기)와 목록 쪽 사정(역할 코드
   * 미확정 · 오는 중 · 조회 실패 · 0건)은 할 수 있는 조치가 다르다. 같은 문구로 뭉치면 체크를
   * 풀어도 열리지 않는 칸으로 읽는다. **체크가 앞이다** — 그때는 목록 사정이 뜻이 없다.
   *
   * 목록 쪽 사정은 **한 값에서** 나온다(`disposalPartnerCondition`) — 안내·자리표시·잠금이
   * 같은 원천을 보므로 셋이 서로 다른 사실을 말할 수 없다(리뷰 Major B1).
   */
  const partnerNote = values.isSelfDisposal
    ? t.form.selfDisposalChosen
    : disposalPartnerNote(disposalPartnerCondition);
  const canChoosePartner = canChooseDisposalPartner(disposalPartnerCondition);

  /**
   * 코드 칸 셋은 모양이 같다 — 선택지·안내·자리표시·오류를 같은 규칙으로 만든다.
   * 규칙을 칸마다 손으로 적으면 한 칸만 다르게 고쳐진다.
   */
  const codeField = (key: DisposalCodeKey, label: string) => {
    const options = codeOptions[key];

    return (
      <SelectField
        label={label}
        options={options}
        value={values.codes[key]}
        note={codeNote(options)}
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

        {/*
         * **도착지 짝** — 「누가 가져갔는가」(변경 통지 #128). 체크와 선택칸이 **함께** 서는
         * 이유는 나가는 본문에서 「아직 안 골랐다」와 「자체 폐기라 없다」가 똑같이 「두 키
         * 없음」으로 보이기 때문이다. 체크가 없으면 그 둘을 화면도 사용자도 가를 수 없다.
         */}
        <div className="field-cell">
          <Checkbox
            checked={values.isSelfDisposal}
            disabled={isLocked}
            onChange={(event) => {
              onToggleSelfDisposal(event.target.checked);
            }}
          >
            {t.formFields.selfDisposal}
          </Checkbox>
        </div>

        <SelectField
          label={t.formFields.disposalPartner}
          options={[...disposalPartnerOptions]}
          value={values.disposalPartnerId}
          note={partnerNote}
          /*
           * 서버가 준 거래처 오류가 **고칠 칸 옆에** 선다(`DISPOSAL_FORM_FIELDS`가 정한 자리).
           *
           * ⚠ **잠긴 칸에 붙으면 눈으로만 닿는다**(리뷰 Minor M3). `disabled` 컨트롤은 초점
           * 순회에서 빠져 `aria-describedby`가 스크린리더·키보드 경로로 이어지지 않는다. 오류를
           * 삼키지 않는 쪽을 택했고 그 사실은 시험이 값으로 고정한다 — 「잠긴 칸의 오류는
           * 배너로」로 바꾸려면 `DISPOSAL_FORM_FIELDS`를 조건부로 만들어야 해서 이 단위 밖이다.
           * 회차 종료 질문에 이 사실을 함께 올린다.
           */
          error={fieldErrors.destinationId}
          placeholder={disposalPartnerPlaceholder(disposalPartnerCondition)}
          /*
           * **체크하면 고를 수 없다**(#128 문면). 값 비움은 화면의 전이(`withSelfDisposal`)가
           * 맡는다 — 여기서 비우면 잠금과 비움이 두 자리로 갈려 한쪽만 도는 경로가 생긴다.
           *
           * **고를 것이 없을 때 잠그는 판정도 같은 원천에서 온다** — 목록 길이를 여기서 다시
           * 세면 안내는 「불러오지 못했다」인데 칸은 열려 있는 어긋남이 생긴다.
           */
          disabled={isLocked || values.isSelfDisposal || !canChoosePartner}
          onChange={onChangeDisposalPartner}
        />
      </div>

      {/*
       * **승인 뒤에는 바꿀 수 없다는 사실을 밝힌다.** 통지는 이 컨트롤을 《승인 후》 구획에
       * 두라고 했으나 계약에 전표 헤더를 고치는 경로가 없어(실측) 그 시점에는 보낼 통로가
       * 없다 — 발의 시점으로 옮겼다는 사실이 화면에 없으면 사용자는 나중에 고르려 한다.
       */}
      <p className="field-note">{t.form.destinationNote}</p>

      {/*
       * **요청 사유는 폼의 마지막 칸이고 폭을 다 쓴다.** 결재함 목록의 요약을 겸하는 문장이라
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
