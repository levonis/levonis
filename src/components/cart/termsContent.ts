// Cart "Terms & Conditions" content for the bottom sheet.
// 28 sections + UI labels in Arabic, English and Kurdish.
// Translations are general guidance — not certified legal text.

export type Lang = 'ar' | 'en' | 'ku';

export interface TermsSection {
  title: string;
  paragraphs: string[];
}

export interface TermsContent {
  dir: 'rtl' | 'ltr';
  sheetTitle: string;
  sheetDescription: string;
  mainHeading: string;
  mainSubheading: string;
  secondaryHeading: string;
  warning: string;
  closeBtn: string;
  acceptBtn: string;
  sections: TermsSection[]; // 28 items
}

const ar: TermsContent = {
  dir: 'rtl',
  sheetTitle: 'الشروط والأحكام',
  sheetDescription: 'يرجى قراءة الشروط والأحكام بعناية قبل إتمام عملية الشراء',
  mainHeading: 'شروط وأحكام متجر الطابعات ثلاثية الأبعاد',
  mainSubheading: '(الطلب المسبق، الدفع، الشحن، الضمان)',
  secondaryHeading: 'ثانياً: شروط استخدام الموقع والشراء',
  warning: 'بإتمام عملية الشراء، أنت تقر بأنك قرأت وفهمت ووافقت على جميع الشروط والأحكام المذكورة أعلاه.',
  closeBtn: 'إغلاق',
  acceptBtn: 'موافق',
  sections: [
    { title: 'نظام الطلب المسبق', paragraphs: ['يقرّ المستخدم ويوافق على أن جميع الطابعات ثلاثية الأبعاد المعروضة في المتجر تُباع بنظام الطلب المسبق (Pre-Order)، وأن مدة التجهيز والتوريد والتسليم هي مدة تقديرية تصل إلى خمسة وأربعين (45) يوماً من تاريخ تأكيد الطلب، وقد تزيد أو تنقص تبعاً لظروف الشحن، الجمارك، أو توفر المنتج لدى الموردين.'] },
    { title: 'الدفع وتثبيت الطلب', paragraphs: ['يتم تثبيت الطلب بعد قيام المستخدم بدفع كامل قيمة المنتج أو دفع دفعة جزئية محددة بوضوح في صفحة المنتج. ويُعد أي مبلغ مدفوع، كلياً أو جزئياً، موافقة صريحة ونهائية من المستخدم على تنفيذ الطلب وفق هذه الشروط والأحكام، ولا يمكن إلغاء الطلب إلا وفق سياسة الإلغاء المعتمدة.'] },
    { title: 'الإلغاء والاسترجاع', paragraphs: ['في حال رغبة المستخدم في إلغاء الطلب أو استرجاع المبلغ دون وجود سبب فني جوهري أو عيب مصنعي مثبت، يحق للمنصة خصم رسوم إدارية وتشغيلية تشمل – على سبيل المثال لا الحصر – تكاليف معالجة الطلب، التحويلات البنكية، حجز المنتج لدى المورد، وأي التزامات لوجستية مترتبة.', 'تختلف قيمة الخصم حسب مرحلة تنفيذ الطلب، ويوافق المستخدم على أن هذه الرسوم غير قابلة للاعتراض أو الطعن بعد الموافقة على الشروط.', 'الاسترجاع بعد الاستلام: يحق للمستخدم طلب الاسترجاع خلال (7) أيام تبدأ من تاريخ تسليم الطلب فعلياً، وذلك حصراً إذا كان المنتج المُسلَّم مخالفاً لما هو مثبت في صفحة المنتج/الطلب داخل الموقع (الكمية، اللون، الخيار، المواصفات، أو عيب مصنعي ظاهر)، وبشرط أن يكون المنتج في حالته الأصلية وبكامل تغليفه واكسسواراته ولم يُستخدم. الاختلاف في الذوق الشخصي أو تغيير الرأي ليس سبباً للاسترجاع.', 'أي طلب أو اتفاق يتم خارج الموقع (تواصل خاص، رسائل خارجية، توصيات شفهية، أو تعديلات لم تُوثَّق في صفحة الطلب داخل الموقع) لا تتحمل المنصة أي مسؤولية تجاهه، ولا يحق للمستخدم المطالبة بأي استرجاع أو تعويض أو ضمان عنه.'] },
    { title: 'الفحص قبل الشحن والتغليف', paragraphs: ['تخضع جميع المنتجات قبل شحنها لفحص دقيق من فريق المنصة يشمل: التحقق من العدد المطلوب، الألوان، الخيارات والمواصفات المختارة في صفحة المنتج، الاكسسوارات المرفقة، اختبار التشغيل الأولي للأجهزة الإلكترونية، وسلامة التغليف الخارجي والداخلي.', 'يُحرَّر سجل فحص داخلي يُعتمد مرجعاً رسمياً في أي نزاع لاحق. ويُعتبر الطلب مطابقاً لما طلبه المستخدم داخل الموقع ما لم يثبت العكس بأدلة موثّقة.'] },
    { title: 'الشحن والتسليم', paragraphs: ['يتم شحن الطابعات والملحقات عبر شركات شحن أو مندوبين معتمدين، وقد يتم شحن بعض القطع أو الإكسسوارات جواً خلال مدة تقديرية لا تتجاوز أسبوعين، وبحد أدنى للشحن الجوي (1) كيلوجرام.', 'لا تتحمل المنصة مسؤولية أي تأخير ناتج عن الجهات الخارجية مثل شركات الشحن، الجمارك، أو ظروف الطرق والمناطق.', 'يلتزم المستخدم بفحص الطلب أمام مندوب التوصيل قبل التوقيع على الاستلام. وأي اختلاف في الكمية، اللون، الخيار، أو المواصفات يجب رصده وتوثيقه (صورة/فيديو + رفض الاستلام أو ملاحظة لدى المندوب) في تلك اللحظة فقط. إذا كان المُسلَّم مطابقاً لما هو مثبت في صفحة الطلب داخل الموقع، ولم يُسجَّل أي اعتراض أمام المندوب، يسقط حق المستخدم في الاعتراض لاحقاً على المحتوى الظاهر.'] },
    { title: 'الاستبدال الكامل والضرر أثناء النقل', paragraphs: ['يتم استبدال الطابعة كاملة فقط في حال ثبوت وجود ضرر ناتج عن الشحن أو النقل، وذلك بشرط الإبلاغ الفوري أمام مندوب التوصيل مع توثيق مصوّر، وبعد فحص المنتج وإصدار تقرير فني معتمد من المنصة يثبت أن الضرر لم يكن نتيجة استخدام المستخدم أو تخزينه الخاطئ بعد الاستلام.', 'الأضرار التي تُكتشف بعد توقيع الاستلام دون توثيقها أمام المندوب لا تُعدّ أضرار شحن وتُعامَل وفق شروط الضمان العادية.'] },
    { title: 'الضمان الأساسي وشروط تفعيله', paragraphs: ['يبدأ الضمان الأساسي للطابعة من تاريخ إتمام عملية الشراء وليس من تاريخ الاستلام.', 'يشمل الضمان استبدال القطع التالفة فقط خلال فترة الضمان المعتمدة، ولا يشمل الأعطال الناتجة عن سوء الاستخدام، الإهمال، التعديل غير المصرّح به، أو التشغيل المخالف لتعليمات الشركة المصنعة.', 'يُشترط لتفعيل الضمان والاستفادة منه: (1) أن تكون الطابعة مُسجَّلة داخل نظام المنصة ومرتبطة بحساب المستخدم نفسه عبر ميزة "تفعيل الضمان" والرقم التسلسلي، (2) أن يقوم المستخدم بإحضار الطابعة بنفسها إلى المخزن أو المكتب الرسمي للمنصة لإجراء الفحص الفني، (3) ألا تكون الطابعة قد فُتحت أو عُدِّلت من جهة غير معتمدة، (4) أن يحتفظ المستخدم بفاتورة الشراء.', 'لا يتم استبدال أي قطعة أو صرف أي تعويض مالي قبل إتمام الفحص الفني داخل المنصة. أي طابعة غير مسجَّلة في حساب المستخدم، أو لم تُفحَص من قبل المنصة، تسقط عنها كافة حقوق الضمان والتعويض.', 'التعويض النقدي بديلاً عن الإصلاح أو الاستبدال يكون وفق تقدير المنصة فقط، ولا يحق للمستخدم اشتراط شكل التعويض.'] },
    { title: 'الضمان الإضافي (الاشتراك الشهري)', paragraphs: ['توفر المنصة خيار الاشتراك الشهري في خدمة تأمين إضافي يمنح المستخدم تغطية موسعة وأطول للطابعة وفق الشروط المعلنة لخدمة الاشتراك.', 'الاشتراك اختياري، وتخضع تفاصيل التغطية والاستثناءات لبنود خدمة التأمين الإضافي.'] },
    { title: 'القبول النهائي', paragraphs: ['بإتمام عملية الشراء أو الدفع، يقرّ المستخدم بأنه قرأ وفهم ووافق على جميع ما ورد أعلاه دون أي تحفظ.'] },
    { title: 'دقة المعلومات والمواصفات', paragraphs: ['تعرض المنصة مواصفات الطابعات والمنتجات بناءً على المعلومات الواردة من الشركات المصنعة أو الموردين. قد تطرأ تغييرات طفيفة على الشكل أو المواصفات التقنية دون إشعار مسبق، ولا يُعد ذلك سبباً للإلغاء أو الاسترجاع ما لم يؤثر التغيير بشكل جوهري على الأداء الأساسي للمنتج.'] },
    { title: 'مسؤولية الاستخدام', paragraphs: ['يتحمل المستخدم كامل المسؤولية عن تشغيل الطابعة واستخدامها وفق دليل الشركة المصنعة وتعليمات السلامة. ولا تتحمل المنصة أي أضرار مباشرة أو غير مباشرة ناتجة عن الاستخدام الخاطئ، أو تحميل ملفات غير متوافقة، أو تشغيل الطابعة بمواد غير معتمدة.'] },
    { title: 'المواد الاستهلاكية', paragraphs: ['لا يشمل الضمان أي مواد استهلاكية مثل الفوهات، الأسرّة، الأحزمة، الفلاتر، أو أي أجزاء تتعرض للاستهلاك الطبيعي مع مرور الوقت، إلا في حال ثبوت وجود عيب مصنعي عند الاستلام.'] },
    { title: 'الدعم الفني', paragraphs: ['توفر المنصة دعماً فنياً عن بُعد خلال فترة الضمان لمساعدة المستخدم في الإعداد الأولي أو تشخيص الأعطال. ولا يشمل الدعم الفني الزيارات الميدانية أو التدريب المتقدم إلا بعقد منفصل أو خدمة مدفوعة.'] },
    { title: 'التأخير القهري (القوة القاهرة)', paragraphs: ['لا تتحمل المنصة أي مسؤولية عن التأخير أو عدم التنفيذ الناتج عن ظروف خارجة عن الإرادة، مثل الكوارث الطبيعية، الأوبئة، القيود الحكومية، تعطل سلاسل الإمداد، أو القرارات الجمركية.'] },
    { title: 'الرسوم والضرائب', paragraphs: ['جميع الأسعار المعروضة لا تشمل – ما لم يُذكر خلاف ذلك – الرسوم الجمركية أو الضرائب المحلية التي قد تُفرض من قبل الجهات الرسمية، ويتحمل المستخدم سدادها عند الاستلام إن وُجدت.'] },
    { title: 'الفحص عند الاستلام', paragraphs: ['يلتزم المستخدم بفحص المنتج فور الاستلام، والإبلاغ عن أي ضرر ظاهر أو نقص خلال مدة لا تتجاوز 48 ساعة من تاريخ الاستلام، مع تقديم صور أو فيديو يوضح الحالة. وفي حال عدم الإبلاغ خلال المدة المحددة، يُعتبر المنتج مستلماً بحالة سليمة.'] },
    { title: 'الملكية والمخاطر', paragraphs: ['تنتقل مسؤولية المخاطر إلى المستخدم فور تسليم الشحنة لشركة الشحن، بينما تبقى ملكية المنتج للمنصة حتى سداد كامل قيمة الطلب.'] },
    { title: 'التحديثات البرمجية', paragraphs: ['قد تتطلب بعض الطابعات تحديثات برمجية (Firmware / Software) دورية من الشركة المصنعة. ولا تتحمل المنصة أي مسؤولية عن أعطال ناتجة عن عدم تحديث النظام أو استخدام نسخ غير رسمية.'] },
    { title: 'حدود المسؤولية', paragraphs: ['تقتصر مسؤولية المنصة – في جميع الأحوال – على قيمة المنتج المدفوعة فقط، ولا تتحمل أي خسائر تبعية، أو فقدان أرباح، أو توقف أعمال ناتج عن استخدام الطابعة.'] },
    { title: 'أولوية التفسير', paragraphs: ['في حال وجود تعارض بين هذه الشروط وأي محتوى تسويقي أو تفسيري آخر، تكون الأولوية دائماً لما ورد في هذه الشروط والأحكام.'] },
    { title: 'التسجيل وحساب المستخدم', paragraphs: ['يتعهد المستخدم بتقديم معلومات صحيحة ودقيقة عند التسجيل، ويتحمل مسؤولية الحفاظ على سرية بيانات حسابه وكلمة المرور. المنصة غير مسؤولة عن أي استخدام غير مصرح به ناتج عن إفشاء بيانات الدخول.'] },
    { title: 'استخدام المحفظة الإلكترونية', paragraphs: ['يقرّ المستخدم بأن رصيد المحفظة غير قابل للاسترداد نقداً ويُستخدم حصرياً للشراء من المنصة. لا تتحمل المنصة أي فوائد أو عوائد على الأرصدة المودعة.'] },
    { title: 'سياسة الأسعار', paragraphs: ['الأسعار المعروضة قابلة للتغيير دون إشعار مسبق. السعر المعتمد هو السعر المثبت وقت تأكيد الطلب. قد تختلف الأسعار بناءً على العروض الترويجية أو تقلبات أسعار الصرف.'] },
    { title: 'الخصوصية وحماية البيانات', paragraphs: ['تلتزم المنصة بحماية بيانات المستخدمين وعدم مشاركتها مع أطراف ثالثة إلا لأغراض تنفيذ الطلب أو بموجب متطلبات قانونية. قد تُستخدم البيانات لتحسين الخدمات وإرسال إشعارات ترويجية.'] },
    { title: 'الملكية الفكرية', paragraphs: ['جميع المحتويات المعروضة على الموقع (صور، نصوص، شعارات، تصاميم) محمية بموجب حقوق الملكية الفكرية، ولا يحق للمستخدم نسخها أو استخدامها لأغراض تجارية دون إذن كتابي مسبق.'] },
    { title: 'التواصل والإشعارات', paragraphs: ['يوافق المستخدم على استلام الإشعارات والتحديثات عبر البريد الإلكتروني، الرسائل النصية، أو إشعارات التطبيق. يمكنه إلغاء الاشتراك في الإشعارات الترويجية في أي وقت.'] },
    { title: 'تعديل الشروط', paragraphs: ['تحتفظ المنصة بحق تعديل هذه الشروط والأحكام في أي وقت. يُعتبر استمرار استخدام الموقع بعد نشر التعديلات موافقة ضمنية عليها.'] },
    { title: 'القانون الواجب التطبيق', paragraphs: ['تخضع هذه الشروط والأحكام للقوانين المحلية المعمول بها، وتختص المحاكم المحلية بالفصل في أي نزاع ينشأ عنها.'] },
  ],
};

