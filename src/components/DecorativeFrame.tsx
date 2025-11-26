const DecorativeFrame = () => {
  return (
    <div className="fixed inset-0 pointer-events-none -z-10">
      <img
        src="/images/decorative-frame-levonis.png"
        alt=""
        className="w-full h-full object-cover opacity-30 md:opacity-25"
        style={{
          mixBlendMode: 'multiply',
          filter: 'brightness(0.9)'
        }}
      />
    </div>
  );
};

export default DecorativeFrame;
