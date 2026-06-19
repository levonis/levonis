import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Sparkles } from 'lucide-react';
import { type AIContent, type LocalizedText, type AISpec } from '@/lib/aiContent';

interface Props {
  value: AIContent;
  onChange: (v: AIContent) => void;
}

const TriLangInput = ({
  value,
  onChange,
  placeholderAr,
  rows,
}: {
  value: LocalizedText;
  onChange: (v: LocalizedText) => void;
  placeholderAr?: string;
  rows?: number;
}) => {
  // Admin/assistant edit Arabic only. English & Kurdish are produced by the
  // automatic translation flow on save, so we keep any existing en/ku values
  // intact via the spread in onChange.
  const Comp: any = rows && rows > 1 ? Textarea : Input;
  return (
    <Comp
      value={value?.ar || ''}
      onChange={(e: any) => onChange({ ...value, ar: e.target.value })}
      placeholder={placeholderAr || 'بالعربية'}
      dir="rtl"
      rows={rows}
    />
  );
};

const AdminProductAIContentEditor = ({ value, onChange }: Props) => {
  const c: AIContent = value || {};
  const set = (patch: Partial<AIContent>) => onChange({ ...c, ...patch });

  const updateList = (
    key: 'benefits' | 'usage',
    idx: number,
    v: LocalizedText
  ) => {
    const arr = [...(c[key] || [])];
    arr[idx] = v;
    set({ [key]: arr } as any);
  };
  const addToList = (key: 'benefits' | 'usage') => {
    const arr = [...(c[key] || []), {}];
    set({ [key]: arr } as any);
  };
  const removeFromList = (key: 'benefits' | 'usage', idx: number) => {
    const arr = (c[key] || []).filter((_, i) => i !== idx);
    set({ [key]: arr } as any);
  };

  const updateSpec = (idx: number, patch: Partial<AISpec>) => {
    const arr = [...(c.specifications || [])];
    arr[idx] = { ...arr[idx], ...patch };
    set({ specifications: arr });
  };
  const addSpec = () => set({ specifications: [...(c.specifications || []), { key: {}, value: {} }] });
  const removeSpec = (idx: number) =>
    set({ specifications: (c.specifications || []).filter((_, i) => i !== idx) });

  return (
    <div className="space-y-5 rounded-2xl border border-primary/20 bg-primary/5 p-4">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-primary" />
        <h3 className="font-bold text-sm">محتوى "لماذا هذا المنتج؟" (لتحسين اقتراح الذكاء الاصطناعي و SEO)</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        يُعرض في صفحة المنتج ويُضاف إلى بيانات JSON-LD ليساعد محركات البحث ومساعدي الذكاء الاصطناعي على اقتراح هذا المنتج بدقة.
      </p>

      {/* Problem solved */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold">المشكلة التي يحلها</Label>
        <TriLangInput
          value={c.problem_solved || {}}
          onChange={(v) => set({ problem_solved: v })}
          placeholderAr="مثال: يحل مشكلة بطء الطباعة..."
          rows={2}
        />
      </div>

      {/* Target audience */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold">الجمهور المستهدف</Label>
        <TriLangInput
          value={c.target_audience || {}}
          onChange={(v) => set({ target_audience: v })}
          placeholderAr="مثال: المصممون، الهواة، الشركات الصغيرة"
        />
      </div>

      {/* Benefits */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold">الفوائد الرئيسية</Label>
          <Button type="button" size="sm" variant="outline" onClick={() => addToList('benefits')}>
            <Plus className="w-3 h-3 ml-1" /> إضافة فائدة
          </Button>
        </div>
        {(c.benefits || []).map((b, i) => (
          <div key={i} className="space-y-2 p-2 rounded-lg bg-background/50 border border-border/30">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">فائدة {i + 1}</span>
              <Button type="button" size="icon" variant="ghost" onClick={() => removeFromList('benefits', i)}>
                <Trash2 className="w-3 h-3 text-destructive" />
              </Button>
            </div>
            <TriLangInput value={b} onChange={(v) => updateList('benefits', i, v)} />
          </div>
        ))}
      </div>

      {/* Usage */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold">طريقة الاستخدام (خطوات)</Label>
          <Button type="button" size="sm" variant="outline" onClick={() => addToList('usage')}>
            <Plus className="w-3 h-3 ml-1" /> إضافة خطوة
          </Button>
        </div>
        {(c.usage || []).map((b, i) => (
          <div key={i} className="space-y-2 p-2 rounded-lg bg-background/50 border border-border/30">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">خطوة {i + 1}</span>
              <Button type="button" size="icon" variant="ghost" onClick={() => removeFromList('usage', i)}>
                <Trash2 className="w-3 h-3 text-destructive" />
              </Button>
            </div>
            <TriLangInput value={b} onChange={(v) => updateList('usage', i, v)} />
          </div>
        ))}
      </div>

      {/* Specifications */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold">المواصفات (مفتاح / قيمة)</Label>
          <Button type="button" size="sm" variant="outline" onClick={addSpec}>
            <Plus className="w-3 h-3 ml-1" /> إضافة مواصفة
          </Button>
        </div>
        {(c.specifications || []).map((s, i) => (
          <div key={i} className="space-y-2 p-2 rounded-lg bg-background/50 border border-border/30">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">مواصفة {i + 1}</span>
              <Button type="button" size="icon" variant="ghost" onClick={() => removeSpec(i)}>
                <Trash2 className="w-3 h-3 text-destructive" />
              </Button>
            </div>
            <Label className="text-[10px] text-muted-foreground">المفتاح (مثال: الوزن)</Label>
            <TriLangInput value={s.key || {}} onChange={(v) => updateSpec(i, { key: v })} />
            <Label className="text-[10px] text-muted-foreground">القيمة (مثال: 2.5 كغ)</Label>
            <TriLangInput value={s.value || {}} onChange={(v) => updateSpec(i, { value: v })} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminProductAIContentEditor;