const en: TermsContent = {
  dir: 'ltr',
  sheetTitle: 'Terms & Conditions',
  sheetDescription: 'Please read the terms and conditions carefully before completing your purchase',
  mainHeading: '3D Printer Store — Terms & Conditions',
  mainSubheading: '(Pre-order, payment, shipping, warranty)',
  secondaryHeading: 'Part Two: Site Use & Purchase Terms',
  warning: 'By completing your purchase, you confirm that you have read, understood and agreed to all the terms above.',
  closeBtn: 'Close',
  acceptBtn: 'Agree',
  sections: [
    { title: 'Pre-order system', paragraphs: ['The user acknowledges and agrees that all 3D printers shown in the store are sold on a pre-order basis, and that preparation, supply and delivery time is an estimate of up to forty-five (45) days from order confirmation, and may vary depending on shipping conditions, customs, or supplier availability.'] },
    { title: 'Payment & order confirmation', paragraphs: ['The order is confirmed once the user pays the full product price or a partial amount clearly stated on the product page. Any amount paid, in full or in part, is considered explicit and final approval to execute the order under these terms, and the order can only be cancelled per the approved cancellation policy.'] },
    { title: 'Cancellation & refunds', paragraphs: ['If the user wishes to cancel or request a refund without a substantial technical reason or proven manufacturing defect, the platform may deduct administrative and operational fees including — but not limited to — order processing costs, bank transfers, supplier reservation fees, and any logistical commitments.', 'The deduction varies by execution stage, and the user agrees these fees cannot be disputed after accepting the terms.'] },
    { title: 'Shipping & delivery', paragraphs: ['Printers and accessories are shipped via approved carriers; some parts or accessories may ship by air within an estimated period of up to two weeks, with a minimum air-shipping weight of one (1) kg.', 'The platform is not responsible for any delays caused by third parties such as carriers or customs.'] },
    { title: 'Basic warranty', paragraphs: ['The basic printer warranty starts from the purchase date, not the delivery date.', 'The warranty covers replacement of damaged parts only within the approved warranty period and does not cover faults caused by misuse, neglect, unauthorized modification, or operation contrary to the manufacturer’s instructions.'] },
    { title: 'Full replacement', paragraphs: ['The full printer is replaced only if shipping/transport damage is proven, after inspection and a certified technical report confirming the damage was not caused by the user.'] },
    { title: 'Insurance', paragraphs: ['Insurance and basic warranty are included in the product price and are not calculated or refunded separately.'] },
    { title: 'Extended warranty (monthly subscription)', paragraphs: ['The platform offers an optional monthly subscription for extended insurance providing wider and longer coverage per the announced subscription terms.', 'The subscription is optional; coverage details and exclusions follow the extended insurance service terms.'] },
    { title: 'Final acceptance', paragraphs: ['By completing purchase or payment, the user confirms they have read, understood and agreed to everything above without reservation.'] },
    { title: 'Accuracy of information & specifications', paragraphs: ['The platform displays specifications based on information from manufacturers or suppliers. Minor changes to appearance or technical specs may occur without prior notice and are not grounds for cancellation or refund unless they materially affect the product’s core performance.'] },
    { title: 'Use responsibility', paragraphs: ['The user bears full responsibility for operating the printer per the manufacturer’s manual and safety instructions. The platform is not liable for direct or indirect damage from incorrect use, loading incompatible files, or operating with unapproved materials.'] },
    { title: 'Consumables', paragraphs: ['The warranty does not cover consumables such as nozzles, build plates, belts, filters or any parts subject to natural wear, unless a manufacturing defect is proven at delivery.'] },
    { title: 'Technical support', paragraphs: ['The platform provides remote technical support during the warranty period to help with initial setup or fault diagnosis. On-site visits or advanced training are not included unless via a separate paid contract.'] },
    { title: 'Force majeure', paragraphs: ['The platform is not liable for delays or non-execution caused by events outside its control, such as natural disasters, pandemics, government restrictions, supply-chain disruption or customs decisions.'] },
    { title: 'Fees & taxes', paragraphs: ['Unless otherwise stated, displayed prices do not include customs fees or local taxes that may be imposed by official authorities; the user is responsible for paying them on receipt if applicable.'] },
    { title: 'Inspection on receipt', paragraphs: ['The user must inspect the product immediately on receipt and report any visible damage or shortage within 48 hours of delivery, providing photos or video. If not reported within that period, the product is considered received in good condition.'] },
    { title: 'Ownership & risk', paragraphs: ['Risk transfers to the user once the shipment is handed to the carrier, while ownership remains with the platform until the order is fully paid.'] },
    { title: 'Software updates', paragraphs: ['Some printers may require periodic firmware/software updates from the manufacturer. The platform is not liable for faults due to not updating the system or using unofficial versions.'] },
    { title: 'Limitation of liability', paragraphs: ['The platform’s liability is in all cases limited to the amount paid for the product only and does not cover consequential losses, lost profits, or business interruption from using the printer.'] },
    { title: 'Interpretation priority', paragraphs: ['If there is any conflict between these terms and any other marketing or interpretive content, these terms always take precedence.'] },
    { title: 'Registration & user account', paragraphs: ['The user undertakes to provide accurate information at registration and is responsible for keeping account credentials confidential. The platform is not responsible for unauthorized use resulting from leaked login data.'] },
    { title: 'Wallet usage', paragraphs: ['The user acknowledges that wallet balance is non-refundable in cash and is used exclusively for purchases on the platform. The platform pays no interest or returns on deposited balances.'] },
    { title: 'Pricing policy', paragraphs: ['Displayed prices may change without prior notice. The price applied is the one confirmed at the time of order. Prices may vary based on promotions or exchange-rate fluctuations.'] },
    { title: 'Privacy & data protection', paragraphs: ['The platform protects user data and does not share it with third parties except for order execution or legal requirements. Data may be used to improve services and send promotional notifications.'] },
    { title: 'Intellectual property', paragraphs: ['All site contents (images, text, logos, designs) are protected by intellectual property rights; users may not copy or use them commercially without prior written permission.'] },
    { title: 'Communication & notifications', paragraphs: ['The user agrees to receive notifications and updates by email, SMS or app notifications, and may unsubscribe from promotional notifications at any time.'] },
    { title: 'Modification of terms', paragraphs: ['The platform reserves the right to amend these terms at any time. Continued use of the site after amendments are published constitutes implicit acceptance.'] },
    { title: 'Governing law', paragraphs: ['These terms are governed by applicable local laws, and local courts have jurisdiction to settle any dispute arising from them.'] },
  ],
};

