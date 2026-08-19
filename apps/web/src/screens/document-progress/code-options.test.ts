import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import {
  codeNote,
  codePlaceholder,
  PLACEHOLDER_DOCUMENT_STATUS_CODES,
  toStatusOptions,
} from './code-options';
import { DOCUMENT_TYPES } from './document-types';
import { documentTypeFixtures } from './fixtures';
import { toListQuery, type ProgressFilters } from './filters';

describe('PLACEHOLDER_DOCUMENT_STATUS_CODES', () => {
  /* 값을 지어내지 않는 것이 이 파일의 목적이다 — 비어 있는 것이 지금의 사실이다. */
  it('비어 있다', () => {
    expect(PLACEHOLDER_DOCUMENT_STATUS_CODES).toEqual([]);
  });

  /*
   * ⚠ **이 배열이 비었다는 사실로 조회를 막지 않는다.** 막으면 상태 값이 확정될 때까지 그 자리가
   * 영영 잠긴다 — 유형과 갈리는 지점이 정확히 여기다(유형은 계약 필수라 없으면 부를 수 없다).
   */
  it('상태 선택지가 비어 있어도 목록 조회를 막지 않는다', () => {
    const filters: ProgressFilters = {
      documentType: 'SYN_DOC_TYPE_A',
      status: '',
      from: '',
      to: '',
      item: '',
      lot: '',
      warehouse: '',
      cancellableOnly: false,
      q: '',
    };

    const query = toListQuery(filters, documentTypeFixtures, 1);

    expect(query).not.toBeNull();
    expect(query?.statusCode).toBeUndefined();
  });
});

describe('toStatusOptions', () => {
  it('빈 값 목록은 빈 선택지가 된다', () => {
    expect(toStatusOptions(PLACEHOLDER_DOCUMENT_STATUS_CODES)).toEqual([]);
  });

  /* 라벨을 지어내지 않는다 — 사람이 읽을 이름을 주는 곳이 아직 없다. */
  it('코드값을 그대로 라벨로 쓰고 차례를 바꾸지 않는다', () => {
    expect(toStatusOptions(['SYN_STATUS_B', 'SYN_STATUS_A'])).toEqual([
      { value: 'SYN_STATUS_B', label: 'SYN_STATUS_B' },
      { value: 'SYN_STATUS_A', label: 'SYN_STATUS_A' },
    ]);
  });
});

describe('codeNote', () => {
  it('선택지가 비어 있으면 왜 비었는지 밝힌다', () => {
    expect(codeNote([])).toBe(messages.pendingCode.note);
  });

  /* 채워지면 사라진다 — 고를 것이 있는 칸에 「준비 중」이 남으면 그것이 곧 틀린 안내다. */
  it('선택지가 있으면 안내를 붙이지 않는다', () => {
    expect(codeNote(toStatusOptions(['SYN_STATUS_A']))).toBeUndefined();
  });

  /* 유형 표도 같은 안내를 쓴다 — 두 자리가 갈리면 한쪽만 「준비 중」이 남는다. */
  it('유형 자리표시가 비어 있을 때도 같은 안내를 낸다', () => {
    expect(
      codeNote(DOCUMENT_TYPES.map((entry) => ({ value: entry.code, label: entry.label }))),
    ).toBe(messages.pendingCode.note);
  });
});

describe('codePlaceholder', () => {
  it('비어 있는 선택칸의 자리표시 글자를 낸다', () => {
    expect(codePlaceholder()).toBe(messages.pendingCode.placeholder);
  });
});
