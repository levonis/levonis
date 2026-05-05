// Maps Supabase/Postgres error codes & messages from order creation
// to clear, user-friendly explanations with optional action links.

export type OrderErrorAction = {
  label: string;
  href: string;
};

export type FriendlyOrderError = {
  title: string;
  description: string;
  action?: OrderErrorAction;
  reasonCode: string;
};

type Lang = 'ar' | 'en' | 'ku';

const dict = {
  ar: {
    titles: {
      auth: 'يجب تسجيل الدخول',
      permission: 'صلاحيات غير كافية',
      rls: 'تم رفض الطلب من نظام الحماية',
      validation: 'بيانات الطلب غير صالحة',
      stock: 'المخزون غير كافٍ',
      wallet: 'رصيد المحفظة غير كافٍ',
      address: 'عنوان التوصيل ناقص',
      conflict: 'الطلب موجود مسبقًا',
      network: 'تعذر الاتصال بالخادم',
      unknown: 'فشل إنشاء الطلب',
    },
    descs: {
      auth: 'انتهت جلستك أو لم تسجّل الدخول. يرجى تسجيل الدخول وإعادة المحاولة.',
      permission: 'حسابك لا يملك صلاحية إنشاء هذا الطلب. يرجى التواصل مع الدعم.',
      rls: 'منع نظام الحماية تنفيذ الطلب. غالبًا بسبب عدم تطابق هوية المستخدم. سجّل الدخول مجددًا ثم حاول.',
      validation: 'بعض الحقول الإلزامية ناقصة أو غير صحيحة. تحقق من العنوان ورقم الهاتف وطريقة التوصيل.',
      stock: 'إحدى المنتجات غير متوفرة بالكمية المطلوبة. حدّث السلة وحاول مجددًا.',
      wallet: 'الرصيد المتاح في المحفظة لا يكفي لإكمال الطلب.',
      address: 'لم يتم اختيار عنوان توصيل صالح. أضف عنوانًا أو اختره من القائمة.',
      conflict: 'يبدو أن هذا الطلب أُنشئ مسبقًا. تحقق من قائمة طلباتك.',
      network: 'تعذر الاتصال بالخادم. تحقق من الإنترنت ثم أعد المحاولة.',
      unknown: 'حدث خطأ غير متوقع أثناء إنشاء الطلب. حاول مجددًا أو راسل الدعم.',
    },
    actions: {
      login: 'تسجيل الدخول',
      addresses: 'إدارة العناوين',
      cart: 'تحديث السلة',
      orders: 'طلباتي',
      support: 'تواصل مع الدعم',
    },
  },
  en: {
    titles: {
      auth: 'Sign in required',
      permission: 'Insufficient permissions',
      rls: 'Request blocked by security policy',
      validation: 'Invalid order data',
      stock: 'Insufficient stock',
      wallet: 'Insufficient wallet balance',
      address: 'Missing delivery address',
      conflict: 'Order already exists',
      network: 'Could not reach server',
      unknown: 'Failed to create order',
    },
    descs: {
      auth: 'Your session expired or you are not signed in. Please sign in and try again.',
      permission: 'Your account is not allowed to place this order. Please contact support.',
      rls: 'A security policy blocked this request, usually due to a session mismatch. Sign in again and retry.',
      validation: 'Some required fields are missing or invalid. Check address, phone, and delivery method.',
      stock: 'One of the products is out of stock. Refresh your cart and try again.',
      wallet: 'Your wallet balance is not enough to complete this order.',
      address: 'No valid delivery address selected. Add or pick one.',
      conflict: 'This order was already created. Check your orders list.',
      network: 'Network error. Check your internet and try again.',
      unknown: 'An unexpected error occurred. Try again or contact support.',
    },
    actions: {
      login: 'Sign in',
      addresses: 'Manage addresses',
      cart: 'Refresh cart',
      orders: 'My orders',
      support: 'Contact support',
    },
  },
  ku: {
    titles: {
      auth: 'پێویستە بچیتە ژوورەوە',
      permission: 'دەسەڵاتت نییە',
      rls: 'سیستەمی پاراستن داواکارییەکەی ڕەتکردەوە',
      validation: 'زانیاری داواکاری دروست نییە',
      stock: 'کۆگا پێداویستی نییە',
      wallet: 'بڕی کیسە بەس نییە',
      address: 'ناونیشانی گەیاندن نییە',
      conflict: 'داواکاری پێشتر دروستکراوە',
      network: 'نەتوانرا پەیوەندی بکەیت',
      unknown: 'دروستکردنی داواکاری سەرکەوتوو نەبوو',
    },
    descs: {
      auth: 'دانیشتنەکەت کۆتایی هاتووە. تکایە بچۆ ژوورەوە و دووبارە هەوڵبدە.',
      permission: 'هەژمارت دەسەڵاتی ئەم داواکارییەی نییە. پەیوەندی بە پشتگیری بکە.',
      rls: 'سیستەمی پاراستن داواکارییەکەی ڕاگرت. دووبارە بچۆ ژوورەوە و هەوڵبدە.',
      validation: 'هەندێ خانە بەتاڵن یان هەڵەن. ناونیشان و ژمارە و شێوازی گەیاندن پشکنە.',
      stock: 'یەکێک لە بەرهەمەکان نییە. سەبەتە نوێ بکەرەوە.',
      wallet: 'پارەی کیسەکەت بەس نییە بۆ ئەم داواکارییە.',
      address: 'ناونیشانی گەیاندنت دیاری نەکردووە.',
      conflict: 'ئەم داواکارییە پێشتر تۆمارکراوە. لیستی داواکارییەکانت بپشکنە.',
      network: 'هەڵەی ئینتەرنێت. پشکنین بکە و دووبارە هەوڵبدە.',
      unknown: 'هەڵەیەک ڕوویدا. دووبارە هەوڵبدە یان پەیوەندی بە پشتگیری بکە.',
    },
    actions: {
      login: 'چوونەژوورەوە',
      addresses: 'بەڕێوەبردنی ناونیشان',
      cart: 'سەبەتە نوێ بکەرەوە',
      orders: 'داواکارییەکانم',
      support: 'پەیوەندی بە پشتگیری',
    },
  },
} as const;