const ku: TermsContent = {
  dir: 'rtl',
  sheetTitle: 'مەرج و یاساکان',
  sheetDescription: 'تکایە پێش تەواوکردنی کڕینەکە، مەرج و یاساکان بە وردی بخوێنەرەوە',
  mainHeading: 'مەرج و یاساکانی فرۆشگای چاپکەری سێ ڕەهەندی',
  mainSubheading: '(داواکاری پێشوەخت، پارەدان، گەیاندن، گەرەنتی)',
  secondaryHeading: 'دووەم: مەرجەکانی بەکارهێنانی ماڵپەڕ و کڕین',
  warning: 'بە تەواوکردنی کڕین، تۆ ڕادەگەیەنیت کە هەموو ئەو مەرجانەی سەرەوەت خوێندووەتەوە و تێگەیشتوویت و ڕازی بوویت.',
  closeBtn: 'داخستن',
  acceptBtn: 'ڕازیم',
  sections: [
    { title: 'سیستەمی داواکاری پێشوەخت', paragraphs: ['بەکارهێنەر دان بەوەدا دەنێت کە هەموو چاپکەرە سێ ڕەهەندییەکان بە سیستەمی داواکاری پێشوەخت دەفرۆشرێن، و ماوەی ئامادەکردن و گەیاندن نزیکەی ٤٥ ڕۆژە لە ڕۆژی پشتڕاستکردنەوەی داواکاری، و دەکرێ زیاد یان کەم بکات بەپێی بارودۆخی گەیاندن، گومرگ یان بەردەستبوون لای دابینکەران.'] },
    { title: 'پارەدان و پشتڕاستکردنەوەی داواکاری', paragraphs: ['داواکاری پشتڕاست دەکرێتەوە دوای ئەوەی بەکارهێنەر تەواوی نرخی بەرهەم یان بڕێکی بەشدارانە دەدات کە لە لاپەڕەی بەرهەم ڕوون کراوەتەوە. هەر بڕێک کە دەدرێت، بە تەواوی یان بە بەشێک، بە ڕەزامەندی ئاشکراو کۆتایی دادەنرێت بۆ جێبەجێکردنی داواکارییەکە بەپێی ئەم مەرجانە.'] },
    { title: 'هەڵوەشاندنەوە و گەڕانەوەی پارە', paragraphs: ['ئەگەر بەکارهێنەر بیەوێت داواکاری هەڵبوەشێنێتەوە یان داوای گەڕانەوەی پارە بکات بێ هۆکاری گرنگی تەکنیکی یان عەیبی بەرهەمهێنانی سەلمێندراو، پلاتفۆرم مافی هەیە کرێی کارگێڕی و کارپێکردن بکڕێتەوە کە لەخۆ دەگرێت — بێ سنوور — کرێی پرۆسێسکردنی داواکاری، گواستنەوەی بانکی، حیجزکردن لای دابینکەر، و هەر ئەرکێکی لۆجستی.', 'بڕی داشکاندن جیاوازە بەپێی قۆناغی جێبەجێکردن، و بەکارهێنەر ڕازی دەبێت کە ئەم کرێیانە دوای ڕەزامەندی نییە جێگای ناڕەزایی.'] },
    { title: 'گەیاندن', paragraphs: ['چاپکەرەکان و کەرەستەکان لە ڕێگای کۆمپانیای گەیاندنی پەسەندکراوەوە دەنێردرێن، و هەندێک پارچە یان کەرەستە دەشێ لە ڕێگای ئاسمانەوە بنێردرێن لە ماوەی نزیکەی دوو هەفتە، بە کەمترین کێشی ئاسمانی ١ کیلۆ.', 'پلاتفۆرم بەرپرس نییە بۆ هیچ دواکەوتنێک کە لە لایەن لایەنی دەرەکی وەک کۆمپانیای گەیاندن یان گومرگەوە ڕوویدا.'] },
    { title: 'گەرەنتی سەرەکی', paragraphs: ['گەرەنتی سەرەکی چاپکەر لە ڕۆژی کڕینەوە دەستپێدەکات نەک لە ڕۆژی وەرگرتن.', 'گەرەنتییەکە تەنها گۆڕینی پارچە تێکچووەکان لەخۆ دەگرێت لە ماوەی گەرەنتیدا، و عیبە ڕووداوەکانی بەکارهێنانی هەڵە، سستی، گۆڕانکاری بێمۆڵەت یان کارپێکردنی پێچەوانەی ڕێنماییەکانی کۆمپانیای دروستکار لەخۆ ناگرێت.'] },
    { title: 'گۆڕینی تەواو', paragraphs: ['چاپکەر بە تەواوی تەنها گۆڕدراوە ئەگەر زیانی هاتوو لە کاتی گەیاندن سەلمێنرابێت، دوای پشکنین و ڕاپۆرتی تەکنیکی پەسەندکراو کە دەرکەوێ زیانەکە لە لایەن بەکارهێنەرەوە نەبووە.'] },
    { title: 'بیمە', paragraphs: ['نرخی بیمە و گەرەنتی سەرەکی لەنێو نرخی بەرهەمدایە، و جیاوازانە حساب ناکرێت یان نایێتەوە.'] },
    { title: 'گەرەنتی زیادە (بەشداری مانگانە)', paragraphs: ['پلاتفۆرم هەڵبژاردنی بەشداری مانگانە دابین دەکات بۆ خزمەتگوزاری بیمەی زیادە کە پۆشینی فراوانتر دەبەخشێت بەپێی مەرجەکانی ڕاگەیەندراو.', 'بەشدارییەکە ئاڕاستەکراوە و وردەکارییەکانی پۆشین لاسایی مەرجەکانی خزمەتی بیمەی زیادە دەکات.'] },
    { title: 'پەسەندی کۆتایی', paragraphs: ['بە تەواوکردنی کڕین یان پارەدان، بەکارهێنەر دان بەوەدا دەنێت کە هەموو ئەوەی سەرەوەی خوێندووەتەوە و تێگەیشتوویە و ڕازی بووە.'] },
    { title: 'ووردبینی زانیاری و تایبەتمەندی', paragraphs: ['پلاتفۆرم تایبەتمەندی بەرهەمەکان لەسەر بنەمای زانیاری دابینکەران یان کۆمپانیا دروستکارەکان نیشان دەدات. لەوانەیە گۆڕانکاریی بچووک ڕووبدات بێ ئاگاداربوونەوە، و ئەمە هۆکار نییە بۆ هەڵوەشاندنەوە مەگەر کاریگەری بنەڕەتی لەسەر کارایی بەرهەمەکە هەبێت.'] },
    { title: 'بەرپرسیاری بەکارهێنان', paragraphs: ['بەکارهێنەر بە تەواوی بەرپرسە لە کارپێکردنی چاپکەر بەپێی ڕێبەری کۆمپانیای دروستکار. پلاتفۆرم بەرپرس نییە بۆ هیچ زیانێکی ڕاستەوخۆ یان ناڕاستەوخۆ کە لە بەکارهێنانی هەڵە، فایلی نەگونجاو یان کارپێکردن بە کەرەستەی پەسەندنەکراو ڕوویدا.'] },
    { title: 'کەرەستەی بەکارهاتوو', paragraphs: ['گەرەنتی هیچ کەرەستەیەکی بەکارهاتوو وەک ڕووکارەکان، نوستنگاکان، پاتکەکان، فلتەرەکان یان هەر پارچەیەک کە بە سروشتی بەکار دێت لەخۆ ناگرێت، مەگەر عەیبی دروستکردن لە کاتی وەرگرتن سەلمێنرابێت.'] },
    { title: 'پشتگیری تەکنیکی', paragraphs: ['پلاتفۆرم پشتگیری تەکنیکی لە دوورەوە دابین دەکات لە ماوەی گەرەنتیدا بۆ یارمەتیدان لە ڕێکخستنی سەرەتایی یان دیاریکردنی کێشە. پشتگیری تەکنیکی سەردان یان ڕاهێنانی پێشکەوتوو لەخۆ ناگرێت مەگەر بە گرێبەستی جیاواز بێت.'] },
    { title: 'دواکەوتنی ناچاری', paragraphs: ['پلاتفۆرم بەرپرس نییە بۆ دواکەوتن یان جێبەجێ نەکردن کە دەرئەنجامی بارودۆخی دەرەوەی ویستە، وەک کارەساتی سروشتی، نەخۆشی گشتی، سنوورداری حکومی، تێکچوونی زنجیرەی دابینکردن یان بڕیاری گومرگی.'] },
    { title: 'کرێ و باج', paragraphs: ['نرخە نیشاندراوەکان — مەگەر بە جۆرێکی تر باسکرابێت — کرێی گومرگی یان باجی ناوخۆیی لەخۆ ناگرن کە لە لایەن لایەنە فەرمییەکانەوە دادەنرێن، و بەکارهێنەر بەرپرسە لە دانیان لە کاتی وەرگرتن.'] },
    { title: 'پشکنین لە کاتی وەرگرتن', paragraphs: ['بەکارهێنەر دەبێت یەکسەر لە کاتی وەرگرتن بەرهەم بپشکنێت و لە ماوەی ٤٨ کاتژمێردا هەر زیانێکی دیار یان کەمی ڕابگەیەنێت، لەگەڵ وێنە یان ڤیدیۆ. ئەگەر لە ماوەی دیاریکراودا ڕانەگەیەندرا، بەرهەمەکە بە بارودۆخی باش وەرگیراو دانراوە.'] },
    { title: 'خاوەنایەتی و مەترسی', paragraphs: ['بەرپرسایەتی مەترسی دەگوازرێتەوە بۆ بەکارهێنەر هەرکە کاڵاکە بە کۆمپانیای گەیاندن دەدرێت، بەڵام خاوەنایەتی بەرهەمەکە بۆ پلاتفۆرم دەمێنێتەوە تا تەواوی نرخ دەدرێت.'] },
    { title: 'نوێکردنەوەی نەرمواڵا', paragraphs: ['هەندێک چاپکەر پێویستی بە نوێکردنەوەی فێرموێر یان نەرمواڵای ماوەیی هەیە لە لایەن کۆمپانیای دروستکارەوە. پلاتفۆرم بەرپرس نییە بۆ کێشە کە لە ئەنجامی نەکردنی نوێکردنەوە یان بەکارهێنانی وەشانی نافەرمی ڕوویدا.'] },
    { title: 'سنووری بەرپرسایەتی', paragraphs: ['بەرپرسایەتی پلاتفۆرم — لە هەموو حاڵەتدا — تەنها بە بڕی پارەی دراوی بەرهەمەکە سنووردارە، و هیچ زیانێکی لاوەکی، لەدەستچوونی قازانج یان وەستانی کار لەخۆ ناگرێت.'] },
    { title: 'لیپرسراویەتی لێکدانەوە', paragraphs: ['ئەگەر هیچ ناکۆکیەک هەبێت لە نێوان ئەم مەرجانە و هەر ناوەڕۆکێکی تری بازرگانی یان لێکدانەوە، یەکێتی لێکدانەوە هەمیشە بۆ ئەم مەرجانەیە.'] },
    { title: 'تۆمارکردن و ئەکاونتی بەکارهێنەر', paragraphs: ['بەکارهێنەر بەڵێن دەدات کە زانیاری ڕاست بدات لە کاتی تۆمارکردن، و بەرپرسە لە پاراستنی نهێنیی زانیاری چوونەژوورەوە. پلاتفۆرم بەرپرس نییە بۆ بەکارهێنانی نامۆڵەت کە لە درکاندنی زانیاریوە دەردەکەوێت.'] },
    { title: 'بەکارهێنانی جزدانی ئەلیکترۆنی', paragraphs: ['بەکارهێنەر دان بەوەدا دەنێت کە باڵانسی جزدان بە پارە ناگەڕێتەوە و تەنها بۆ کڕین لە پلاتفۆرم بەکار دێت. پلاتفۆرم هیچ سوود یان قازانجێک لەسەر باڵانسە دامەزرێنراوەکان نادات.'] },
    { title: 'پۆلیسی نرخ', paragraphs: ['نرخە نیشاندراوەکان دەکرێ بێ ئاگاداربوونەوە بگۆڕێن. نرخی پەسەندکراو ئەو نرخەیە کە لە کاتی پشتڕاستکردنەوەی داواکاری دانراوە. نرخەکان لەوانەیە جیاواز بن بەپێی پێشکەشکراوە یان گۆڕانی نرخی دراو.'] },
    { title: 'تایبەتمەندی و پاراستنی زانیاری', paragraphs: ['پلاتفۆرم زانیاری بەکارهێنەران دەپارێزێت و لەگەڵ لایەنی سێیەم بەشداری ناکات مەگەر بۆ جێبەجێکردنی داواکاری یان داواکارییە یاساییەکان. زانیارییەکان لەوانەیە بۆ باشترکردنی خزمەتگوزاری و ناردنی ئاگاداری بازرگانی بەکار بهێنرێن.'] },
    { title: 'موڵکی هزری', paragraphs: ['هەموو ناوەڕۆکی ماڵپەڕ (وێنە، نووسین، لۆگۆ، دیزاین) پارێزراوە بە مافی موڵکی هزری، و بەکارهێنەر مافی نییە بەرگەلۆجی بکات یان بۆ مەبەستی بازرگانی بەکار بهێنێت بێ مۆڵەتی نووسراوی پێشوەخت.'] },
    { title: 'پەیوەندی و ئاگاداری', paragraphs: ['بەکارهێنەر ڕازی دەبێت ئاگاداری و نوێکارییەکان لە ڕێگای ئیمەیل، نامەی نووسراو یان ئاگاداری ئەپ وەربگرێت. دەتوانێت لە هەر کاتێکدا لە ئاگاداری بازرگانی دەربچێت.'] },
    { title: 'گۆڕینی مەرجەکان', paragraphs: ['پلاتفۆرم مافی گۆڕینی ئەم مەرجانەی هەیە لە هەر کاتێکدا. بەردەوامی لە بەکارهێنانی ماڵپەڕ دوای بڵاوکردنەوەی گۆڕانکاری بە ڕەزامەندی ناڕاستەوخۆ دانراوە.'] },
    { title: 'یاسای جێبەجێکراو', paragraphs: ['ئەم مەرجانە لە ژێر یاسا ناوخۆییە جێبەجێکراوەکاندان، و دادگاکانی ناوخۆ تایبەتمەندن بە چارەسەرکردنی هەر ناکۆکیەک.'] },
  ],
};

export const TERMS_BY_LANG: Record<Lang, TermsContent> = { ar, en, ku };
