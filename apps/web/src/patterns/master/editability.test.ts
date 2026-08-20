import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { codeLockMessage } from './editability';

describe('codeLockMessage', () => {
  it('편집 가능하면 사유를 내지 않는다', () => {
    expect(codeLockMessage({ codeEditable: true, reason: 'EDITABLE' })).toBeNull();
  });

  it('참조 중이면 건수를 넣은 사유를 낸다', () => {
    const result = codeLockMessage({
      codeEditable: false,
      reason: 'REFERENCED',
      referenceCount: 3,
    });

    expect(result).toBe(messages.editability.referenced(3));
  });

  it('참조 중인데 건수를 받지 못하면 건수를 지어내지 않는다', () => {
    const result = codeLockMessage({ codeEditable: false, reason: 'REFERENCED' });

    expect(result).toBe(messages.editability.referenced(null));
  });

  it('참조를 셀 수 없으면 셀 수 없다는 사유를 낸다', () => {
    const result = codeLockMessage({
      codeEditable: false,
      reason: 'NOT_COUNTABLE',
      referenceCount: null,
    });

    expect(result).toBe(messages.editability.notCountable(null));
  });

  it('외부 시스템 수신본이면 원본에서 바꾸라는 사유를 낸다', () => {
    const result = codeLockMessage({ codeEditable: false, reason: 'RECEIVED_FROM_ERP' });

    expect(result).toBe(messages.editability.receivedFromErp(null));
  });

  it('라벨이 발행됐으면 라벨 사유를 낸다', () => {
    const result = codeLockMessage({ codeEditable: false, reason: 'LABEL_ISSUED' });

    expect(result).toBe(messages.editability.labelIssued(null));
  });

  it('라벨이 발행됐으면 참조 건수가 0이어도 잠근다 — 이 사유는 건수로 갈리지 않는다', () => {
    const result = codeLockMessage({
      codeEditable: false,
      reason: 'LABEL_ISSUED',
      referenceCount: 0,
    });

    expect(result).toBe(messages.editability.labelIssued(null));
  });

  it('다섯 사유가 서로 다른 문구를 낸다 — 어느 사유인지 화면에서 구분된다', () => {
    const reasons = [
      'EDITABLE',
      'REFERENCED',
      'NOT_COUNTABLE',
      'RECEIVED_FROM_ERP',
      'LABEL_ISSUED',
    ] as const;

    const rendered = reasons.map((reason) => codeLockMessage({ codeEditable: false, reason }));

    expect(new Set(rendered).size).toBe(reasons.length);
  });

  it('codeEditable=false인데 사유가 EDITABLE이면 잠근다 — 판정의 주인은 codeEditable이다', () => {
    const result = codeLockMessage({
      codeEditable: false,
      reason: 'EDITABLE',
      referenceCount: 3,
    });

    expect(result).toBe(messages.editability.locked);
  });

  it('codeEditable=true인데 사유가 REFERENCED여도 잠그지 않는다 — 사유는 문구 선택에만 쓴다', () => {
    const result = codeLockMessage({
      codeEditable: true,
      reason: 'REFERENCED',
      referenceCount: 3,
    });

    expect(result).toBeNull();
  });
});
