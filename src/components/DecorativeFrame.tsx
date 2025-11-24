const DecorativeFrame = () => {
  return (
    <>
      {/* نسخة خاصة للشاشات الصغيرة: تمد الصورة على كامل العرض والارتفاع للحفاظ على الإطار */}
      <div 
        className="fixed inset-0 pointer-events-none z-0 opacity-25 md:hidden"
        style={{
          backgroundImage: 'url(/images/decorative-frame-levonis.png)',
          backgroundSize: '100% 100%',
          backgroundPosition: 'top center',
          backgroundRepeat: 'no-repeat',
          mixBlendMode: 'multiply',
          filter: 'brightness(0)'
        }}
      />

      {/* نسخة لسطح المكتب والأجهزة الكبيرة: استخدام cover لمظهر أنيق دون تشويه كبير */}
      <div 
        className="fixed inset-0 pointer-events-none z-0 opacity-20 hidden md:block"
        style={{
          backgroundImage: 'url(/images/decorative-frame-levonis.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'top center',
          backgroundRepeat: 'no-repeat',
          mixBlendMode: 'multiply',
          filter: 'brightness(0)'
        }}
      />
    </>
  );
};

export default DecorativeFrame;
