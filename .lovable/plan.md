
## إزالة الـ imports غير المستخدمة

### المُكتشَف عبر ESLint
- `src/pages/CommunityHome.tsx`: `useSearchParams` مستورد ولا يُستخدم.
- `src/pages/Home.tsx`: `isAllDirectStockDepleted` مستورد ولا يُستخدم.
- `src/pages/Home.tsx`: `Link` مستورد ولا يُستخدم.

### التغييرات
1. `src/pages/CommunityHome.tsx` — حذف:
   `import { useSearchParams } from "react-router-dom";`
2. `src/pages/Home.tsx` — حذف:
   `import { isAllDirectStockDepleted } from '@/lib/stockUtils';`
3. `src/pages/Home.tsx` — حذف:
   `import { Link } from 'react-router-dom';`

### بدون تغييرات
- لا تعديل على المنطق أو الـ JSX.
- أخطاء `no-explicit-any` الموجودة سابقاً ليست من تعديلاتنا، تُترك للمستخدم.

### الملفات المعدّلة
- `src/pages/CommunityHome.tsx`
- `src/pages/Home.tsx`
