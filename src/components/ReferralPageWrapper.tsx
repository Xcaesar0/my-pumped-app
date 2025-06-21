import { useParams } from 'react-router-dom';
import ReferralPage from './ReferralPage';

const ReferralPageWrapper = () => {
  const { referralCode } = useParams();
  if (!referralCode) return null;
  return <ReferralPage referralCode={referralCode} />;
};

export default ReferralPageWrapper; 