import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { z } from 'zod';

const authSchema = z.object({
  email: z.string().email({ message: 'بريد إلكتروني غير صحيح' }),
  password: z.string().min(6, { message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' }),
  fullName: z.string().optional(),
});

const Auth = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
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
      const validatedData = authSchema.parse({ email, password, fullName });
      
      const redirectUrl = `${window.location.origin}/`;
      
      const { error } = await supabase.auth.signUp({
        email: validatedData.email,
        password: validatedData.password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: validatedData.fullName || '',
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

  return (
    <div className="min-h-screen bg-background/90 backdrop-blur-md relative overflow-hidden flex items-center justify-center p-4">
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
        </div>
      </div>
    </div>
  );
};

export default Auth;