// WeChat emoji pack - 106 emojis from the official pack
// These are inline emojis that can be combined with text

export interface EmojiItem {
  id: string;
  code: string; // Short code like :001:
  src: string;
  alt: string;
}

// Using simple numeric codes instead of Chinese characters
export const WECHAT_EMOJIS: EmojiItem[] = [
  { id: '001', code: ':e001:', src: '/emojis/001.webp', alt: 'ابتسامة' },
  { id: '002', code: ':e002:', src: '/emojis/002.webp', alt: 'استياء' },
  { id: '003', code: ':e003:', src: '/emojis/003.webp', alt: 'إعجاب' },
  { id: '004', code: ':e004:', src: '/emojis/004.webp', alt: 'ذهول' },
  { id: '005', code: ':e005:', src: '/emojis/005.webp', alt: 'فخر' },
  { id: '006', code: ':e006:', src: '/emojis/006.webp', alt: 'دموع' },
  { id: '007', code: ':e007:', src: '/emojis/007.webp', alt: 'خجل' },
  { id: '008', code: ':e008:', src: '/emojis/008.webp', alt: 'صمت' },
  { id: '009', code: ':e009:', src: '/emojis/009.webp', alt: 'نوم' },
  { id: '010', code: ':e010:', src: '/emojis/010.webp', alt: 'بكاء شديد' },
  { id: '011', code: ':e011:', src: '/emojis/011.webp', alt: 'إحراج' },
  { id: '012', code: ':e012:', src: '/emojis/012.webp', alt: 'غضب' },
  { id: '013', code: ':e013:', src: '/emojis/013.webp', alt: 'مشاغب' },
  { id: '014', code: ':e014:', src: '/emojis/014.webp', alt: 'ضحكة عريضة' },
  { id: '015', code: ':e015:', src: '/emojis/015.webp', alt: 'مفاجأة' },
  { id: '016', code: ':e016:', src: '/emojis/016.webp', alt: 'حزن' },
  { id: '017', code: ':e017:', src: '/emojis/017.webp', alt: 'محرج' },
  { id: '018', code: ':e018:', src: '/emojis/018.webp', alt: 'جنون' },
  { id: '019', code: ':e019:', src: '/emojis/019.webp', alt: 'تقيؤ' },
  { id: '020', code: ':e020:', src: '/emojis/020.webp', alt: 'ضحكة خفية' },
  { id: '021', code: ':e021:', src: '/emojis/021.webp', alt: 'سعادة' },
  { id: '022', code: ':e022:', src: '/emojis/022.webp', alt: 'تدوير العين' },
  { id: '023', code: ':e023:', src: '/emojis/023.webp', alt: 'تكبر' },
  { id: '024', code: ':e024:', src: '/emojis/024.webp', alt: 'نعاس' },
  { id: '025', code: ':e025:', src: '/emojis/025.webp', alt: 'رعب' },
  { id: '026', code: ':e026:', src: '/emojis/026.webp', alt: 'ضحكة بريئة' },
  { id: '027', code: ':e027:', src: '/emojis/027.webp', alt: 'استرخاء' },
  { id: '028', code: ':e028:', src: '/emojis/028.webp', alt: 'لعنة' },
  { id: '029', code: ':e029:', src: '/emojis/029.webp', alt: 'تساؤل' },
  { id: '030', code: ':e030:', src: '/emojis/030.webp', alt: 'صمت' },
  { id: '031', code: ':e031:', src: '/emojis/031.webp', alt: 'دوار' },
  { id: '032', code: ':e032:', src: '/emojis/032.webp', alt: 'سيء' },
  { id: '033', code: ':e033:', src: '/emojis/033.webp', alt: 'جمجمة' },
  { id: '034', code: ':e034:', src: '/emojis/034.webp', alt: 'ضرب' },
  { id: '035', code: ':e035:', src: '/emojis/035.webp', alt: 'وداعاً' },
  { id: '036', code: ':e036:', src: '/emojis/036.webp', alt: 'مسح العرق' },
  { id: '037', code: ':e037:', src: '/emojis/037.webp', alt: 'حك الأنف' },
  { id: '038', code: ':e038:', src: '/emojis/038.webp', alt: 'تصفيق' },
  { id: '039', code: ':e039:', src: '/emojis/039.webp', alt: 'ضحكة شريرة' },
  { id: '040', code: ':e040:', src: '/emojis/040.webp', alt: 'استهزاء' },
  { id: '041', code: ':e041:', src: '/emojis/041.webp', alt: 'احتقار' },
  { id: '042', code: ':e042:', src: '/emojis/042.webp', alt: 'ظلم' },
  { id: '043', code: ':e043:', src: '/emojis/043.webp', alt: 'على وشك البكاء' },
  { id: '044', code: ':e044:', src: '/emojis/044.webp', alt: 'ماكر' },
  { id: '045', code: ':e045:', src: '/emojis/045.webp', alt: 'قبلة' },
  { id: '046', code: ':e046:', src: '/emojis/046.webp', alt: 'مسكين' },
  { id: '047', code: ':e047:', src: '/emojis/047.webp', alt: 'وجه مبتسم' },
  { id: '048', code: ':e048:', src: '/emojis/048.webp', alt: 'مريض' },
  { id: '049', code: ':e049:', src: '/emojis/049.webp', alt: 'احمرار الوجه' },
  { id: '050', code: ':e050:', src: '/emojis/050.webp', alt: 'ضحك بعد البكاء' },
  { id: '051', code: ':e051:', src: '/emojis/051.webp', alt: 'خوف' },
  { id: '052', code: ':e052:', src: '/emojis/052.webp', alt: 'خيبة أمل' },
  { id: '053', code: ':e053:', src: '/emojis/053.webp', alt: 'لا تعليق' },
  { id: '054', code: ':e054:', src: '/emojis/054.webp', alt: 'هيها' },
  { id: '055', code: ':e055:', src: '/emojis/055.webp', alt: 'تغطية الوجه' },
  { id: '056', code: ':e056:', src: '/emojis/056.webp', alt: 'ضحكة ماكرة' },
  { id: '057', code: ':e057:', src: '/emojis/057.webp', alt: 'ذكي' },
  { id: '058', code: ':e058:', src: '/emojis/058.webp', alt: 'تجهم' },
  { id: '059', code: ':e059:', src: '/emojis/059.webp', alt: 'نجاح' },
  { id: '060', code: ':e060:', src: '/emojis/060.webp', alt: 'متفرج' },
  { id: '061', code: ':e061:', src: '/emojis/061.webp', alt: 'تشجيع' },
  { id: '062', code: ':e062:', src: '/emojis/062.webp', alt: 'عرق' },
  { id: '063', code: ':e063:', src: '/emojis/063.webp', alt: 'يا إلهي' },
  { id: '064', code: ':e064:', src: '/emojis/064.webp', alt: 'تفكير' },
  { id: '065', code: ':e065:', src: '/emojis/065.webp', alt: 'احترام' },
  { id: '066', code: ':e066:', src: '/emojis/066.webp', alt: 'كلب' },
  { id: '067', code: ':e067:', src: '/emojis/067.webp', alt: 'موافق' },
  { id: '068', code: ':e068:', src: '/emojis/068.webp', alt: 'صفعة' },
  { id: '069', code: ':e069:', src: '/emojis/069.webp', alt: 'واو' },
  { id: '070', code: ':e070:', src: '/emojis/070.webp', alt: 'تدوير العين' },
  { id: '071', code: ':e071:', src: '/emojis/071.webp', alt: '666' },
  { id: '072', code: ':e072:', src: '/emojis/072.webp', alt: 'دعني أرى' },
  { id: '073', code: ':e073:', src: '/emojis/073.webp', alt: 'تنهد' },
  { id: '074', code: ':e074:', src: '/emojis/074.webp', alt: 'مرارة' },
  { id: '075', code: ':e075:', src: '/emojis/075.webp', alt: 'انفجار' },
  { id: '076', code: ':e076:', src: '/emojis/076.webp', alt: 'شفاه' },
  { id: '077', code: ':e077:', src: '/emojis/077.webp', alt: 'قلب' },
  { id: '078', code: ':e078:', src: '/emojis/078.webp', alt: 'قلب مكسور' },
  { id: '079', code: ':e079:', src: '/emojis/079.webp', alt: 'عناق' },
  { id: '080', code: ':e080:', src: '/emojis/080.webp', alt: 'ممتاز' },
  { id: '081', code: ':e081:', src: '/emojis/081.webp', alt: 'ضعيف' },
  { id: '082', code: ':e082:', src: '/emojis/082.webp', alt: 'مصافحة' },
  { id: '083', code: ':e083:', src: '/emojis/083.webp', alt: 'نصر' },
  { id: '084', code: ':e084:', src: '/emojis/084.webp', alt: 'تحية' },
  { id: '085', code: ':e085:', src: '/emojis/085.webp', alt: 'تعال' },
  { id: '086', code: ':e086:', src: '/emojis/086.webp', alt: 'قبضة' },
  { id: '087', code: ':e087:', src: '/emojis/087.webp', alt: 'موافق' },
  { id: '088', code: ':e088:', src: '/emojis/088.webp', alt: 'دعاء' },
  { id: '089', code: ':e089:', src: '/emojis/089.webp', alt: 'بيرة' },
  { id: '090', code: ':e090:', src: '/emojis/090.webp', alt: 'قهوة' },
  { id: '091', code: ':e091:', src: '/emojis/091.webp', alt: 'كيك' },
  { id: '092', code: ':e092:', src: '/emojis/092.webp', alt: 'وردة' },
  { id: '093', code: ':e093:', src: '/emojis/093.webp', alt: 'وردة ذابلة' },
  { id: '094', code: ':e094:', src: '/emojis/094.webp', alt: 'سكين' },
  { id: '095', code: ':e095:', src: '/emojis/095.webp', alt: 'قنبلة' },
  { id: '096', code: ':e096:', src: '/emojis/096.webp', alt: 'براز' },
  { id: '097', code: ':e097:', src: '/emojis/097.webp', alt: 'قمر' },
  { id: '098', code: ':e098:', src: '/emojis/098.webp', alt: 'شمس' },
  { id: '099', code: ':e099:', src: '/emojis/099.webp', alt: 'احتفال' },
  { id: '100', code: ':e100:', src: '/emojis/100.webp', alt: 'هدية' },
  { id: '101', code: ':e101:', src: '/emojis/101.webp', alt: 'ظرف أحمر' },
  { id: '102', code: ':e102:', src: '/emojis/102.webp', alt: 'ثروة' },
  { id: '103', code: ':e103:', src: '/emojis/103.webp', alt: 'حظ' },
  { id: '104', code: ':e104:', src: '/emojis/104.webp', alt: 'ألعاب نارية' },
  { id: '105', code: ':e105:', src: '/emojis/105.webp', alt: 'مفرقعات' },
  { id: '106', code: ':e106:', src: '/emojis/106.webp', alt: 'خنزير' },
];

// Create a map for faster lookup
const emojiMap = new Map(WECHAT_EMOJIS.map(e => [e.code, e]));

// Helper function to parse message text and convert emoji codes to inline images
export function parseEmojisInText(text: string): (string | { type: 'emoji'; src: string; alt: string })[] {
  const result: (string | { type: 'emoji'; src: string; alt: string })[] = [];
  let lastIndex = 0;
  
  // Match emoji codes like :e001:
  const emojiRegex = /:e(\d{3}):/g;
  let match;
  
  while ((match = emojiRegex.exec(text)) !== null) {
    // Add text before the emoji
    if (match.index > lastIndex) {
      result.push(text.slice(lastIndex, match.index));
    }
    
    // Find the emoji
    const emojiCode = match[0];
    const emoji = emojiMap.get(emojiCode);
    
    if (emoji) {
      result.push({ type: 'emoji', src: emoji.src, alt: emoji.alt });
    } else {
      // Not a valid emoji, keep as text
      result.push(emojiCode);
    }
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text
  if (lastIndex < text.length) {
    result.push(text.slice(lastIndex));
  }
  
  return result;
}
