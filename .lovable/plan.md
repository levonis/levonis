

## المشكلات الحالية وحلها

### 1. موقع المحرك بعيد عن المركبة
حالياً المحرك يُرسم عند `drawY + shipH - 2` (أسفل المركبة بمسافة). سأجعله يتداخل مع أسفل المركبة ليبدو كأنه خارج منها مباشرة، بتغيير الموقع إلى `drawY + shipH - engineH * 0.5` تقريباً.

### 2. طريقة عرض الأنيميشن خاطئة
المشكلة أن الكود يتعامل مع الصورة كـ sprite sheet أفقي ويقص frames باستخدام `drawImage` مع source coordinates. لكن يبدو أن الصورة ليست مرتبة بهذا الشكل. سأستخدم نفس أسلوب `HealLoadingSprite` - حيث يتم حساب عرض كل frame من عرض الصورة الكلي ÷ عدد الفريمات، ثم عرض frame واحد فقط باستخدام `drawImage(img, frameX, 0, frameW, frameH, destX, destY, destW, destH)`.

### 3. جعل supercharge يعمل فقط مع الدرع
حالياً `isSupercharge = shieldActive > 0` وهذا صحيح بالفعل.

### التغييرات المطلوبة في `renderer.ts`:

**Engine animation section (سطر 279-295):**
- تقريب المحرك من المركبة: `engineY = drawY + shipH - engineH * 0.55`
- التأكد من أن الـ frame clipping يعمل بشكل صحيح (4 frames أفقية في كل sprite sheet)
- تكبير حجم المحرك قليلاً ليتناسب مع المركبة

ملف واحد فقط يحتاج تعديل: `src/components/games/space-blaster/renderer.ts`

