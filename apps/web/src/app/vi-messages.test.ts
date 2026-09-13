import { ko, vi, type Messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { NAV_ENTRIES, NAV_GROUPS } from './nav-tree';
import { LOCALE_CHOICE, SHELL_BRAND, type LocalizedLabel } from './shell-label';

/**
 * 베트남어를 고른 사람에게 한국어가 보이지 않는가 — **관리웹 몫**(#1113).
 *
 * 모바일에 같은 계열의 감지기가 있고(`apps/mobile/src/app/vi-messages.test.ts`) 그쪽은 화면이
 * 실제로 읽는 슬라이스를 **소스를 훑어** 찾는다. 관리웹은 그럴 수 없다 — 이 시점에 관리웹
 * 슬라이스는 **대부분 아직 한국어**라, 읽는 것을 전부 대상으로 삼으면 첫 회차부터 100건 넘게
 * 빨갛고 감지기가 꺼진 것과 같아진다.
 *
 * 그래서 **옮긴 것만 적어 두고 그것만 잰다.**
 */

/**
 * ⭐⭐ **여기에 파마다 한 줄을 더한다.** ⭐⭐
 *
 * 묶음별 후속 이슈가 자기 화면의 슬라이스를 옮기면 **그 이름을 이 배열에 더한다.** 그러면 그
 * 슬라이스의 값 하나까지 이 파일이 세기 시작한다.
 *
 * ⛔ **파마다 자기 시험 파일에 자기 목록을 두지 않는다.** 목록이 흩어지면 「우리 것은 다 옮겼다」는
 * 시험만 늘고, **아무도 적지 않은 슬라이스**가 조용히 지나간다 — 반쯤 옮긴 화면은 안 옮긴 화면보다
 * 나쁘다(두 언어가 한 화면에 섞인다). 늘어나는 자리는 이 배열 하나다.
 *
 * ⚠ **`packages/i18n/src/vi/index.ts` 에 잇는 일과 짝이다.** 여기만 더하면 아래 첫 감지기가
 * 「원문 그대로다」로 막고, 저기만 더하면 옮기다 만 값이 조용히 지나간다.
 */
const TRANSLATED = [
  /* #1113 — 셸과 공용 문구. 관리웹이 베트남어로 서려면 이만큼은 먼저 옮겨야 한다. */
  'dashboard',
  'login',
  'session',
  'editability',
  'conflict',
  'httpError',
  'shellNav',
  'pendingCode',
  'stateLocked',
  'save',
  /* #1120 — 승인. 결재함 1화면. */
  'approvalInbox',
  /* #1121 — 알림. 알림센터 · 알람 수신자 설정 · 공지·전달 3화면. */
  'notificationCenter',
  'alarmRecipientSettings',
  'notice',
  /* #1122 — 시스템 관리. 사용자·역할·권한 · 결재선 정의 · 단말기-공정 매핑 · 비밀번호 변경 4화면. */
  'usersRoles',
  'approvalRoute',
  'terminalProcessMap',
  'passwordChange',
  /* 모바일이 옮기며 `shell`·`reference` 까지 담은 것을 관리웹도 그대로 읽는다. */
  'common',
  /* #1119 — 설비/툴 13화면. */
  'collectionChannel',
  'downtimeSummary',
  'equipmentFailure',
  'equipmentMaster',
  'gaugeCalibration',
  'gaugeMaster',
  'maintenanceOrder',
  'maintenanceResult',
  'shotConversion',
  'toolMaster',
  'toolPmOrder',
  'toolPmResult',
  'workCalendar',
  /* #1115 — 자재창고 12화면. 용어가 겹쳐 한 파가 쭉 옮겼다(GLOSSARY 의 물류·창고 표가 정본). */
  'disposalIssue',
  'documentProgress',
  'goodsReceipt',
  'inboundSchedule',
  'iqcInspection',
  'iqcSkipApproval',
  'overReceiptSplit',
  'poRegister',
  'stockAdjust',
  'stockStatus',
  'stocktaking',
  'supplierReturn',
  /* #1116 — 출하 11화면. */
  'dispositionRequest',
  'expeditedShipment',
  'oqcInspection',
  'productDisposalRequest',
  'productStockStatus',
  'returnReceipt',
  'shipmentConfirm',
  'shipmentProcessing',
  'shipmentRequestCreate',
  'shipmentSchedule',
  'stockReinstatement',
  /* #1118 — 품질관리 6화면. 셋은 문구 묶음이 없어 이 이슈가 슬라이스부터 세웠다. */
  'dispositionDecision',
  'inspectionResultInsights',
  'lotStatusHistory',
  'lotStatusTransition',
  'qualityApproval',
  'suspiciousMaterialHold',
  /* #1114 — 기준정보 11화면. */
  'commonCode',
  'defectCauseCode',
  'inspectionStandard',
  'integrationSync',
  'itemExtendedAttrs',
  'judgmentCode',
  'masterChange',
  'putawayRule',
  'routing',
  'warehouseLayout',
  'warehouseLocation',
] as const satisfies readonly (keyof Messages)[];

const HANGUL = /[가-힣]/;

/** 잎까지 내려가며 화면에 나가는 문자열을 모은다. 함수 문구는 부르지 않고는 볼 수 없다. */
const leaves = (value: unknown, path: string, found: [string, string][]): void => {
  if (typeof value === 'string') {
    found.push([path, value]);
    return;
  }

  if (typeof value === 'function') {
    /* 자리값을 채워 부른다. 템플릿 안 한국어는 부르지 않으면 드러나지 않는다. */
    const args = Array.from(
      { length: (value as (...args: unknown[]) => unknown).length },
      () => '0',
    );

    try {
      const made = (value as (...args: unknown[]) => unknown)(...args);

      if (typeof made === 'string') {
        found.push([`${path}()`, made]);
      }
    } catch {
      /* 부를 수 없는 모양이면 건너뛴다. 여기서 막으면 나머지를 못 잰다. */
    }

    return;
  }

  if (value !== null && typeof value === 'object') {
    for (const [key, inner] of Object.entries(value)) {
      leaves(inner, path === '' ? key : `${path}.${key}`, found);
    }
  }
};

describe('베트남어 문구 — 관리웹', () => {
  /**
   * ⛔ **빈 통과를 막는다.** 배열을 비우면 아래 감지기가 **전부** 성립한다 — 잴 것이 없으니
   * 옮기지 않은 것도 없고 한국어가 남은 것도 없다.
   */
  it('대상 목록이 비어 있지 않다 — 아래 감지기가 무언가를 재고 있다', () => {
    expect(TRANSLATED.length).toBeGreaterThan(0);
  });

  /**
   * 목록에 적었는데 `vi/index.ts` 에 잇지 않으면 그 슬라이스는 **한국어를 그대로 재수출한다.**
   * 값이 다 차 있어 아래 한국어 감지기도 통과하므로, 여기서 따로 막는다.
   */
  it('목록에 적은 슬라이스가 실제로 옮겨져 있다', () => {
    const untouched = TRANSLATED.filter((name) => vi[name] === ko[name]);

    expect(untouched).toEqual([]);
  });

  it('화면에 나가는 값에 한국어가 남지 않는다', () => {
    const offenders: string[] = [];

    for (const name of TRANSLATED) {
      const found: [string, string][] = [];
      leaves(vi[name], name, found);

      for (const [path, text] of found) {
        if (HANGUL.test(text)) {
          offenders.push(`${path} — ${text}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});

/**
 * 사이드바 78개와 셸의 제 이름은 `@omf-mes/i18n` 이 아니라 `nav-tree.ts`·`shell-label.ts` 가
 * 갖는다(그 규칙의 근거는 `nav-tree.ts` 머리말에 있다). **그래서 여기서 따로 잰다** — 위
 * 감지기는 문구 묶음만 훑어 이 78개를 보지 못한다.
 */
describe('베트남어 이름 — 셸이 제 손으로 드는 것', () => {
  const named: LocalizedLabel[] = [...NAV_ENTRIES, ...NAV_GROUPS, SHELL_BRAND, LOCALE_CHOICE];

  it('잴 이름이 있다 — 항목 69 · 묶음 9 · 제품 이름 · 언어칸', () => {
    expect(named).toHaveLength(80);
  });

  /** 빈 `labelVi` 는 베트남어 화면에서 **아무것도 안 보이는 줄**이 된다. 공백만 있는 것도 빈 것이다. */
  it('모든 이름에 베트남어가 있다', () => {
    expect(
      named.filter((entry) => entry.labelVi.trim() === '').map((entry) => entry.label),
    ).toEqual([]);
  });

  /** 옮기다 만 이름 — 한 글자라도 한국어가 남으면 그 줄만 읽히지 않는다. */
  it('베트남어 이름에 한국어가 남지 않는다', () => {
    expect(
      named.filter((entry) => HANGUL.test(entry.labelVi)).map((entry) => entry.labelVi),
    ).toEqual([]);
  });

  /**
   * ⛔ **한국어를 그대로 베껴 두지 않는다.** 위 두 감지기는 `labelVi: 'Routing(공정)'` 같은
   * 것을 잡지만, 한국어가 하나도 없는 이름(`P/O 수신·조회` → `P/O`)을 그대로 복사하면 **찬
   * 것처럼 보인다.** 두 값이 같다는 것은 옮기지 않았다는 뜻이다.
   */
  it('베트남어 이름이 한국어 이름을 베끼지 않았다', () => {
    expect(
      named.filter((entry) => entry.labelVi === entry.label).map((entry) => entry.label),
    ).toEqual([]);
  });
});
