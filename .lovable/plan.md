

## تعديل سلوك التحويل والإرجاع في المخزون

### المشكلة الحالية
1. عند تحويل مسودة لشحنة: المسودة تبقى بحالة "تم التحويل" في القائمة
2. عند إرجاع الشحنة: يتم إنشاء مسودة **جديدة** بدلاً من استعادة الأصلية → تكرار (المسودة القديمة "تم التحويل" + المسودة الجديدة)

### الحل
- **التحويل**: حذف المسودة بالكامل من `purchase_drafts` بدلاً من تحديث حالتها إلى `converted`
- **الإرجاع**: إنشاء مسودة جديدة بحالة `draft` عادية (بدون `reverted_from_shipment`) وحذف الشحنة — المسودة ترجع كما كانت أول مرة مع كل الأزرار (تعديل + تحويل لشحنة)

### التغييرات في `src/pages/AdminInventory.tsx`

#### 1. `convertDraftMutation` (سطر ~518-522)
استبدال `update status: 'converted'` بـ `delete` للمسودة:
```typescript
// بدلاً من update status to converted
await supabase.from('purchase_drafts').delete().eq('id', draft.id);
```

#### 2. `revertShipmentToDraftMutation` (سطر ~547-553)
إزالة `reverted_from_shipment: true` وإنشاء مسودة عادية:
```typescript
await supabase.from('purchase_drafts').insert({
  title: shipment.note || 'مسودة شراء',
  items: items,
  total_value: ...,
  status: 'draft'
  // بدون reverted_from_shipment
});
```

#### 3. شرط عرض الزر (سطر ~1202)
إزالة شرط `!draft.reverted_from_shipment` — يعود الشرط الأصلي:
```typescript
{!isConverted && <Button>تحويل لشحنة</Button>}
```

### النتيجة
- عند التحويل: المسودة تختفي من القائمة وتظهر فقط في الشحنات
- عند الإرجاع: المسودة ترجع كما كانت بالضبط مع كل الأزرار الأصلية

