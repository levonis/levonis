import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { z } from 'zod';

const IRAQI_GOVERNORATES = [
  'بغداد',
  'البصرة',
  'نينوى',
  'أربيل',
  'النجف',
  'كربلاء',
  'بابل',
  'الأنبار',
  'ديالى',
  'ذي قار',
  'المثنى',
  'القادسية',
  'ميسان',
  'واسط',
  'صلاح الدين',
  'كركوك',
  'السليمانية',
  'دهوك',
];

const authSchema = z.object({
  email: z.string().email({ message: 'بريد إلكتروني غير صحيح' }),
  password: z.string().min(6, { message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' }),
  fullName: z.string().optional(),
  phoneNumber: z.string().regex(/^07[3-9]\d{8}$/, { message: 'رقم الهاتف يجب أن يبدأ بـ 07 ويتكون من 11 رقماً' }).optional(),
  governorate: z.string().optional(),
});

const Auth = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [governorate, setGovernorate] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validatedData = authSchema.parse({ email, password });
      
      const { error } = await supabase.auth.signInWithPassword({
        email: validatedData.email,
        password: validatedData.password,
      });

      if (error) {
        if (error.message.includes('Invalid')) {
          toast.error('البريد الإلكتروني أو كلمة المرور غير صحيحة');
        } else {
          toast.error(error.message);
        }
        return;
      }

      toast.success('تم تسجيل الدخول بنجاح');
      navigate('/');
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error('حدث خطأ غير متوقع');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validatedData = authSchema.parse({ 
        email, 
        password, 
        fullName, 
        phoneNumber: phoneNumber || undefined,
        governorate: governorate || undefined
      });
      
      const redirectUrl = `${window.location.origin}/`;
      
      const { error } = await supabase.auth.signUp({
        email: validatedData.email,
        password: validatedData.password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: validatedData.fullName || '',
            phone_number: validatedData.phoneNumber || '',
            governorate: validatedData.governorate || '',
          }
        }
      });

      if (error) {
        if (error.message.includes('already registered')) {
          toast.error('هذا البريد الإلكتروني مسجل بالفعل');
        } else {
          toast.error(error.message);
        }
        return;
      }

      toast.success('تم إنشاء الحساب بنجاح! يمكنك تسجيل الدخول الآن');
      navigate('/');
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error('حدث خطأ غير متوقع');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validatedEmail = z.string().email().parse(resetEmail);
      const redirectUrl = `${window.location.origin}/auth`;
      
      const { error } = await supabase.auth.resetPasswordForEmail(validatedEmail, {
        redirectTo: redirectUrl,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success('تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني');
      setShowResetPassword(false);
      setResetEmail('');
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error('بريد إلكتروني غير صحيح');
      } else {
        toast.error('حدث خطأ غير متوقع');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background/90 backdrop-blur-md relative overflow-hidden flex items-center justify-center p-4">
      {/* Full page decorative border with animations */}
      <div 
        className="fixed top-0 left-0 right-0 bottom-0 pointer-events-none z-0 opacity-10 animate-float-decoration"
        style={{
          backgroundImage: 'url(/images/decorative-border-new.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'top center',
          backgroundRepeat: 'no-repeat',
        }}
      />
      
      {/* Elegant decorative frame */}
      <div className="fixed inset-0 pointer-events-none">
        <svg className="absolute top-0 right-0 w-96 h-96 opacity-10" viewBox="0 0 200 200">
          <path d="M10,10 Q50,10 50,50 L50,150 Q50,190 90,190" 
                stroke="hsl(var(--ring) / 0.5)" strokeWidth="1" fill="none" />
        </svg>
        <svg className="absolute bottom-0 left-0 w-80 h-80 opacity-10" viewBox="0 0 200 200">
          <circle cx="100" cy="100" r="70" stroke="hsl(var(--primary) / 0.4)" strokeWidth="0.5" fill="none" />
        </svg>
      </div>
      
      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black text-gradient-gold mb-2">LEVONIS</h1>
          <p className="text-muted-foreground">مرحباً بك في متجرنا</p>
        </div>

        <div className="glass-effect rounded-2xl p-6 border border-border/50 shadow-2xl">
          {showResetPassword ? (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-black text-gradient-gold mb-2">إعادة تعيين كلمة المرور</h2>
                <p className="text-sm text-muted-foreground">أدخل بريدك الإلكتروني لإرسال رابط إعادة التعيين</p>
              </div>
              
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">البريد الإلكتروني</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    placeholder="your@email.com"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Button 
                    type="submit" 
                    className="w-full bg-gradient-to-b from-primary to-accent text-primary-foreground hover:opacity-90"
                    disabled={loading}
                  >
                    {loading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                    إرسال رابط إعادة التعيين
                  </Button>
                  
                  <Button 
                    type="button"
                    variant="ghost"
                    className="w-full"
                    onClick={() => {
                      setShowResetPassword(false);
                      setResetEmail('');
                    }}
                    disabled={loading}
                  >
                    العودة لتسجيل الدخول
                  </Button>
                </div>
              </form>
            </div>
          ) : (
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="signin">تسجيل الدخول</TabsTrigger>
                <TabsTrigger value="signup">إنشاء حساب</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">البريد الإلكتروني</Label>
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={loading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signin-password">كلمة المرور</Label>
                    <Input
                      id="signin-password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={loading}
                    />
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full bg-gradient-to-b from-primary to-accent text-primary-foreground hover:opacity-90"
                    disabled={loading}
                  >
                    {loading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                    تسجيل الدخول
                  </Button>

                  <Button 
                    type="button"
                    variant="link"
                    className="w-full text-sm text-muted-foreground hover:text-primary"
                    onClick={() => setShowResetPassword(true)}
                    disabled={loading}
                  >
                    هل نسيت كلمة المرور؟
                  </Button>
                </form>
              </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">الاسم الكامل</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="محمد أحمد"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-phone">رقم الهاتف</Label>
                  <Input
                    id="signup-phone"
                    type="tel"
                    placeholder="07XXXXXXXXX"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    disabled={loading}
                    maxLength={11}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-governorate">المحافظة</Label>
                  <Select 
                    value={governorate} 
                    onValueChange={setGovernorate}
                    disabled={loading}
                  >
                    <SelectTrigger id="signup-governorate">
                      <SelectValue placeholder="اختر المحافظة" />
                    </SelectTrigger>
                    <SelectContent>
                      {IRAQI_GOVERNORATES.map((gov) => (
                        <SelectItem key={gov} value={gov}>
                          {gov}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-email">البريد الإلكتروني</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-password">كلمة المرور</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>

                <Button 
                  type="submit" 
                  className="w-full bg-gradient-to-b from-primary to-accent text-primary-foreground hover:opacity-90"
                  disabled={loading}
                >
                  {loading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                  إنشاء حساب
                </Button>
              </form>
            </TabsContent>
            </Tabs>
          )}
        </div>
      </div>
    </div>
  );
};

export default Auth;