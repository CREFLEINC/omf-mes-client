import { messages } from '@omf-mes/i18n';
import { Link } from 'react-router';

// Capacitor 셸에는 주소창이 없어 링크가 없으면 붙인 화면을 열 수단이 없다.
export const ShellHome = () => {
  return (
    <nav aria-label="화면 목록">
      <ul>
        <li>
          <Link to="/inbound-receipt">{messages.inboundReceipt.title}</Link>
        </li>
        <li>
          <Link to="/putaway">{messages.putaway.title}</Link>
        </li>
        <li>
          <Link to="/material-location">{messages.materialLocation.title}</Link>
        </li>
        <li>
          <Link to="/equipment-failure">{messages.equipmentFailureReport.title}</Link>
        </li>
        <li>
          <Link to="/equipment-inspection">{messages.equipmentInspection.title}</Link>
        </li>
        <li>
          <Link to="/iqc-skip-request">{messages.iqcSkipRequest.title}</Link>
        </li>
        <li>
          <Link to="/repair-roundtrip">{messages.repairRoundtrip.title}</Link>
        </li>
        <li>
          <Link to="/product-picking">{messages.productPicking.title}</Link>
        </li>
        <li>
          <Link to="/rejections">{messages.outboxRejections.title}</Link>
        </li>
      </ul>
    </nav>
  );
};
