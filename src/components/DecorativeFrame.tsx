const DecorativeFrame = () => {
  return (
    <div 
      className="fixed inset-0 pointer-events-none z-0 opacity-25"
      style={{
        backgroundImage: 'url(/images/decorative-frame-levonis.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        mixBlendMode: 'multiply',
        filter: 'brightness(0.8)'
      }}
    />
  );
};

export default DecorativeFrame;
