import { AlertBanner, Button, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, useState } from 'react';

import { FieldLabel } from './field-label';
import { useItemSearch } from './item-queries';
import { selectableOptions } from './options';
import { SelectField } from './select-field';
import type { SelectOption } from './types';

const t = messages.itemExtendedAttrs.itemPicker;

export interface ItemPickerProps {
  /** 고른 품목 번호(문자열). 비어 있으면 아직 고르지 않았다 */
  value: string;
  onChange: (value: string) => void;
  /** 지금 고른 값의 이름. 검색 결과에 없어도 선택칸이 비어 보이지 않게 한다 */
  selectedLabel?: string;
  required?: boolean;
  error?: string;
}

/**
 * 품목을 **검색해서 고르는** 작은 묶음(결정 8).
 *
 * 대상 품목은 수천 건일 수 있어 선택칸에 다 담을 수 없다. 그렇다고 번호를 입력받으면
 * **내부 식별자를 사용자에게 내는 것**이라 이 저장소 관례에 어긋난다 —
 * 사용자는 그 번호를 알 수도 확인할 수도 없다.
 *
 * **검색어가 비면 조회하지 않는다**(M31). 빈 검색어로 받은 앞 N건은 고를 만한 후보가 아니고,
 * 전 품목을 받는 것은 화면에도 서버에도 의미가 없다.
 *
 * 디자인 시스템 기존 컴포넌트의 **조합**이다(V3 워크플로 디자인 시스템 규칙) —
 * 사용처가 하나뿐이라 `ds-candidates/`로 올리지 않는다.
 */
export const ItemPicker = ({
  value,
  onChange,
  selectedLabel,
  required = false,
  error,
}: ItemPickerProps) => {
  const keywordId = useId();

  /** 입력 중인 검색어. 조회는 「찾기」를 눌러야 나간다 — 글자마다 요청을 보내지 않는다. */
  const [keyword, setKeyword] = useState('');
  const [submitted, setSubmitted] = useState('');

  const search = useItemSearch(submitted);

  /* 검색 결과에 현재 값이 없어도 표가 이미 아는 이름은 유지한다. 값 자체를 빼면 선택칸이 비어 보인다. */
  const withKnownLabel = (option: SelectOption): SelectOption =>
    option.value === value &&
    selectedLabel !== undefined &&
    !search.entries.some((entry) => entry.value === value)
      ? { value, label: selectedLabel }
      : option;

  const options = selectableOptions(search, value).map(withKnownLabel);

  const submit = () => {
    setSubmitted(keyword.trim());
  };

  return (
    <>
      <div className="field-cell">
        <FieldLabel htmlFor={keywordId} label={t.keywordLabel} />
        <TextField
          id={keywordId}
          value={keyword}
          placeholder={t.keywordPlaceholder}
          onChange={(event) => setKeyword(event.target.value)}
          /* 검색칸에서 엔터를 치면 창이 통째로 확인되는 것을 막고 검색만 한다. */
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;

            event.preventDefault();
            submit();
          }}
        />
      </div>

      <div className="field-cell field-cell-unlabeled">
        {/* 검색어가 비면 조회 자체가 없다 — 버튼을 감추지 않고 눌러도 요청이 나가지 않는다. */}
        <Button variant="outlined" onClick={submit}>
          {t.search}
        </Button>
      </div>

      <SelectField
        label={t.resultLabel}
        required={required}
        options={options}
        value={value}
        onChange={onChange}
        placeholder={t.resultPlaceholder}
        note={submitted === '' ? t.beforeSearch : undefined}
        error={error}
      />

      {/* 잘렸다는 사실을 감추면 사용자가 「이 품목은 없다」로 읽고 검색을 그만둔다. */}
      {search.truncated && (
        <div className="banner-slot">
          <AlertBanner variant="warning">{t.truncated}</AlertBanner>
        </div>
      )}

      {search.isError && (
        <div className="banner-slot">
          <AlertBanner variant="warning">{t.searchFailed}</AlertBanner>
        </div>
      )}

      {/* 조회는 됐는데 결과가 없다 — 실패와 다른 사실이라 다른 문구를 낸다. */}
      {submitted !== '' && !search.isLoading && !search.isError && search.entries.length === 0 && (
        <div className="banner-slot">
          <AlertBanner variant="info">{t.noResult}</AlertBanner>
        </div>
      )}
    </>
  );
};
