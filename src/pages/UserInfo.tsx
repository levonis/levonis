import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, User, Mail, Calendar, Shield } from 'lucide-react';
import { toast } from 'sonner';

const UserInfo = () => {
  const { user, loading: authLoading, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({
    full_name: '',
    email: '',
  });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
      return;
    }

    if (user) {
      fetchProfile();
    }
  }, [user, authLoading, navigate]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user?.id)
        .single();

      if (error) throw error;

      setProfile({
        full_name: data.full_name || '',
        email: data.email || user?.email || '',
      });
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast.error('حدث خطأ في تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: profile.full_name,
        })
        .eq('id', user?.id);

      if (error) throw error;

      toast.success('تم حفظ التغييرات بنجاح');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('حدث خطأ في حفظ التغييرات');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background/95 backdrop-blur-sm pt-24">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background/95 backdrop-blur-sm relative overflow-hidden">
      {/* Decorative elements */}
      <div className="fixed top-20 right-20 w-64 h-64 pointer-events-none opacity-10 animate-float">
        <svg viewBox="0 0 200 200" className="w-full h-full">
          <circle cx="100" cy="100" r="80" stroke="hsl(var(--primary) / 0.3)" strokeWidth="0.5" fill="none" />
          <circle cx="100" cy="100" r="60" stroke="hsl(var(--ring) / 0.2)" strokeWidth="0.5" fill="none" />
        </svg>
      </div>

      <main className="container mx-auto px-4 py-8 pt-24 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-4xl font-black text-primary mb-2">معلومات الحساب</h1>
          <p className="text-muted-foreground">إدارة معلومات حسابك الشخصية</p>
        </div>

        <div className="space-y-6">
          {/* User Info Card */}
          <Card className="glass-effect border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                معلومات الحساب
              </CardTitle>
              <CardDescription>
                قم بتحديث معلوماتك الشخصية
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSave} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="full_name">الاسم الكامل</Label>
                  <Input
                    id="full_name"
                    value={profile.full_name}
                    onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                    placeholder="أدخل اسمك الكامل"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">البريد الإلكتروني</Label>
                  <div className="relative">
                    <Mail className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      value={profile.email}
                      disabled
                      className="pr-10 bg-muted/50"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    لا يمكن تغيير البريد الإلكتروني
                  </p>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-gradient-to-b from-primary to-accent text-primary-foreground hover:opacity-90"
                  disabled={saving}
                >
                  {saving && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                  حفظ التغييرات
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Account Details Card */}
          <Card className="glass-effect border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                تفاصيل الحساب
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-border/30">
                <span className="text-muted-foreground">نوع الحساب</span>
                <div className="flex items-center gap-2">
                  {isAdmin && <Shield className="h-4 w-4 text-primary" />}
                  <span className="font-medium text-foreground">
                    {isAdmin ? 'مدير' : 'مستخدم'}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-border/30">
                <span className="text-muted-foreground">معرف المستخدم</span>
                <span className="font-mono text-xs text-foreground">{user?.id.slice(0, 8)}...</span>
              </div>

              <div className="flex items-center justify-between py-2">
                <span className="text-muted-foreground">تاريخ الإنشاء</span>
                <span className="font-medium text-foreground">
                  {user?.created_at ? new Date(user.created_at).toLocaleDateString('ar-SA') : '-'}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Security Card */}
          <Card className="glass-effect border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                الأمان
              </CardTitle>
              <CardDescription>
                إدارة إعدادات الأمان الخاصة بك
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => toast.info('ميزة تغيير كلمة المرور قريباً')}
              >
                تغيير كلمة المرور
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default UserInfo;
