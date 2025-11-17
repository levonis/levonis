const DecorativeFrame = () => {
  return (
    <div 
      className="fixed inset-0 pointer-events-none z-0 opacity-15 md:opacity-25"
      style={{
        backgroundImage: 'url(/images/decorative-frame-levonis.png)',
        backgroundSize: '100% 100%',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        mixBlendMode: 'multiply'
      }}
    />
  );
};

export default DecorativeFrame;
