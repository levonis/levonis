import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Sparkles, Plus, X, Upload, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface ManualProductInputProps {
  onExtracted: (productInfo: any) => void;
  onCancel: () => void;
  itemId?: string;
  platform?: string;
}

export function ManualProductInput({ onExtracted, onCancel, itemId, platform }: ManualProductInputProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [title, setTitle] = useState('');
  const [colors, setColors] = useState('');
  const [sizes, setSizes] = useState('');
  const [features, setFeatures] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>(['']);

  const handleAddImage = () => {
    setImageUrls([...imageUrls, '']);
  };

  const handleRemoveImage = (index: number) => {
    setImageUrls(imageUrls.filter((_, i) => i !== index));
  };

  const handleImageChange = (index: number, value: string) => {
    const newUrls = [...imageUrls];
    newUrls[index] = value;
    setImageUrls(newUrls);
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error('يرجى إدخال عنوان المنتج');
      return;
    }

    setIsProcessing(true);

    try {
      const { data, error } = await supabase.functions.invoke('extract-product-info', {
        body: {
          manualData: {
            title: title.trim(),
            colors: colors.trim(),
            sizes: sizes.trim(),
            features: features.trim(),
            images: imageUrls.filter(url => url.trim())
          }
        }
      });

      if (error) throw error;

      if (data?.success && data?.productInfo) {
        toast.success('تم معالجة البيانات بنجاح');
        onExtracted(data.productInfo);
      } else {
        throw new Error(data?.error || 'فشل في معالجة البيانات');
      }
    } catch (error) {
      console.error('Error processing manual data:', error);
      toast.error('حدث خطأ أثناء معالجة البيانات');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className="border-orange-200 bg-orange-50/30 dark:bg-orange-950/10 dark:border-orange-800">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-orange-500" />
          إدخال بيانات المنتج يدوياً
        </CardTitle>
        <CardDescription>
          Taobao يحظر الوصول التلقائي. انسخ البيانات من صفحة المنتج وسنترجمها تلقائياً.
          {itemId && (
            <span className="block mt-1 text-xs font-mono">
              معرف المنتج: {itemId} • المنصة: {platform || 'taobao'}
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Title */}
        <div className="space-y-2">
          <Label htmlFor="manual-title">
            عنوان المنتج <span className="text-red-500">*</span>
          </Label>
          <Textarea
            id="manual-title"
            placeholder="انسخ عنوان المنتج من Taobao (بالصينية أو الإنجليزية)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            rows={2}
          />
          <p className="text-xs text-muted-foreground">
            مثال: 电动牙刷架壁挂式免打孔卫生间置物架
          </p>
        </div>

        {/* Colors */}
        <div className="space-y-2">
          <Label htmlFor="manual-colors">الألوان المتاحة</Label>
          <Textarea
            id="manual-colors"
            placeholder="انسخ أسماء الألوان (كل لون في سطر أو مفصولة بفواصل)"
            value={colors}
            onChange={(e) => setColors(e.target.value)}
            rows={2}
          />
          <p className="text-xs text-muted-foreground">
            مثال: 白色, 黑色, 粉色 أو White, Black, Pink
          </p>
        </div>

        {/* Sizes */}
        <div className="space-y-2">
          <Label htmlFor="manual-sizes">المقاسات/الخيارات</Label>
          <Textarea
            id="manual-sizes"
            placeholder="انسخ المقاسات أو الخيارات المتاحة"
            value={sizes}
            onChange={(e) => setSizes(e.target.value)}
            rows={2}
          />
          <p className="text-xs text-muted-foreground">
            مثال: S, M, L, XL أو 单杯架, 双杯架
          </p>
        </div>

        {/* Features */}
        <div className="space-y-2">
          <Label htmlFor="manual-features">الميزات (اختياري)</Label>
          <Textarea
            id="manual-features"
            placeholder="أي ميزات أو مواصفات إضافية"
            value={features}
            onChange={(e) => setFeatures(e.target.value)}
            rows={2}
          />
        </div>

        {/* Images */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-1">
              <ImageIcon className="h-4 w-4" />
              روابط الصور
            </Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddImage}
              className="gap-1 text-xs"
            >
              <Plus className="h-3 w-3" />
              إضافة صورة
            </Button>
          </div>
          <div className="space-y-2">
            {imageUrls.map((url, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  placeholder={`رابط الصورة ${index + 1}`}
                  value={url}
                  onChange={(e) => handleImageChange(index, e.target.value)}
                  className="flex-1 text-xs font-mono"
                />
                {imageUrls.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveImage(index)}
                    className="text-red-500 hover:text-red-600"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            انقر بزر الفأرة الأيمن على الصورة في Taobao → "نسخ عنوان الصورة"
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button
            onClick={handleSubmit}
            disabled={isProcessing || !title.trim()}
            className="flex-1 gap-2"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                جاري المعالجة...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                ترجمة وإنشاء المنتج
              </>
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isProcessing}
          >
            إلغاء
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
