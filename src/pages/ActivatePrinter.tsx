import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

// Redirects QR code scans to the rewards insurance activation tab
const ActivatePrinter = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  useEffect(() => {
    const serial = searchParams.get('serial');
    const params = new URLSearchParams({ tab: 'insurance', sub: 'activate' });
    if (serial) params.set('serial', serial);
    navigate(`/rewards?${params.toString()}`, { replace: true });
  }, [navigate, searchParams]);

  return null;
};

export default ActivatePrinter;
