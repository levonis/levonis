UPDATE public.daily_tasks SET
  title_en = CASE task_key
    WHEN 'daily_login' THEN 'Daily login'
    WHEN 'weekly_purchase' THEN 'Buy a product this week'
    WHEN 'first_review' THEN 'Add your first review'
    WHEN 'complete_profile' THEN 'Complete your profile'
    WHEN 'instagram_share' THEN 'Share on Instagram'
    WHEN 'order_filament' THEN 'Order filament'
    WHEN 'complete_community_profile' THEN 'Complete your Levo community profile'
    WHEN 'register_merchant' THEN 'Register as a merchant and publish 3 products'
    ELSE title_en
  END,
  title_ku = CASE task_key
    WHEN 'daily_login' THEN 'چوونەژوورەوەی ڕۆژانە'
    WHEN 'weekly_purchase' THEN 'ئەم هەفتە بەرهەمێک بکڕە'
    WHEN 'first_review' THEN 'یەکەم هەڵسەنگاندنت زیاد بکە'
    WHEN 'complete_profile' THEN 'پڕۆفایلەکەت تەواو بکە'
    WHEN 'instagram_share' THEN 'بەشداری بکە لە ئینستاگرام'
    WHEN 'order_filament' THEN 'فیلامێنت داوا بکە'
    WHEN 'complete_community_profile' THEN 'پڕۆفایلی کۆمەڵگای لێڤۆ تەواو بکە'
    WHEN 'register_merchant' THEN 'وەک بازرگان خۆت تۆمار بکە و ٣ بەرهەم بڵاوبکەوە'
    ELSE title_ku
  END,
  description_en = CASE task_key
    WHEN 'daily_login' THEN 'Log in daily to earn points'
    WHEN 'weekly_purchase' THEN 'Buy any product to earn extra points'
    WHEN 'first_review' THEN 'Rate the first product you bought'
    WHEN 'complete_profile' THEN 'Add a photo and your full info'
    WHEN 'instagram_share' THEN 'Share our products on Instagram and tag our page'
    WHEN 'order_filament' THEN 'Order a filament product + rate it after delivery + share an Instagram story'
    WHEN 'complete_community_profile' THEN 'Complete your Levo community profile fully with photo and info'
    WHEN 'register_merchant' THEN 'Register your account as a merchant in the Levo community and publish at least 3 products to claim the reward'
    ELSE description_en
  END,
  description_ku = CASE task_key
    WHEN 'daily_login' THEN 'ڕۆژانە بچۆ ژوورەوە بۆ بەدەستهێنانی خاڵ'
    WHEN 'weekly_purchase' THEN 'هەر بەرهەمێک بکڕە بۆ بەدەستهێنانی خاڵی زیادە'
    WHEN 'first_review' THEN 'یەکەم بەرهەم کە کڕیوتە هەڵسەنگاندنی بکە'
    WHEN 'complete_profile' THEN 'وێنە و زانیاری تەواوت زیاد بکە'
    WHEN 'instagram_share' THEN 'بەرهەمەکانمان بەشداری بکە لە ئینستاگرام و پەڕەکەمان تاگ بکە'
    WHEN 'order_filament' THEN 'بەرهەمێکی فیلامێنت داوا بکە + پاش وەرگرتن هەڵسەنگاندنی بکە + ستۆریەک بەشداری بکە لە ئینستاگرام'
    WHEN 'complete_community_profile' THEN 'پڕۆفایلی کەسیت لە کۆمەڵگای لێڤۆ بە تەواوی پڕ بکەرەوە لەگەڵ وێنە و زانیاری'
    WHEN 'register_merchant' THEN 'هەژمارەکەت وەک بازرگان لە کۆمەڵگای لێڤۆ تۆمار بکە و لانیکەم ٣ بەرهەم بڵاوبکەرەوە بۆ وەرگرتنی پاداشت'
    ELSE description_ku
  END
WHERE task_key IN ('daily_login','weekly_purchase','first_review','complete_profile','instagram_share','order_filament','complete_community_profile','register_merchant');