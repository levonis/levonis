const DecorativeFrame = () => {
  return (
    <div 
      className="fixed inset-0 pointer-events-none z-0 opacity-15 md:opacity-25"
      style={{
        backgroundImage: 'url(/images/decorative-frame-levonis.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'top center',
        backgroundRepeat: 'no-repeat',
        mixBlendMode: 'multiply',
        filter: 'brightness(0)'
      }}
    />
  );
};

export default DecorativeFrame;
