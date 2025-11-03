const WhatsAppButton = () => {
  return (
    <a
      href="https://wa.me/9647838455220"
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 left-6 w-16 h-16 rounded-full flex items-center justify-center z-[9999] shadow-2xl hover:scale-110 transition-all duration-300 group"
      style={{
        background: 'radial-gradient(120% 120% at 30% 30%, #2fe080 0%, #25D366 60%, #1da955 100%)',
        boxShadow: '0 8px 20px rgba(0,0,0,.35), inset 0 0 0 2px rgba(255,255,255,.08)'
      }}
      aria-label="دردشة واتساب"
    >
      {/* Pulse ring on hover */}
      <span className="absolute inset-0 rounded-full bg-[#25D366] opacity-0 group-hover:opacity-30 group-hover:scale-150 transition-all duration-500" />
      
      <svg className="w-8 h-8 fill-white relative z-10" viewBox="0 0 32 32" aria-hidden="true">
        <path d="M19.11 17.03c-.27-.14-1.58-.78-1.83-.87-.25-.09-.43-.14-.62.14-.18.27-.71.86-.87 1.03-.16.18-.32.2-.59.07-.27-.14-1.14-.42-2.17-1.33-.8-.71-1.34-1.58-1.5-1.85-.16-.27-.02-.42.12-.56.12-.12.27-.32.41-.48.14-.16.18-.27.27-.45.09-.18.05-.34-.02-.48-.07-.14-.62-1.5-.86-2.05-.23-.55-.46-.48-.62-.48-.16 0-.34-.02-.52-.02s-.48.07-.73.34c-.25.27-.96.94-.96 2.29 0 1.35.98 2.66 1.12 2.85.14.18 1.93 2.95 4.68 4.02.65.28 1.16.45 1.55.58.65.2 1.24.17 1.71.1.52-.08 1.58-.64 1.8-1.26.23-.62.23-1.16.16-1.26-.07-.09-.25-.16-.52-.3zM16.02 3.2C8.83 3.2 3 8.98 3 16.1c0 2.28.61 4.42 1.67 6.26L3 29l6.83-1.79c1.79.98 3.85 1.54 6.19 1.54 7.19 0 13.02-5.78 13.02-12.9C29.04 8.98 23.21 3.2 16.02 3.2zm0 22.96c-1.98 0-3.82-.53-5.4-1.45l-.39-.23-4.05 1.06 1.08-3.94-.25-.41A10.6 10.6 0 0 1 5.42 16.1c0-5.86 4.8-10.62 10.7-10.62s10.7 4.76 10.7 10.62-4.8 10.62-10.7 10.62z"/>
      </svg>
    </a>
  );
};

export default WhatsAppButton;