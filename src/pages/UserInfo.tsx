import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import UserInfoPageHeader from '@/components/user-info/UserInfoPageHeader';
import UserInfoProfileCard from '@/components/user-info/UserInfoProfileCard';
import UserInfoAccountDetailsCard from '@/components/user-info/UserInfoAccountDetailsCard';
import UserInfoSecurityCard from '@/components/user-info/UserInfoSecurityCard';
import EmailVerificationDialog from '@/components/auth/EmailVerificationDialog';

const UserInfo = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({
    full_name: '',
    username: '',
    email: '',
    avatar_url: '',
    cover_image_url: '',
  });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  
  // Password change state
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Email verification for password change
  const [showEmailVerification, setShowEmailVerification] = useState(false);
  const [pendingPasswordChange, setPendingPasswordChange] = useState(false);

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
        username: data.username || '',
        email: data.email || user?.email || '',
        avatar_url: data.avatar_url || '',
        cover_image_url: (data as any).cover_image_url || '',
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
      let avatarUrl = profile.avatar_url;

      // Upload avatar if file selected
      if (avatarFile) {
        setUploadingAvatar(true);
        const fileExt = avatarFile.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        // Path format: avatars/{user_id}/{filename} to match storage policy
        const filePath = `avatars/${user?.id}/${fileName}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(filePath, avatarFile, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('product-images')
          .getPublicUrl(filePath);

        avatarUrl = publicUrl;
        setUploadingAvatar(false);
      }

      // Never save base64 data URIs as avatar_url
      const safeAvatarUrl = avatarUrl && !avatarUrl.startsWith('data:') ? avatarUrl : null;

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: profile.full_name,
          username: profile.username || null,
          avatar_url: safeAvatarUrl,
        })
        .eq('id', user?.id);

      if (error) throw error;

      setProfile({ ...profile, avatar_url: avatarUrl });
      setAvatarFile(null);
      toast.success('تم حفظ التغييرات بنجاح');
    } catch (error: any) {
      console.error('Error updating profile:', error);
      if (error.code === '23505') {
        toast.error('اسم المستخدم موجود بالفعل، الرجاء اختيار اسم آخر');
      } else {
        toast.error('حدث خطأ في حفظ التغييرات');
      }
    } finally {
      setSaving(false);
      setUploadingAvatar(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('كلمة المرور الجديدة غير متطابقة');
      return;
    }
    
    if (passwordData.newPassword.length < 6) {
      toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }
    
    // Verify current password first
    setChangingPassword(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password: passwordData.currentPassword,
      });
      
      if (signInError) {
        toast.error('كلمة المرور الحالية غير صحيحة');
        setChangingPassword(false);
        return;
      }
      
      // Show email verification dialog
      setChangingPassword(false);
      setPendingPasswordChange(true);
      setShowEmailVerification(true);
    } catch (error: any) {
      console.error('Error verifying password:', error);
      toast.error('حدث خطأ في التحقق من كلمة المرور');
      setChangingPassword(false);
    }
  };

  const handlePasswordChangeVerified = async () => {
    setChangingPassword(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: passwordData.newPassword,
      });
      
      if (updateError) {
        console.error('Password update error:', updateError);
        toast.error(updateError.message || 'فشل في تحديث كلمة المرور');
        return;
      }
      
      toast.success('تم تغيير كلمة المرور بنجاح');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setShowPasswordForm(false);
    } catch (error: any) {
      console.error('Error changing password:', error);
      toast.error('حدث خطأ في تغيير كلمة المرور');
    } finally {
      setChangingPassword(false);
      setPendingPasswordChange(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background/95 backdrop-blur-sm pt-6">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background/95 backdrop-blur-sm">
      <main className="container mx-auto px-4 pt-6 pb-10 max-w-4xl">
        <UserInfoPageHeader />

        <section className="space-y-6">
          <UserInfoProfileCard
            userId={user?.id}
            profile={profile}
            setProfile={setProfile}
            avatarFile={avatarFile}
            setAvatarFile={setAvatarFile}
            saving={saving}
            uploadingAvatar={uploadingAvatar}
            onSubmit={handleSave}
          />

          <UserInfoAccountDetailsCard userId={user?.id} createdAt={user?.created_at} />

          <UserInfoSecurityCard
            showPasswordForm={showPasswordForm}
            setShowPasswordForm={setShowPasswordForm}
            changingPassword={changingPassword}
            passwordData={passwordData}
            setPasswordData={setPasswordData}
            showCurrentPassword={showCurrentPassword}
            setShowCurrentPassword={setShowCurrentPassword}
            showNewPassword={showNewPassword}
            setShowNewPassword={setShowNewPassword}
            showConfirmPassword={showConfirmPassword}
            setShowConfirmPassword={setShowConfirmPassword}
            onSubmit={handleChangePassword}
          />
        </section>

        {/* Email Verification Dialog for Password Change */}
        <EmailVerificationDialog
          open={showEmailVerification}
          onOpenChange={(open) => {
            setShowEmailVerification(open);
            if (!open) setPendingPasswordChange(false);
          }}
          email={profile.email}
          type="password_change"
          userId={user?.id}
          onVerified={handlePasswordChangeVerified}
        />
      </main>
    </div>
  );
};

export default UserInfo;
