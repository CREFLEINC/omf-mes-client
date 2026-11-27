import { Button, Checkbox, DatePicker, Switch, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import { InfoLabel, InfoTip } from '../../patterns/info-tip';
import { TimeField } from '../../patterns/time-field';
import { codeNote, codePlaceholder, type CodeOptionSets } from './code-options';
import { SelectField } from './select-field';
import type { ReturnCodeKey, ReturnDraft, SelectOption } from './types';
import { CODE_FIELD_NAMES } from './validation';

const t = messages.supplierReturn;
const dt = messages.screenPatterns.dateTimeField;

export interface ReturnFormProps {
  values: ReturnDraft;
  /** 공급사 선택지. 화면이 이름으로 풀어 넘긴다 — 번호를 사용자가 칠 일이 없다. */
  supplierOptions: SelectOption[];
  /** 공급사 목록의 한계(잘림·실패) 안내. 밝히지 않으면 값이 사라진 것으로 읽힌다. */
  supplierNote?: string;
  /** 실패했으면 복구 수단을 함께 낸다 — 사용자가 할 수 있는 조치가 재시도뿐이다. */
  hasSupplierError: boolean;
  /**
   * 값 목록이 확정되지 않은 코드 넷. **화면이 넘긴다** — 자리표시 상수를 부품이 직접 읽으면
   * 「값이 확정되면 배열만 채운다」는 전환을 화면 수준에서 잴 수 없다.
   */
  codeOptions: CodeOptionSets;
  /** 계약 필드 이름으로 매긴 오류. 화면이 잡은 것과 서버가 준 것이 여기서 합쳐져 온다. */
  fieldErrors: Record<string, string>;
  /** 전송 중인가. **첫째 겹**이다 — 핸들러 가드(둘째 겹)와 짝이다. */
  isLocked: boolean;
  onChangeSupplier: (value: string) => void;
  onChangeCode: (key: ReturnCodeKey, value: string) => void;
  onChangeIssuedDate: (value: string) => void;
  onChangeIssuedTime: (value: string) => void;
  onChangeReplacementExpected: (value: boolean) => void;
  onChangeSendToErp: (value: boolean) => void;
  onChangeRemarks: (value: string) => void;
  onRetrySupplierOptions: () => void;
}

/**
 * 반품 정보 구획 — **누구에게·무엇으로·언제 되돌려 보내는지**를 정하는 자리다.
 *
 * **창이 아니라 라인 표 아래 구획이다**(계획 결정 12). 선택칸이 다섯이라 창에 넣으면 창 본문이
 * 펼침 목록을 자르는 결함(#45)에 정면으로 걸린다 — 고칠 수 없는 결함은 **걸릴 자리를 만들지
 * 않는 것**으로 피한다.
 *
 * **코드 넷의 선택지가 비어 있다**(값 목록 미확정). 값을 지어내지 않고, 왜 비어 있는지를
 * `aria-describedby`로 이어 붙인다 — 그 상태에서는 「반품 처리」가 잠기고 사유가 버튼 옆에 선다.
 *
 * **출고 일시를 두 칸으로 받는다.** 날짜는 달력 컨트롤이고 시각은 시각 입력칸이다. 두 칸이 한
 * 값(`issuedAt`)이라 **오류도 한 자리에 한 번만** 그리고 두 컨트롤이 함께 그것을 가리킨다 —
 * 같은 문장을 두 번 그리면 화면이 같은 말을 되풀이한다.
 *
 * **미리 채우는 값이 없다.** 출고 일시를 지금 시각으로 채우면 사용자가 확인하지 않은 시각이
 * 되돌릴 수 없는 전표에 실리고, 어제 나간 것을 오늘 등록하는 흔한 경우에 조용히 틀린다.
 * ERP 송신만 참으로 시작한다(착수 이슈 §4가 「기본값을 켜짐으로 고정」이라 적었다).
 *
 * **칸 아래 설명문을 두지 않는다**(관리웹 정리 시안 A). 영업일이 출고 일자에서 나온다는 사실은
 * 출고 일자 라벨 옆 ⓘ, 대체입고 예정이 표시로만 남는다는 사실은 체크 옆 ⓘ 로 읽힌다.
 *
 * **상태 칩을 쓰지 않는다** — 비활성 표현이 필요해지면 디자인 시스템의 갭(`StatusChip`에
 * `disabled`가 없다 · 실측)에 걸린다. 비활성은 컨트롤의 `disabled`와 사유 텍스트로만 낸다.
 *
 * 기존 디자인 시스템 컴포넌트의 조합이라 이 화면 슬라이스가 소유한다.
 */
export const ReturnForm = ({
  values,
  supplierOptions,
  supplierNote,
  hasSupplierError,
  codeOptions,
  fieldErrors,
  isLocked,
  onChangeSupplier,
  onChangeCode,
  onChangeIssuedDate,
  onChangeIssuedTime,
  onChangeReplacementExpected,
  onChangeSendToErp,
  onChangeRemarks,
  onRetrySupplierOptions,
}: ReturnFormProps) => {
  const issuedDateId = useId();
  const issuedErrorId = `${issuedDateId}-error`;
  const issuedError = fieldErrors.issuedAt;

  /**
   * 코드 칸 넷은 모양이 같다 — 선택지·안내·자리표시·오류를 같은 규칙으로 만든다.
   * 규칙을 칸마다 손으로 적으면 한 칸만 다르게 고쳐진다.
   */
  const codeField = (key: ReturnCodeKey, label: string) => (
    <SelectField
      required
      label={label}
      options={codeOptions[key]}
      value={values.codes[key]}
      note={codeNote(codeOptions[key])}
      placeholder={codeOptions[key].length === 0 ? codePlaceholder() : undefined}
      disabled={isLocked}
      error={fieldErrors[CODE_FIELD_NAMES[key]]}
      onChange={(value) => {
        onChangeCode(key, value);
      }}
    />
  );

  return (
    <>
      <div className="form-grid">
        {/*
         * **공급사를 자동으로 끌어오지 않는다**(계획 결정 11). 입고 전표에 공급사 필드가 없고,
         * 원천을 따라 올라가려면 원천 문서 유형 값 목록이 있어야 하는데 그것이 없다.
         */}
        <SelectField
          wide
          required
          label={t.fields.supplier}
          options={supplierOptions}
          value={values.supplier}
          note={supplierNote}
          disabled={isLocked}
          error={fieldErrors.destinationId}
          onChange={onChangeSupplier}
        />

        {codeField('issueType', t.fields.issueType)}
        {codeField('sourceDocumentType', t.fields.sourceDocumentType)}
        {codeField('destinationType', t.fields.destinationType)}
        {codeField('reason', t.fields.reason)}

        <div className="field-cell">
          {/* 사용자가 넣지 않은 영업일이 이 값에서 나와 전표에 실린다 — 라벨 옆 ⓘ 로 밝힌다. */}
          <InfoLabel
            htmlFor={issuedDateId}
            label={t.fields.issuedDate}
            info={t.notes.businessDateDerived}
            required
          />
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
           * **시각은 공용 시각 칸이다**(patterns/time-field · #360) — 숫자만 쳐도 `HH:MM` 으로 다듬고, 시계
           * 단추로 고를 수도 있다. 값은 종전과 같은 `HH:MM` 이다.
           *
           * 오류 문구를 이 칸이 그리지 않고 **아래 한 자리**에서 그린다. 두 칸이 한 값이라
           * 각자 그리면 같은 문장이 두 번 서고, 그때 두 문장의 `id`가 달라 날짜 칸이 자기
           * 오류를 가리킬 수 없게 된다.
           */}
          <span className="field-label" aria-hidden="true">
            {t.fields.issuedTime}
            <span className="required-mark">{' *'}</span>
          </span>
          <TimeField
            labels={{
              field: t.fields.issuedTime,
              hourList: dt.hour(t.fields.issuedTime),
              minuteList: dt.minute(t.fields.issuedTime),
              hourHead: dt.hourLabel,
              minuteHead: dt.minuteLabel,
              placeholder: dt.timePlaceholder,
            }}
            hour={values.issuedTime.slice(0, 2)}
            minute={values.issuedTime.slice(3, 5)}
            disabled={isLocked}
            invalid={issuedError !== undefined}
            describedBy={issuedError === undefined ? undefined : issuedErrorId}
            onChange={(hour, minute) => {
              onChangeIssuedTime(`${hour}:${minute}`);
            }}
            onClear={() => {
              onChangeIssuedTime('');
            }}
          />
          {issuedError !== undefined && (
            <span id={issuedErrorId} className="field-error">
              {issuedError}
            </span>
          )}
        </div>

        <div className="check-group">
          {/* 체크해도 입하 예정이 생기지 않는다 — 그 사실은 체크 옆 ⓘ 로 둔다. */}
          <span className="info-label">
            <Checkbox
              checked={values.replacementExpected}
              disabled={isLocked}
              onChange={(event) => {
                onChangeReplacementExpected(event.target.checked);
              }}
            >
              {t.fields.replacementExpected}
            </Checkbox>
            <InfoTip text={t.notes.replacementExpectedNote} />
          </span>

          <Switch
            label={t.fields.sendToErp}
            checked={values.sendToErp}
            disabled={isLocked}
            onChange={(event) => {
              onChangeSendToErp(event.target.checked);
            }}
          />
        </div>

        <div className="field-cell">
          <TextField
            fullWidth
            label={t.fields.remarks}
            value={values.remarks}
            disabled={isLocked}
            error={fieldErrors.remarks}
            onChange={(event) => {
              onChangeRemarks(event.target.value);
            }}
          />
        </div>
      </div>

      {hasSupplierError && (
        <div className="field-cell">
          <span className="field-note">{t.reasons.partnersFailed}</span>
          <Button variant="outlined" size="sm" disabled={isLocked} onClick={onRetrySupplierOptions}>
            {messages.common.retry}
          </Button>
        </div>
      )}
    </>
  );
};
