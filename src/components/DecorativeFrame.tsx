const DecorativeFrame = () => {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 flex items-center justify-center">
      <img
        src="/images/decorative-frame-levonis.png"
        alt="إطار زخرفي حول خلفية متجر ليفونيس"
        className="w-full h-auto object-contain opacity-25"
        style={{
          mixBlendMode: 'multiply'
        }}
      />
    </div>
  );
};

export default DecorativeFrame;
