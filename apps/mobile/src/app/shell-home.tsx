import { Card } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { Link } from 'react-router';

import './shell-home.css';

/**
 * 화면 목록.
 *
 * 관리웹은 좌측 레일로 옮겨 다니지만 이 셸은 그 자리를 두지 않는다 - 폭이 좁고 한 손으로
 * 장갑을 낀 채 쓰므로, 설계가 모바일의 위치를 스캔 퍼스트 홈 아래 도메인 타일로 정했다.
 *
 * 글자 링크로 두지 않는다 - 기본 링크는 글자 높이만큼만 눌리고 그 높이는 손가락보다 작다.
 */
const groups = [
  {
    label: messages.shellHome.groups.warehouse,
    tiles: [
      { to: '/inbound-receipt', label: messages.inboundReceipt.title },
      { to: '/inbound-variance', label: messages.inboundVariance.title },
      { to: '/putaway', label: messages.putaway.title },
      { to: '/material-location', label: messages.materialLocation.title },
      { to: '/iqc-skip-request', label: messages.iqcSkipRequest.title },
    ],
  },
  {
    label: messages.shellHome.groups.production,
    tiles: [{ to: '/repair-roundtrip', label: messages.repairRoundtrip.title }],
  },
  {
    label: messages.shellHome.groups.shipment,
    tiles: [{ to: '/product-picking', label: messages.productPicking.title }],
  },
  {
    label: messages.shellHome.groups.equipment,
    tiles: [
      { to: '/equipment-failure', label: messages.equipmentFailureReport.title },
      { to: '/equipment-inspection', label: messages.equipmentInspection.title },
    ],
  },
  {
    label: messages.shellHome.groups.common,
    tiles: [{ to: '/rejections', label: messages.outboxRejections.title }],
  },
];

export const ShellHome = () => {
  return (
    <nav aria-label={messages.shellHome.label} className="shell-home">
      {groups.map((group) => (
        <section key={group.label} className="shell-home__group">
          <h2>{group.label}</h2>
          <ul className="shell-home__tiles">
            {group.tiles.map((tile) => (
              <li key={tile.to}>
                <Link to={tile.to} className="shell-home__tile">
                  <Card bordered>
                    <Card.Body>
                      <strong>{tile.label}</strong>
                    </Card.Body>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </nav>
  );
};
