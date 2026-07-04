import { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { CreditCard, Loader2, CheckCircle2, XCircle, QrCode, Radio, Upload, KeyRound } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

type ErrorKey =
  | 'unauthenticated' | 'invalid_length' | 'invalid_pin' | 'locked'
  | 'not_found' | 'revoked' | 'card_in_use' | 'user_has_card' | 'unknown';

const ERR: Record<ErrorKey, { title: string; desc: string }> = {
  unauthenticated: { title: 'يرجى تسجيل الدخول', desc: 'سجّل الدخول لتفعيل بطاقتك.' },
  invalid_length:  { title: 'رقم غير صحيح', desc: 'رقم البطاقة يجب أن يتكوّن من 16 خانة رقمية.' },
  invalid_pin:     { title: 'PIN غير صحيح', desc: 'الرمز السري 4 أرقام مطبوعة مع البطاقة.' },
  locked:          { title: 'تم قفل البطاقة مؤقتًا', desc: 'تجاوزت عدد المحاولات. حاول بعد 15 دقيقة.' },
  not_found:       { title: 'البطاقة غير موجودة', desc: 'تأكد من الرقم/الرمز أو تواصل مع الدعم.' },
  revoked:         { title: 'البطاقة ملغاة', desc: 'هذه البطاقة تم إلغاؤها من الإدارة.' },
  card_in_use:     { title: 'البطاقة مربوطة بحساب آخر', desc: 'يجب حذفها من الحساب الأول قبل تفعيلها هنا.' },
  user_has_card:   { title: 'لديك بطاقة ليفو فعلاً', desc: 'يحق لكل مستخدم بطاقة ليفو واحدة. احذف الحالية أولاً.' },
  unknown:         { title: 'فشل التفعيل', desc: 'حدث خطأ غير متوقع. حاول مرة أخرى.' },
};

const formatCardNumber = (raw: string) => {
  const digits = raw.replace(/\D/g, '').slice(0, 16);
  return digits.replace(/(.{4})/g, '$1 ').trim();
};

// QR/NFC data may be the raw token (LVQR-… / LVNF-…), a full URL wrapping it,
// or the 16-digit number as a fallback.
type ScannedPayload =
  | { kind: 'qr'; token: string }
  | { kind: 'nfc'; token: string }
  | { kind: 'card'; number: string };

const extractScan = (raw: string): ScannedPayload | null => {
  const s = (raw || '').trim();
  const qrMatch = s.match(/LVQR-[A-Za-z0-9+/=_-]{20,}/);
  if (qrMatch) return { kind: 'qr', token: qrMatch[0] };
  const nfcMatch = s.match(/LVNF-[A-Za-z0-9+/=_-]{20,}/);
  if (nfcMatch) return { kind: 'nfc', token: nfcMatch[0] };
  const digits = s.replace(/\D/g, '');
  if (digits.length === 16) return { kind: 'card', number: digits };
  try {
    const url = new URL(s);
    const c = url.searchParams.get('card') || url.searchParams.get('c');
    if (c && c.replace(/\D/g, '').length === 16) return { kind: 'card', number: c.replace(/\D/g, '') };
  } catch {}
  return null;
};

export default function LevoCardActivator() {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [pin, setPin] = useState('');
  const [scannedToken, setScannedToken] = useState<{ kind: 'qr' | 'nfc'; token: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errKey, setErrKey] = useState<ErrorKey | null>(null);
  const [success, setSuccess] = useState(false);
  const [scannerActive, setScannerActive] = useState(false);
  const [nfcActive, setNfcActive] = useState(false);
  const scannerRef = useRef<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const nfcAbortRef = useRef<AbortController | null>(null);
  const qc = useQueryClient();

  const nfcSupported = typeof window !== 'undefined' && 'NDEFReader' in window;

  // Auto-open + prefill when arriving from approval email link (/rewards?activate=<card>&token=<qr>)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const card = params.get('activate');
    const token = params.get('token');
    if (!card && !token) return;
    setOpen(true);
    if (token && /^LVQR-/.test(token)) {
      setScannedToken({ kind: 'qr', token });
    } else if (card) {
      setValue(formatCardNumber(card));
    }
    // Clear the query so refresh doesn't re-trigger
    params.delete('activate');
    params.delete('token');
    const qs = params.toString();
    const newUrl = window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash;
    window.history.replaceState({}, '', newUrl);
  }, []);

  useEffect(() => {
    if (!open) {
      stopScanner(); stopNfc();
      setValue(''); setPin(''); setScannedToken(null);
      setErrKey(null); setSuccess(false);
    }
  }, [open]);

  const digitsOnly = value.replace(/\D/g, '');
  const canSubmit = pin.length === 4 && (scannedToken !== null || digitsOnly.length === 16);

  const submit = async () => {
    setErrKey(null); setSuccess(false);
    if (pin.length !== 4) { setErrKey('invalid_pin'); return; }
    const payload: any = { p_pin: pin };
    if (scannedToken?.kind === 'qr') payload.p_qr_token = scannedToken.token;
    else if (scannedToken?.kind === 'nfc') payload.p_nfc_token = scannedToken.token;
    else {
      if (digitsOnly.length !== 16) { setErrKey('invalid_length'); return; }
      payload.p_card_number = digitsOnly;
    }
    setSubmitting(true);
    try {
      const { data, error } = await (supabase as any).rpc('levo_activate_card', payload);
      if (error) throw error;
      if (data?.success) {
        setSuccess(true);
        toast.success('تم تفعيل بطاقة ليفو بنجاح');
        qc.invalidateQueries({ queryKey: ['levo-card-my'] });
        qc.invalidateQueries({ queryKey: ['user-active-card-benefits'] });
        setTimeout(() => setOpen(false), 1000);
      } else {
        const key = (data?.error || 'unknown') as ErrorKey;
        setErrKey(ERR[key] ? key : 'unknown');
      }
    } catch (e: any) {
      setErrKey('unknown');
      toast.error(e?.message || 'فشل التفعيل');
    } finally { setSubmitting(false); }
  };

  const applyScan = (raw: string) => {
    const p = extractScan(raw);
    if (!p) { toast.error('محتوى غير صالح'); return; }
    if (p.kind === 'card') { setValue(formatCardNumber(p.number)); setScannedToken(null); }
    else { setScannedToken({ kind: p.kind, token: p.token }); setValue(''); }
    toast.success('تم القراءة — أدخل PIN لإتمام التفعيل');
  };

  const startScanner = async () => {
    stopNfc(); setScannerActive(true);
    await new Promise(r => setTimeout(r, 100));
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const scanner = new Html5Qrcode('levo-qr-scanner');
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decoded) => { applyScan(decoded); stopScanner(); },
        () => {}
      );
    } catch { toast.error('تعذّر فتح الكاميرا'); setScannerActive(false); }
  };

  const stopScanner = async () => {
    if (scannerRef.current) { try { await scannerRef.current.stop(); } catch {} scannerRef.current = null; }
    setScannerActive(false);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const s = new Html5Qrcode('levo-qr-file');
      const result = await s.scanFile(file, true);
      applyScan(result);
    } catch { toast.error('فشل قراءة الصورة'); }
    if (fileRef.current) fileRef.current.value = '';
  };

  const startNfc = async () => {
    if (!nfcSupported) { toast.error('جهازك لا يدعم NFC'); return; }
    stopScanner(); setNfcActive(true);
    try {
      const reader = new (window as any).NDEFReader();
      const ctrl = new AbortController();
      nfcAbortRef.current = ctrl;
      await reader.scan({ signal: ctrl.signal });
      reader.onreading = (ev: any) => {
        for (const record of ev.message.records) {
          const raw = record.data ? new TextDecoder().decode(record.data) : '';
          const p = extractScan(raw) || extractScan(ev.serialNumber || '');
          if (p) { applyScan(raw || ev.serialNumber || ''); stopNfc(); return; }
        }
      };
      toast.info('قرّب البطاقة من الهاتف');
    } catch (e: any) { toast.error(e?.message || 'فشل تشغيل NFC'); setNfcActive(false); }
  };

  const stopNfc = () => {
    if (nfcAbortRef.current) { try { nfcAbortRef.current.abort(); } catch {} nfcAbortRef.current = null; }
    setNfcActive(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Card className="cursor-pointer hover:bg-muted/30 transition-colors">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <CreditCard className="h-5 w-5 text-emerald-600" />
              </div>
              <div className="text-right">
                <p className="font-medium">تفعيل بطاقة ليفو</p>
                <p className="text-xs text-muted-foreground">رقم + PIN، أو QR + PIN، أو NFC + PIN</p>
              </div>
            </div>
            <Button size="sm" variant="outline">تفعيل</Button>
          </CardContent>
        </Card>
      </DialogTrigger>
      <DialogContent className="!overflow-hidden !max-h-none max-w-sm">
        <DialogHeader><DialogTitle>تفعيل بطاقة ليفو</DialogTitle></DialogHeader>
        <div className="space-y-3 overflow-y-auto max-h-[75vh] px-1">
          <p className="text-xs text-muted-foreground leading-relaxed">
            أدخل الرقم (16 خانة) أو امسح QR أو قرّب NFC، ثم أدخل رمز PIN المكوّن من 4 أرقام المطبوع على البطاقة.
          </p>

          {scannedToken ? (
            <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 flex items-center justify-between text-sm">
              <span>تم قراءة {scannedToken.kind === 'qr' ? 'رمز QR' : 'شريحة NFC'} بنجاح</span>
              <Button size="sm" variant="ghost" onClick={() => setScannedToken(null)}>مسح</Button>
            </div>
          ) : (
            <Input
              value={value}
              onChange={e => { setValue(formatCardNumber(e.target.value)); if (errKey || success) { setErrKey(null); setSuccess(false); } }}
              placeholder="1234 5678 9012 3456"
              inputMode="numeric"
              className={`font-mono tracking-widest text-center text-lg ${errKey === 'invalid_length' ? 'border-destructive' : ''}`}
              disabled={submitting || success}
            />
          )}

          <div className="grid grid-cols-3 gap-2">
            <Button type="button" variant="outline" size="sm" onClick={scannerActive ? stopScanner : startScanner}
              disabled={submitting || success} className="text-xs">
              <QrCode className="h-4 w-4 ml-1" />{scannerActive ? 'إيقاف' : 'مسح QR'}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}
              disabled={submitting || success} className="text-xs">
              <Upload className="h-4 w-4 ml-1" /> صورة
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={nfcActive ? stopNfc : startNfc}
              disabled={submitting || success || !nfcSupported} className="text-xs"
              title={nfcSupported ? 'قرّب البطاقة' : 'الجهاز لا يدعم NFC'}>
              <Radio className="h-4 w-4 ml-1" />{nfcActive ? 'إيقاف' : 'NFC'}
            </Button>
          </div>

          <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleFile} />
          <div id="levo-qr-file" style={{ display: 'none' }} />
          {scannerActive && (<div className="rounded-lg overflow-hidden border"><div id="levo-qr-scanner" style={{ width: '100%' }} /></div>)}
          {nfcActive && (
            <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin text-primary" /> قرّب البطاقة من الهاتف الآن…
            </div>
          )}

          {/* PIN — always required */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground flex items-center gap-1">
              <KeyRound className="h-3.5 w-3.5" /> رمز PIN (4 أرقام)
            </label>
            <Input
              value={pin}
              onChange={e => { setPin(e.target.value.replace(/\D/g, '').slice(0, 4)); if (errKey === 'invalid_pin') setErrKey(null); }}
              placeholder="••••"
              inputMode="numeric"
              maxLength={4}
              className={`font-mono tracking-[0.6em] text-center text-lg ${errKey === 'invalid_pin' ? 'border-destructive' : ''}`}
              disabled={submitting || success}
              onKeyDown={e => { if (e.key === 'Enter' && canSubmit && !submitting) submit(); }}
            />
          </div>

          {success && (
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
              <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">تم تفعيل البطاقة بنجاح</p>
            </div>
          )}
          {errKey && !success && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 flex items-start gap-2">
              <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <div className="text-right">
                <p className="text-sm font-semibold text-destructive">{ERR[errKey].title}</p>
                <p className="text-xs text-destructive/90 mt-0.5">{ERR[errKey].desc}</p>
              </div>
            </div>
          )}

          <Button className="w-full" onClick={submit} disabled={submitting || success || !canSubmit}>
            {submitting ? (<><Loader2 className="h-4 w-4 animate-spin ml-2" /> جاري التفعيل…</>)
             : success ? (<><CheckCircle2 className="h-4 w-4 ml-2" /> تم التفعيل</>)
             : 'تفعيل البطاقة'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
