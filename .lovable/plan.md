

## إخفاء "تحويل لشحنة" بعد إرجاع الشحنة لمسودة

### المشكلة
عند إرجاع شحنة معلقة إلى مسودة، المسودة الجديدة تُنشأ بحالة `status: 'draft'` مما يجعل زر "تحويل لشحنة" يظهر مرة أخرى. المطلوب أن المسودة المُرجَعة تعرض فقط زر "تعديل".

### الحل
إضافة علامة `reverted_from_shipment: true` عند إنشاء المسودة من شحنة مُرجَعة، ثم إخفاء زر "تحويل لشحنة" للمسودات التي تحمل هذه العلامة — بحيث تظهر فقط "تعديل".

### التنفيذ

#### 1. Migration — إضافة عمود `reverted_from_shipment`
```sql
ALTER TABLE purchase_drafts ADD COLUMN reverted_from_shipment boolean DEFAULT false;
```

#### 2. تعديل `revertShipmentToDraftMutation` (سطر ~546)
إضافة `reverted_from_shipment: true` في الـ insert.

#### 3. تعديل شرط إظهار "تحويل لشحنة" (سطر ~1200)
```typescript
// من:
{!isConverted && <Button>تحويل لشحنة</Button>}
// إلى:
{!isConverted && !draft.reverted_from_shipment && <Button>تحويل لشحنة</Button>}
```

#### 4. عند تعديل المسودة وحفظها — إعادة تفعيل التحويل
عند الضغط على "تعديل" وحفظ التغييرات، يتم تحديث `reverted_from_shipment` إلى `false` لتمكين التحويل مجدداً إذا أراد المستخدم.

### البديل الأبسط (بدون migration)
بدلاً من إضافة عمود جديد، يمكن تخزين العلامة في حقل `notes` أو في `items` JSON. لكن الطريقة الأنظف هي العمود المستقل.

### الملفات المتأثرة
- **Migration جديد**: إضافة عمود `reverted_from_shipment`
- `src/pages/AdminInventory.tsx`: تعديل الـ mutation وشرط عرض الزر

