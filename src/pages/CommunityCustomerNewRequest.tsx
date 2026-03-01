import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Image as ImageIcon, Link2, Plus, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';

type LinkItem = { id: string; url: string };

function safeId() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export default function CommunityCustomerNewRequest() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [size, setSize] = useState('');
  const [colors, setColors] = useState('');

  const [hasReferenceLinks, setHasReferenceLinks] = useState(false);
  const [links, setLinks] = useState<LinkItem[]>([{ id: safeId(), url: '' }]);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const imagePreviewUrl = useMemo(() => {
    if (!imageFile) return null;
    return URL.createObjectURL(imageFile);
  }, [imageFile]);

  useEffect(() => {
    const t = window.setTimeout(() => setLoading(false), 250);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [imagePreviewUrl]);

  const addLink = () => setLinks((prev) => [...prev, { id: safeId(), url: '' }]);
  const removeLink = (id: string) => setLinks((prev) => prev.filter((l) => l.id !== id));
  const updateLink = (id: string, url: string) =>
    setLinks((prev) => prev.map((l) => (l.id === id ? { ...l, url } : l)));

  return (
    <div className="min-h-screen bg-background/95 backdrop-blur-sm">
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <header className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-primary">إضافة طلب جديد</h1>
            <p className="text-sm text-muted-foreground">واجهة مبدئية فقط — لاحقاً نربطها بالإرسال والمراجعة.</p>
          </div>

          <Button variant="outline" onClick={() => navigate(-1)} className="gap-2">
            <ArrowRight className="h-4 w-4" />
            رجوع
          </Button>
        </header>

        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle>معلومات الطلب</CardTitle>
            <CardDescription>أدخل التفاصيل الأساسية للطلب</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {loading ? (
              <div className="space-y-3">
                <div className="h-10 rounded-xl bg-muted animate-pulse" />
                <div className="h-24 rounded-xl bg-muted animate-pulse" />
                <div className="h-10 rounded-xl bg-muted animate-pulse" />
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>الصورة</Label>
                  <div className="rounded-2xl border border-border bg-background/40 p-4">
                    <div className="flex flex-col md:flex-row gap-4 md:items-center">
                      <div className="flex-1">
                        <Input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] ?? null)} />
                        <p className="mt-2 text-xs text-muted-foreground">مطلوب لاحقاً عند الإرسال</p>
                      </div>

                      <div className="w-full md:w-56">
                        {imagePreviewUrl ? (
                          <img
                            src={imagePreviewUrl}
                            alt="معاينة الصورة"
                            className="h-32 w-full rounded-xl object-cover border border-border"
                            loading="lazy"
                          />
                        ) : (
                          <div className="h-32 w-full rounded-xl border border-border bg-muted/30 flex items-center justify-center">
                            <ImageIcon className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">العنوان الرئيسي</Label>
                    <Input
                      id="title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      maxLength={120}
                      placeholder="مثال: طباعة مجسم شخصية"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="size">الحجم</Label>
                    <Input id="size" value={size} onChange={(e) => setSize(e.target.value)} maxLength={80} placeholder="مثال: 10 سم / 15×10×8" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">الوصف</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    maxLength={1500}
                    placeholder="اكتب وصف الطلب..."
                    className="min-h-28"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="colors">الألوان</Label>
                    <Input id="colors" value={colors} onChange={(e) => setColors(e.target.value)} maxLength={120} placeholder="مثال: أسود، أبيض" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes">الملاحظات</Label>
                    <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={200} placeholder="أي ملاحظات إضافية..." />
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-background/40 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <Link2 className="h-4 w-4 text-primary" />
                        <p className="font-bold text-foreground">هل لديك رابط تريد أن تكون الطباعة مثلها؟</p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">يمكنك إضافة أكثر من رابط</p>
                    </div>
                    <Switch checked={hasReferenceLinks} onCheckedChange={setHasReferenceLinks} />
                  </div>

                  {hasReferenceLinks && (
                    <div className="mt-4 space-y-3">
                      {links.map((l, idx) => (
                        <div key={l.id} className="flex items-center gap-2">
                          <Input
                            value={l.url}
                            onChange={(e) => updateLink(l.id, e.target.value)}
                            maxLength={500}
                            placeholder={`رابط ${idx + 1}`}
                            inputMode="url"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => removeLink(l.id)}
                            disabled={links.length === 1}
                            aria-label="حذف الرابط"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}

                      <Button type="button" variant="outline" onClick={addLink} className="gap-2">
                        <Plus className="h-4 w-4" />
                        إضافة رابط آخر
                      </Button>
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-border bg-muted/20 p-4">
                  <p className="text-sm text-muted-foreground">
                    عند التفعيل: بعد أي تعديل أو إضافة، سيظهر تنبيه: "سيتم مراجعة طلبك من قبل الإدارة".
                  </p>
                </div>

                <Button
                  type="button"
                  disabled
                  className="w-full bg-gradient-to-b from-primary to-accent text-primary-foreground"
                  title="سيتم تفعيل الإرسال لاحقاً"
                >
                  إرسال الطلب (قريباً)
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
