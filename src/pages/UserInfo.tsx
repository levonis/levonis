import { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, User, Mail, Calendar, Shield, Camera, Lock, Eye, EyeOff, Heart, ShoppingCart, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatDate, formatPrice } from '@/lib/utils';
import LevelBadge from '@/components/LevelBadge';
import { useCart } from '@/hooks/useCart';

interface FavoriteProduct {
  id: string;
  product_id: string;
  products: {
    id: string;
    name_ar: string;
    slug: string;
    price: number;
    currency: string;
    image_url: string | null;
    images: string[] | null;
    in_stock: boolean;
  };
}

const UserInfo = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { addToCart } = useCart();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({
    full_name: '',
    username: '',
    email: '',
    avatar_url: '',
  });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  
  // Favorites state
  const [favorites, setFavorites] = useState<FavoriteProduct[]>([]);
  const [loadingFavorites, setLoadingFavorites] = useState(true);
  
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

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
      return;
    }

    if (user) {
      fetchProfile();
      fetchFavorites();
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
      });
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast.error('حدث خطأ في تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  const fetchFavorites = async () => {
    try {
      const { data, error } = await supabase
        .from('favorites')
        .select(`
          id,
          product_id,
          products (
            id,
            name_ar,
            slug,
            price,
            currency,
            image_url,
            images,
            in_stock
          )
        `)
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFavorites(data || []);
    } catch (error) {
      console.error('Error fetching favorites:', error);
    } finally {
      setLoadingFavorites(false);
    }
  };

  const handleRemoveFavorite = async (favoriteId: string) => {
    try {
      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('id', favoriteId);

      if (error) throw error;

      setFavorites(favorites.filter(fav => fav.id !== favoriteId));
      toast.success('تم حذف المنتج من المفضلة');
    } catch (error) {
      console.error('Error removing favorite:', error);
      toast.error('حدث خطأ في حذف المنتج');
    }
  };

  const handleAddToCart = (productId: string) => {
    addToCart(productId);
    toast.success('تم إضافة المنتج إلى السلة');
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
        const fileName = `${user?.id}-${Date.now()}.${fileExt}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(`avatars/${fileName}`, avatarFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('product-images')
          .getPublicUrl(`avatars/${fileName}`);

        avatarUrl = publicUrl;
        setUploadingAvatar(false);
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: profile.full_name,
          username: profile.username || null,
          avatar_url: avatarUrl || null,
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
    
    setChangingPassword(true);
    
    try {
      // First verify the current password by trying to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password: passwordData.currentPassword,
      });
      
      if (signInError) {
        toast.error('كلمة المرور الحالية غير صحيحة');
        setChangingPassword(false);
        return;
      }
      
      // Update the password
      const { error: updateError } = await supabase.auth.updateUser({
        password: passwordData.newPassword,
      });
      
      if (updateError) throw updateError;
      
      toast.success('تم تغيير كلمة المرور بنجاح');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setShowPasswordForm(false);
    } catch (error: any) {
      console.error('Error changing password:', error);
      toast.error('حدث خطأ في تغيير كلمة المرور');
    } finally {
      setChangingPassword(false);
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
    <div className="min-h-screen bg-background/95 backdrop-blur-sm">
      <main className="container mx-auto px-4 py-8 pt-24 max-w-4xl">
        <div className="mb-6">
          <h1 className="text-3xl sm:text-4xl font-black text-primary mb-2">حسابي</h1>
          <p className="text-muted-foreground text-sm sm:text-base">إدارة حسابك ومفضلتك</p>
        </div>

        <Tabs defaultValue={searchParams.get('tab') === 'favorites' || location.pathname === '/favorites' ? 'favorites' : 'profile'} className="w-full" dir="rtl">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span className="text-xs sm:text-sm">معلومات الحساب</span>
            </TabsTrigger>
            <TabsTrigger value="favorites" className="flex items-center gap-2">
              <Heart className="h-4 w-4" />
              <span className="text-xs sm:text-sm">المفضلة</span>
              {favorites.length > 0 && (
                <span className="bg-primary/20 text-primary text-xs px-1.5 py-0.5 rounded-full">
                  {favorites.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-6">
            {/* User Info Card */}
            <Card className="glass-effect border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <User className="h-5 w-5 text-primary" />
                  معلومات الحساب
                </CardTitle>
                <CardDescription>
                  قم بتحديث معلوماتك الشخصية
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSave} className="space-y-4">
                  {/* Avatar Upload */}
                  <div className="flex flex-col items-center gap-4 pb-6 border-b border-border/30">
                    <div className="flex flex-col items-center gap-2">
                      <Avatar className="h-20 w-20 sm:h-24 sm:w-24">
                        <AvatarImage 
                          src={avatarFile ? URL.createObjectURL(avatarFile) : profile.avatar_url || undefined} 
                        />
                        <AvatarFallback className="text-xl sm:text-2xl">
                          {profile.username?.[0] || profile.full_name?.[0] || 'م'}
                        </AvatarFallback>
                      </Avatar>
                      {user?.id && <LevelBadge userId={user.id} size="lg" />}
                    </div>
                    <div>
                      <Input
                        id="avatar"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files?.[0]) {
                            setAvatarFile(e.target.files[0]);
                          }
                        }}
                      />
                      <Label htmlFor="avatar" className="cursor-pointer">
                        <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors">
                          <Camera className="h-4 w-4" />
                          <span className="text-sm">تغيير الصورة</span>
                        </div>
                      </Label>
                    </div>
                  </div>

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
                    <Label htmlFor="username">اسم المستخدم</Label>
                    <Input
                      id="username"
                      value={profile.username}
                      onChange={(e) => setProfile({ ...profile, username: e.target.value })}
                      placeholder="اختر اسم مستخدم فريد"
                    />
                    <p className="text-xs text-muted-foreground">
                      يستخدم للبحث في قائمة الطلبات وظهوره في التقييمات
                    </p>
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
                    disabled={saving || uploadingAvatar}
                  >
                    {(saving || uploadingAvatar) && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                    {uploadingAvatar ? 'جاري رفع الصورة...' : 'حفظ التغييرات'}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Account Details Card */}
            <Card className="glass-effect border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <Calendar className="h-5 w-5 text-primary" />
                  تفاصيل الحساب
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-border/30">
                  <span className="text-muted-foreground text-sm">مستوى العضوية</span>
                  <div className="flex items-center gap-2">
                    {user?.id && <LevelBadge userId={user.id} size="md" />}
                  </div>
                </div>

                <div className="flex items-center justify-between py-2">
                  <span className="text-muted-foreground text-sm">تاريخ الإنشاء</span>
                  <span className="font-medium text-foreground text-sm">
                    {user?.created_at ? formatDate(user.created_at) : '-'}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Security Card */}
            <Card className="glass-effect border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <Shield className="h-5 w-5 text-primary" />
                  الأمان
                </CardTitle>
                <CardDescription>
                  إدارة إعدادات الأمان الخاصة بك
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!showPasswordForm ? (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setShowPasswordForm(true)}
                  >
                    <Lock className="ml-2 h-4 w-4" />
                    تغيير كلمة المرور
                  </Button>
                ) : (
                  <form onSubmit={handleChangePassword} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="currentPassword">كلمة المرور الحالية</Label>
                      <div className="relative">
                        <Input
                          id="currentPassword"
                          type={showCurrentPassword ? 'text' : 'password'}
                          value={passwordData.currentPassword}
                          onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                          placeholder="أدخل كلمة المرور الحالية"
                          required
                          className="pl-10"
                        />
                        <button
                          type="button"
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        >
                          {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="newPassword">كلمة المرور الجديدة</Label>
                      <div className="relative">
                        <Input
                          id="newPassword"
                          type={showNewPassword ? 'text' : 'password'}
                          value={passwordData.newPassword}
                          onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                          placeholder="أدخل كلمة المرور الجديدة"
                          required
                          minLength={6}
                          className="pl-10"
                        />
                        <button
                          type="button"
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                        >
                          {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">تأكيد كلمة المرور الجديدة</Label>
                      <div className="relative">
                        <Input
                          id="confirmPassword"
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={passwordData.confirmPassword}
                          onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                          placeholder="أعد إدخال كلمة المرور الجديدة"
                          required
                          minLength={6}
                          className="pl-10"
                        />
                        <button
                          type="button"
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        >
                          {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        type="submit"
                        className="flex-1"
                        disabled={changingPassword}
                      >
                        {changingPassword && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                        حفظ كلمة المرور
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setShowPasswordForm(false);
                          setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                        }}
                        disabled={changingPassword}
                      >
                        إلغاء
                      </Button>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Favorites Tab */}
          <TabsContent value="favorites">
            {loadingFavorites ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : favorites.length === 0 ? (
              <Card className="glass-effect border-border/50">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Heart className="h-12 w-12 text-muted-foreground/30 mb-4" />
                  <h3 className="text-lg font-bold text-foreground mb-2">لا توجد منتجات مفضلة</h3>
                  <p className="text-muted-foreground text-sm mb-4">ابدأ بإضافة منتجات لمفضلتك</p>
                  <Button onClick={() => navigate('/')} size="sm">
                    تصفح المنتجات
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                {favorites.map((favorite) => {
                  const product = favorite.products;
                  const productImage = product.images?.[0] || product.image_url;
                  const currency = product.currency || 'دينار عراقي';

                  return (
                    <Card key={favorite.id} className="glass-effect border-border/50 overflow-hidden group">
                      <div className="relative aspect-square bg-card/50">
                        {productImage ? (
                          <img
                            src={productImage}
                            alt={product.name_ar}
                            className="w-full h-full object-cover cursor-pointer"
                            onClick={() => navigate(`/product/${product.slug}`)}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Heart className="w-10 h-10 text-muted-foreground/30" />
                          </div>
                        )}
                        <Button
                          size="icon"
                          variant="destructive"
                          className="absolute top-1.5 left-1.5 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleRemoveFavorite(favorite.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <CardContent className="p-2.5 sm:p-3">
                        <h3
                          className="font-bold text-foreground text-xs sm:text-sm mb-1.5 line-clamp-2 cursor-pointer hover:text-primary transition-colors"
                          onClick={() => navigate(`/product/${product.slug}`)}
                        >
                          {product.name_ar}
                        </h3>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm sm:text-base font-black text-primary">
                            {formatPrice(Number(product.price))}
                          </span>
                        </div>
                        <Button
                          className="w-full h-8 text-xs bg-gradient-to-b from-primary to-accent text-primary-foreground hover:opacity-90"
                          onClick={() => handleAddToCart(product.id)}
                          disabled={!product.in_stock}
                        >
                          <ShoppingCart className="ml-1.5 h-3.5 w-3.5" />
                          {product.in_stock ? 'أضف للسلة' : 'غير متوفر'}
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default UserInfo;
