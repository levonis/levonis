## الخطة

1. تحديث دوال حفظ المنتج في قاعدة البيانات (`admin_create_product` و `admin_update_product`) بحيث لا تمنع دور المساعد من حفظ:
   - السعر الأصلي بالدينار: `original_price`
   - السعر الأصلي بالدولار إن استُخدم: `original_price_usd`
   - أبعاد الشحن: `weight_kg`, `length_cm`, `width_cm`, `height_cm`
   - حقول التسعير والشحن المحسوبة التي تحتاجها شاشة المساعد: `price_usd`, `shipping_cost_iqd`, `sea_price`, `air_price`, `direct_sale_price`, `round_up_price`
   - العمولات/التكاليف المرتبطة بالتسعير إذا كانت من نفس شاشة التسعير.

2. إبقاء الحماية كما هي:
   - الوصول يبقى فقط لمن لديه صلاحية إدارية عبر `has_admin_access`.
   - المستخدم العادي لا يرى هذه الحقول عبر `products_admin`.
   - المنتجات التي ينشئها المساعد تبقى `pending_admin_review = true` مثل النظام الحالي.

3. تحديث عرض `products_admin` عند الحاجة للتأكد من أن المساعد يستطيع إعادة قراءة نفس القيم بعد الحفظ، خصوصًا `original_price`, `original_price_usd`, `weight_kg`, `length_cm`, `width_cm`, `height_cm`.

4. التحقق بعد التنفيذ عبر قراءة تعريف الدوال/العرض والتأكد أن الحقول لم تعد تُحذف من payload عند دور المساعد.