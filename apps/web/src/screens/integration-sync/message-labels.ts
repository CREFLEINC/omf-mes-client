import { messages } from '@omf-mes/i18n';

import type { IntegrationMessageRow } from './types';

/**
 * 연계 메시지의 코드를 **업무 이름**으로 옮긴다(사용자 지시 2026-10-27 — 「메시지 키 · 연계 종류가 무슨 말인지 하나도
 * 모르겠다」). 표 · 상세 · 조건 줄 · 조건 칩이 모두 이것을 쓴다.
 *
 * 이름은 문구(`integrationSync.labels`)가 갖는다 — 서버의 연계 정의 목록이 비어 받을 데가 없다. 모르는 코드는 코드
 * 그대로 낸다(새 연계가 생겨도 줄이 사라지지 않게).
 */

const labels = messages.integrationSync.labels;

const lookup = (table: Readonly<Record<string, string>>, code: string): string =>
  table[code] ?? code;

/** 수신 · 송신. */
export const directionName = (code: string): string => lookup(labels.directions, code);

/** 대기 · 처리 중 · 완료 · 실패. */
export const statusName = (code: string): string => lookup(labels.statuses, code);

/** 연계 항목 — 「구매발주」 · 「입고 (G/R)」. */
export const interfaceName = (code: string): string => lookup(labels.interfaces, code);

/**
 * 메시지가 나른 건의 번호 — 메시지 키에서 앞의 연계 코드(`IF-GR-SEND:`)를 뗀 나머지다(송신은 입고 번호 같은 업무
 * 번호, 수신은 ERP 가 매긴 전송 순번). 키 모양이 다르면 키 그대로 낸다.
 */
export const documentNoOf = (row: Pick<IntegrationMessageRow, 'messageKey' | 'interfaceCode'>) => {
  const prefix = `${row.interfaceCode}:`;

  return row.messageKey.startsWith(prefix) ? row.messageKey.slice(prefix.length) : row.messageKey;
};

/** 한 건을 부르는 이름 — 「입고 (G/R) GR-20261016-0010」. 일괄 재처리 결과처럼 건을 나열할 때 쓴다. */
export const messageTitleOf = (row: Pick<IntegrationMessageRow, 'messageKey' | 'interfaceCode'>) =>
  `${interfaceName(row.interfaceCode)} ${documentNoOf(row)}`;
