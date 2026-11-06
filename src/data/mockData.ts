import { SavingsCircle, UserProfile, AppNotification } from '../types';

export const INITIAL_USER_PROFILE: UserProfile = {
  id: '',
  fullName: '',
  email: '',
  phone: '',
  operator: '',
  payoutType: 'bank',
  institution: 'kuraimi',
  institutionName: 'بنك الكريمي للتمويل الأصغر الإسلامي',
  accountNumber: '',
  beneficiaryName: '',
  isVerified: false,
  avatar: '/assets/aistudio/image_94928b82.png',
};

// No default mock circles - user starts with zero circles until they create or join real ones in Firestore
export const INITIAL_CIRCLES: SavingsCircle[] = [];

// No default mock notifications
export const INITIAL_NOTIFICATIONS: AppNotification[] = [];

export const YEMENI_BANKS = [
  { id: 'kuraimi', name: 'بنك الكريمي للتمويل الأصغر الإسلامي' },
  { id: 'tadhamon', name: 'بنك التضامن الإسلامي' },
  { id: 'qutaibi', name: 'بنك القطيبي الإسلامي' },
  { id: 'yemen_intl', name: 'بنك اليمن الدولي (IBY)' },
  { id: 'alamal', name: 'بنك الأمل للتمويل الأصغر' },
  { id: 'shamil', name: 'بنك الشامل الإسلامي' },
  { id: 'cac', name: 'بنك التسليف التعاوني والزراعي (كاك بنك)' },
];

export const YEMENI_WALLETS = [
  { id: 'cash', name: 'محفظة كاش (Cash)' },
  { id: 'jeeb', name: 'محفظة جيب (Jeeb)' },
  { id: 'onecash', name: 'محفظة ون كاش (OneCash)' },
  { id: 'floosak', name: 'محفظة فلوسك (Floosak)' },
  { id: 'jawali', name: 'محفظة جوالي (Jawali)' },
  { id: 'sabacash', name: 'محفظة سبأكاش (SabaCash)' },
  { id: 'wecash', name: 'محفظة وي كاش (WeCash)' },
  { id: 'bcash', name: 'محفظة بي كاش (B-Cash)' },
];
