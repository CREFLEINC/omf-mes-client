import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { productCandidate, returnCandidate } from './fixtures';
import {
  descriptionWarning,
  EMPTY_NONCONFORMANCE_FORM,
  toNonconformanceCreateBody,
  validateNonconformanceForm,
} from './nonconformance-form';
import { defaultRequestForm, toDispositionRequestBody, validateRequestForm } from './request-form';
import { toCandidateRow } from './types';

const t = messages.dispositionRequest;

describe('부적합 등록 폼', () => {
  const filled = {
    severityCode: 'MAJOR',
    description: '외관 스크래치 · 상단 모서리 · 40개',
    departmentId: '',
  };

  it('심각도와 내용이 비면 필수 오류다', () => {
    const errors = validateNonconformanceForm(EMPTY_NONCONFORMANCE_FORM);

    expect(errors.severityCode).toBe(t.register.severityRequired);
    expect(errors.description).toBe(t.register.descriptionRequired);
  });

  /* A-12 — 짧은 내용은 막지 않고 경고한다. 「불량」 두 글자를 잡는 것이 목적이다. */
  it('짧은 내용은 경고만 낸다 — 저장을 막지 않는다', () => {
    const short = { ...filled, description: '불량' };

    expect(validateNonconformanceForm(short)).toEqual({});
    expect(descriptionWarning(short)).toBe(t.register.descriptionShort);
    expect(descriptionWarning(filled)).toBeUndefined();
  });

  it('본문은 대상 LOT 전량을 싣고 원천을 싣지 않는다', () => {
    const body = toNonconformanceCreateBody(filled, toCandidateRow(returnCandidate()));

    expect(body).toEqual({
      itemId: 2003,
      severityCode: 'MAJOR',
      description: '외관 스크래치 · 상단 모서리 · 40개',
      lots: [{ lotId: 8201, affectedQty: 200, uomId: 7001 }],
    });
    expect(body).not.toHaveProperty('sourceCode');
  });

  it('제품(OQC) 갈래는 검사 결과를 함께 가리키고 담당 부서는 고른 때만 싣는다', () => {
    const body = toNonconformanceCreateBody(
      { ...filled, departmentId: '3101' },
      toCandidateRow(productCandidate({ nonconformanceId: null, nonconformanceStatusCode: null })),
    );

    expect(body?.inspectionResultId).toBe(5301);
    expect(body?.responsibleDepartmentId).toBe(3101);
  });

  it('검증에 걸리거나 LOT 을 특정할 수 없으면 본문을 만들지 않는다', () => {
    const row = toCandidateRow(returnCandidate());

    expect(toNonconformanceCreateBody(EMPTY_NONCONFORMANCE_FORM, row)).toBeUndefined();
    expect(toNonconformanceCreateBody(filled, { ...row, lotId: null })).toBeUndefined();
  });
});

describe('판정 의뢰 폼', () => {
  it('기본값은 대상 전량이다 — 부분 의뢰는 줄여 적는다', () => {
    expect(defaultRequestForm(200)).toEqual({ qty: '200', remarks: '' });
    expect(defaultRequestForm(null)).toEqual({ qty: '', remarks: '' });
  });

  it('1 미만·초과·숫자 아님을 각각 다른 말로 막는다', () => {
    expect(validateRequestForm({ qty: '', remarks: '' }, 200).requestedQty).toBe(
      t.request.qtyRequired,
    );
    expect(validateRequestForm({ qty: 'x', remarks: '' }, 200).requestedQty).toBe(
      t.request.qtyNotNumber,
    );
    expect(validateRequestForm({ qty: '0', remarks: '' }, 200).requestedQty).toBe(
      t.request.qtyTooSmall,
    );
    expect(validateRequestForm({ qty: '201', remarks: '' }, 200).requestedQty).toBe(
      t.request.qtyExceeds('200'),
    );
    expect(validateRequestForm({ qty: '200', remarks: '' }, 200)).toEqual({});
  });

  it('본문은 수량·단위를 싣고 빈 비고는 싣지 않는다', () => {
    expect(toDispositionRequestBody({ qty: '150', remarks: '  ' }, 200, 7001)).toEqual({
      requestedQty: 150,
      uomId: 7001,
    });
    expect(toDispositionRequestBody({ qty: '150', remarks: '상단만' }, 200, 7001)?.remarks).toBe(
      '상단만',
    );
    expect(toDispositionRequestBody({ qty: '0', remarks: '' }, 200, 7001)).toBeUndefined();
  });
});
