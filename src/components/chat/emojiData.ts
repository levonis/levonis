// WeChat emoji pack - 106 emojis from the official pack
// These are inline emojis that can be combined with text

export interface EmojiItem {
  id: string;
  code: string; // Short code like [smile]
  src: string;
  alt: string;
}

export const WECHAT_EMOJIS: EmojiItem[] = [
  { id: '001', code: '[微笑]', src: '/emojis/001.webp', alt: 'ابتسامة' },
  { id: '002', code: '[撇嘴]', src: '/emojis/002.webp', alt: 'استياء' },
  { id: '003', code: '[色]', src: '/emojis/003.webp', alt: 'إعجاب' },
  { id: '004', code: '[发呆]', src: '/emojis/004.webp', alt: 'ذهول' },
  { id: '005', code: '[得意]', src: '/emojis/005.webp', alt: 'فخر' },
  { id: '006', code: '[流泪]', src: '/emojis/006.webp', alt: 'دموع' },
  { id: '007', code: '[害羞]', src: '/emojis/007.webp', alt: 'خجل' },
  { id: '008', code: '[闭嘴]', src: '/emojis/008.webp', alt: 'صمت' },
  { id: '009', code: '[睡]', src: '/emojis/009.webp', alt: 'نوم' },
  { id: '010', code: '[大哭]', src: '/emojis/010.webp', alt: 'بكاء شديد' },
  { id: '011', code: '[尴尬]', src: '/emojis/011.webp', alt: 'إحراج' },
  { id: '012', code: '[发怒]', src: '/emojis/012.webp', alt: 'غضب' },
  { id: '013', code: '[调皮]', src: '/emojis/013.webp', alt: 'مشاغب' },
  { id: '014', code: '[呲牙]', src: '/emojis/014.webp', alt: 'ضحكة عريضة' },
  { id: '015', code: '[惊讶]', src: '/emojis/015.webp', alt: 'مفاجأة' },
  { id: '016', code: '[难过]', src: '/emojis/016.webp', alt: 'حزن' },
  { id: '017', code: '[囧]', src: '/emojis/017.webp', alt: 'محرج' },
  { id: '018', code: '[抓狂]', src: '/emojis/018.webp', alt: 'جنون' },
  { id: '019', code: '[吐]', src: '/emojis/019.webp', alt: 'تقيؤ' },
  { id: '020', code: '[偷笑]', src: '/emojis/020.webp', alt: 'ضحكة خفية' },
  { id: '021', code: '[愉快]', src: '/emojis/021.webp', alt: 'سعادة' },
  { id: '022', code: '[白眼]', src: '/emojis/022.webp', alt: 'تدوير العين' },
  { id: '023', code: '[傲慢]', src: '/emojis/023.webp', alt: 'تكبر' },
  { id: '024', code: '[困]', src: '/emojis/024.webp', alt: 'نعاس' },
  { id: '025', code: '[惊恐]', src: '/emojis/025.webp', alt: 'رعب' },
  { id: '026', code: '[憨笑]', src: '/emojis/026.webp', alt: 'ضحكة بريئة' },
  { id: '027', code: '[悠闲]', src: '/emojis/027.webp', alt: 'استرخاء' },
  { id: '028', code: '[咒骂]', src: '/emojis/028.webp', alt: 'لعنة' },
  { id: '029', code: '[疑问]', src: '/emojis/029.webp', alt: 'تساؤل' },
  { id: '030', code: '[嘘]', src: '/emojis/030.webp', alt: 'صمت' },
  { id: '031', code: '[晕]', src: '/emojis/031.webp', alt: 'دوار' },
  { id: '032', code: '[衰]', src: '/emojis/032.webp', alt: 'سيء' },
  { id: '033', code: '[骷髅]', src: '/emojis/033.webp', alt: 'جمجمة' },
  { id: '034', code: '[敲打]', src: '/emojis/034.webp', alt: 'ضرب' },
  { id: '035', code: '[再见]', src: '/emojis/035.webp', alt: 'وداعاً' },
  { id: '036', code: '[擦汗]', src: '/emojis/036.webp', alt: 'مسح العرق' },
  { id: '037', code: '[抠鼻]', src: '/emojis/037.webp', alt: 'حك الأنف' },
  { id: '038', code: '[鼓掌]', src: '/emojis/038.webp', alt: 'تصفيق' },
  { id: '039', code: '[坏笑]', src: '/emojis/039.webp', alt: 'ضحكة شريرة' },
  { id: '040', code: '[右哼哼]', src: '/emojis/040.webp', alt: 'استهزاء' },
  { id: '041', code: '[鄙视]', src: '/emojis/041.webp', alt: 'احتقار' },
  { id: '042', code: '[委屈]', src: '/emojis/042.webp', alt: 'ظلم' },
  { id: '043', code: '[快哭了]', src: '/emojis/043.webp', alt: 'على وشك البكاء' },
  { id: '044', code: '[阴险]', src: '/emojis/044.webp', alt: 'ماكر' },
  { id: '045', code: '[亲亲]', src: '/emojis/045.webp', alt: 'قبلة' },
  { id: '046', code: '[可怜]', src: '/emojis/046.webp', alt: 'مسكين' },
  { id: '047', code: '[笑脸]', src: '/emojis/047.webp', alt: 'وجه مبتسم' },
  { id: '048', code: '[生病]', src: '/emojis/048.webp', alt: 'مريض' },
  { id: '049', code: '[脸红]', src: '/emojis/049.webp', alt: 'احمرار الوجه' },
  { id: '050', code: '[破涕为笑]', src: '/emojis/050.webp', alt: 'ضحك بعد البكاء' },
  { id: '051', code: '[恐惧]', src: '/emojis/051.webp', alt: 'خوف' },
  { id: '052', code: '[失望]', src: '/emojis/052.webp', alt: 'خيبة أمل' },
  { id: '053', code: '[无语]', src: '/emojis/053.webp', alt: 'لا تعليق' },
  { id: '054', code: '[嘿哈]', src: '/emojis/054.webp', alt: 'هيها' },
  { id: '055', code: '[捂脸]', src: '/emojis/055.webp', alt: 'تغطية الوجه' },
  { id: '056', code: '[奸笑]', src: '/emojis/056.webp', alt: 'ضحكة ماكرة' },
  { id: '057', code: '[机智]', src: '/emojis/057.webp', alt: 'ذكي' },
  { id: '058', code: '[皱眉]', src: '/emojis/058.webp', alt: 'تجهم' },
  { id: '059', code: '[耶]', src: '/emojis/059.webp', alt: 'نجاح' },
  { id: '060', code: '[吃瓜]', src: '/emojis/060.webp', alt: 'متفرج' },
  { id: '061', code: '[加油]', src: '/emojis/061.webp', alt: 'تشجيع' },
  { id: '062', code: '[汗]', src: '/emojis/062.webp', alt: 'عرق' },
  { id: '063', code: '[天啊]', src: '/emojis/063.webp', alt: 'يا إلهي' },
  { id: '064', code: '[Emm]', src: '/emojis/064.webp', alt: 'تفكير' },
  { id: '065', code: '[社会社会]', src: '/emojis/065.webp', alt: 'احترام' },
  { id: '066', code: '[旺柴]', src: '/emojis/066.webp', alt: 'كلب' },
  { id: '067', code: '[好的]', src: '/emojis/067.webp', alt: 'موافق' },
  { id: '068', code: '[打脸]', src: '/emojis/068.webp', alt: 'صفعة' },
  { id: '069', code: '[哇]', src: '/emojis/069.webp', alt: 'واو' },
  { id: '070', code: '[翻白眼]', src: '/emojis/070.webp', alt: 'تدوير العين' },
  { id: '071', code: '[666]', src: '/emojis/071.webp', alt: '666' },
  { id: '072', code: '[让我看看]', src: '/emojis/072.webp', alt: 'دعني أرى' },
  { id: '073', code: '[叹气]', src: '/emojis/073.webp', alt: 'تنهد' },
  { id: '074', code: '[苦涩]', src: '/emojis/074.webp', alt: 'مرارة' },
  { id: '075', code: '[裂开]', src: '/emojis/075.webp', alt: 'انفجار' },
  { id: '076', code: '[嘴唇]', src: '/emojis/076.webp', alt: 'شفاه' },
  { id: '077', code: '[爱心]', src: '/emojis/077.webp', alt: 'قلب' },
  { id: '078', code: '[心碎]', src: '/emojis/078.webp', alt: 'قلب مكسور' },
  { id: '079', code: '[拥抱]', src: '/emojis/079.webp', alt: 'عناق' },
  { id: '080', code: '[强]', src: '/emojis/080.webp', alt: 'ممتاز' },
  { id: '081', code: '[弱]', src: '/emojis/081.webp', alt: 'ضعيف' },
  { id: '082', code: '[握手]', src: '/emojis/082.webp', alt: 'مصافحة' },
  { id: '083', code: '[胜利]', src: '/emojis/083.webp', alt: 'نصر' },
  { id: '084', code: '[抱拳]', src: '/emojis/084.webp', alt: 'تحية' },
  { id: '085', code: '[勾引]', src: '/emojis/085.webp', alt: 'تعال' },
  { id: '086', code: '[拳头]', src: '/emojis/086.webp', alt: 'قبضة' },
  { id: '087', code: '[OK]', src: '/emojis/087.webp', alt: 'موافق' },
  { id: '088', code: '[合十]', src: '/emojis/088.webp', alt: 'دعاء' },
  { id: '089', code: '[啤酒]', src: '/emojis/089.webp', alt: 'بيرة' },
  { id: '090', code: '[咖啡]', src: '/emojis/090.webp', alt: 'قهوة' },
  { id: '091', code: '[蛋糕]', src: '/emojis/091.webp', alt: 'كيك' },
  { id: '092', code: '[玫瑰]', src: '/emojis/092.webp', alt: 'وردة' },
  { id: '093', code: '[凋谢]', src: '/emojis/093.webp', alt: 'وردة ذابلة' },
  { id: '094', code: '[菜刀]', src: '/emojis/094.webp', alt: 'سكين' },
  { id: '095', code: '[炸弹]', src: '/emojis/095.webp', alt: 'قنبلة' },
  { id: '096', code: '[便便]', src: '/emojis/096.webp', alt: 'براز' },
  { id: '097', code: '[月亮]', src: '/emojis/097.webp', alt: 'قمر' },
  { id: '098', code: '[太阳]', src: '/emojis/098.webp', alt: 'شمس' },
  { id: '099', code: '[庆祝]', src: '/emojis/099.webp', alt: 'احتفال' },
  { id: '100', code: '[礼物]', src: '/emojis/100.webp', alt: 'هدية' },
  { id: '101', code: '[红包]', src: '/emojis/101.webp', alt: 'ظرف أحمر' },
  { id: '102', code: '[發]', src: '/emojis/102.webp', alt: 'ثروة' },
  { id: '103', code: '[福]', src: '/emojis/103.webp', alt: 'حظ' },
  { id: '104', code: '[烟花]', src: '/emojis/104.webp', alt: 'ألعاب نارية' },
  { id: '105', code: '[爆竹]', src: '/emojis/105.webp', alt: 'مفرقعات' },
  { id: '106', code: '[猪头]', src: '/emojis/106.webp', alt: 'خنزير' },
];

// Helper function to parse message text and convert emoji codes to inline images
export function parseEmojisInText(text: string): (string | { type: 'emoji'; src: string; alt: string })[] {
  const result: (string | { type: 'emoji'; src: string; alt: string })[] = [];
  let lastIndex = 0;
  
  // Match emoji codes like [微笑] or [666]
  const emojiRegex = /\[([^\]]+)\]/g;
  let match;
  
  while ((match = emojiRegex.exec(text)) !== null) {
    // Add text before the emoji
    if (match.index > lastIndex) {
      result.push(text.slice(lastIndex, match.index));
    }
    
    // Find the emoji
    const emojiCode = match[0];
    const emoji = WECHAT_EMOJIS.find(e => e.code === emojiCode);
    
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
