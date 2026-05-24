import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export default function QuestVerifier() {
  const [token, setToken] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(30);
  const [status, setStatus] = useState<'idle' | 'verifying' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('quest_token');
    if (t) setToken(t);
  }, []);

  useEffect(() => {
    if (!token) return;
    if (seconds <= 0) {
      setStatus('verifying');
      supabase.functions
        .invoke('quest-callback', { body: { token } })
        .then(({ data, error }) => {
          if (error) {
            setStatus('error');
            setMessage(error.message ?? 'فشل التحقق');
            return;
          }
          if (data && (data as any).error) {
            setStatus('error');
            setMessage((data as any).error);
            return;
          }
          setStatus('done');
          setMessage('تم التحقق! يمكنك العودة إلى التطبيق واستلام المكافأة.');
        })
        .catch((e) => {
          setStatus('error');
          setMessage(e?.message ?? 'فشل الاتصال');
        });
      return;
    }
    const id = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [token, seconds]);

  if (!token) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
        flexDirection: 'column', gap: 16, fontFamily: 'system-ui', padding: 24, textAlign: 'center',
      }}
    >
      <h2 style={{ margin: 0 }}>التحقق من زيارة Levonisiq</h2>
      {status === 'idle' && (
        <>
          <p>ابقَ في هذه الصفحة {seconds} ثانية لإكمال المهمة.</p>
          <div style={{ width: 240, height: 8, background: '#333', borderRadius: 8, overflow: 'hidden' }}>
            <div
              style={{
                width: `${((30 - seconds) / 30) * 100}%`, height: '100%',
                background: '#22c55e', transition: 'width 0.5s linear',
              }}
            />
          </div>
        </>
      )}
      {status === 'verifying' && <p>جارٍ التحقق...</p>}
      {status === 'done' && <p style={{ color: '#22c55e' }}>{message}</p>}
      {status === 'error' && <p style={{ color: '#ef4444' }}>خطأ: {message}</p>}
    </div>
  );
}
