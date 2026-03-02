import { ShopItem } from './types';

export const SHOP_ITEMS: ShopItem[] = [
  { id: 'fire_rate', nameAr: 'سرعة الإطلاق', icon: '🔥', cost: 10, description: 'إطلاق أسرع', maxLevel: 3 },
  { id: 'extra_life', nameAr: 'حياة إضافية', icon: '❤️', cost: 15, description: '+1 حياة', maxLevel: 5 },
  { id: 'shield', nameAr: 'درع', icon: '🛡️', cost: 8, description: 'ضغطتين لتفعيل', maxLevel: 10 },
  { id: 'double_bullets', nameAr: 'رصاصة مزدوجة', icon: '⚡', cost: 20, description: 'إطلاق مزدوج', maxLevel: 1 },
  { id: 'missile_base', nameAr: 'قاعدة صواريخ', icon: '🚀', cost: 25, description: 'صواريخ تتبع تلقائي (6 صواريخ)', maxLevel: 1 },
];