export function buildFriendlyOrderError(
  err: any,
  lang: Lang = 'ar',
): FriendlyOrderError {
  const t = dict[lang] || dict.ar;
  const code: string = (err?.code || '').toString();
  const msg: string = (err?.message || '').toString().toLowerCase();
  const details: string = (err?.details || '').toString().toLowerCase();
  const hint: string = (err?.hint || '').toString().toLowerCase();
  const all = `${msg} ${details} ${hint}`;

  // RLS / permission denied
  if (
    code === '42501' ||
    all.includes('row-level security') ||
    all.includes('row level security') ||
    all.includes('violates row-level') ||
    all.includes('permission denied')
  ) {
    if (all.includes('jwt') || all.includes('not authenticated') || all.includes('auth.uid')) {
      return {
        reasonCode: 'auth',
        title: t.titles.auth,
        description: t.descs.auth,
        action: { label: t.actions.login, href: '/auth' },
      };
    }
    return {
      reasonCode: 'rls',
      title: t.titles.rls,
      description: t.descs.rls,
      action: { label: t.actions.login, href: '/auth' },
    };
  }

  // Wallet
  if (all.includes('wallet') && (all.includes('insufficient') || all.includes('balance'))) {
    return {
      reasonCode: 'wallet',
      title: t.titles.wallet,
      description: t.descs.wallet,
      action: { label: t.actions.cart, href: '/cart' },
    };
  }

  // Stock
  if (all.includes('stock') || all.includes('out_of_stock') || all.includes('quantity')) {
    return {
      reasonCode: 'stock',
      title: t.titles.stock,
      description: t.descs.stock,
      action: { label: t.actions.cart, href: '/cart' },
    };
  }

  // Address / validation
  if (all.includes('address') || all.includes('phone') || all.includes('governorate')) {
    return {
      reasonCode: 'address',
      title: t.titles.address,
      description: t.descs.address,
      action: { label: t.actions.addresses, href: '/account/addresses' },
    };
  }

  // Unique violation / conflict
  if (code === '23505' || all.includes('duplicate key') || all.includes('already exists')) {
    return {
      reasonCode: 'conflict',
      title: t.titles.conflict,
      description: t.descs.conflict,
      action: { label: t.actions.orders, href: '/orders' },
    };
  }

  // Not-null / check constraint
  if (code === '23502' || code === '23514' || code?.startsWith('22')) {
    return {
      reasonCode: 'validation',
      title: t.titles.validation,
      description: t.descs.validation,
      action: { label: t.actions.addresses, href: '/account/addresses' },
    };
  }

  // Network
  if (all.includes('failed to fetch') || all.includes('networkerror') || all.includes('timeout')) {
    return {
      reasonCode: 'network',
      title: t.titles.network,
      description: t.descs.network,
    };
  }

  return {
    reasonCode: 'unknown',
    title: t.titles.unknown,
    description: err?.message || t.descs.unknown,
    action: { label: t.actions.support, href: '/support' },
  };
}
