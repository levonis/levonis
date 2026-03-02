export interface SignupFormData {
  // Step 1: Account
  email: string;
  password: string;
  confirmPassword: string;
  
  // Step 2: Profile
  fullName: string;
  username: string;
  avatarUrl: string;
  
  // Step 3: Verification
  verificationCode: string;
  referralCode: string;
  
  // Step 4: Optional Info
  phone: string;
  address: {
    governorate: string;
    city: string;
    area: string;
    street: string;
    nearestLandmark: string;
  };
  socialLinks: {
    instagram: string;
    whatsapp: string;
    facebook: string;
  };
}

export interface SignupStepProps {
  data: SignupFormData;
  updateData: (updates: Partial<SignupFormData>) => void;
  onNext: () => void;
  onBack?: () => void;
  loading?: boolean;
}

export const IRAQI_GOVERNORATES = [
  'بغداد',
  'البصرة',
  'نينوى',
  'أربيل',
  'النجف',
  'كربلاء',
  'بابل',
  'الأنبار',
  'ديالى',
  'ذي قار',
  'المثنى',
  'القادسية',
  'ميسان',
  'واسط',
  'صلاح الدين',
  'كركوك',
  'السليمانية',
  'دهوك',
];

// Default avatars from Dicebear - bottts-neutral style (tech-friendly)
export const DEFAULT_AVATARS = [
  'https://api.dicebear.com/9.x/bottts-neutral/svg?seed=Felix&backgroundColor=b6e3f4',
  'https://api.dicebear.com/9.x/bottts-neutral/svg?seed=Luna&backgroundColor=c0aede',
  'https://api.dicebear.com/9.x/bottts-neutral/svg?seed=Bella&backgroundColor=d1d4f9',
  'https://api.dicebear.com/9.x/bottts-neutral/svg?seed=Leo&backgroundColor=ffd5dc',
  'https://api.dicebear.com/9.x/bottts-neutral/svg?seed=Max&backgroundColor=ffdfbf',
  'https://api.dicebear.com/9.x/bottts-neutral/svg?seed=Milo&backgroundColor=c4f4e8',
  'https://api.dicebear.com/9.x/bottts-neutral/svg?seed=Zara&backgroundColor=f4c4d4',
  'https://api.dicebear.com/9.x/bottts-neutral/svg?seed=Omar&backgroundColor=d4e8c4',
];

export const initialFormData: SignupFormData = {
  email: '',
  password: '',
  confirmPassword: '',
  fullName: '',
  username: '',
  avatarUrl: DEFAULT_AVATARS[Math.floor(Math.random() * DEFAULT_AVATARS.length)],
  verificationCode: '',
  referralCode: '',
  phone: '',
  address: {
    governorate: '',
    city: '',
    area: '',
    street: '',
    nearestLandmark: '',
  },
  socialLinks: {
    instagram: '',
    whatsapp: '',
    facebook: '',
  },
};
