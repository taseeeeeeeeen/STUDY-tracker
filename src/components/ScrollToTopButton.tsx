import React, { useState, useEffect } from 'react';

export const ScrollToTopButton: React.FC = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 300) {
        setVisible(true);
      } else {
        setVisible(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  if (!visible) return null;

  return (
    <button
      onClick={scrollToTop}
      className="fixed bottom-6 right-6 z-40 w-12 h-12 rounded-full bg-[#003820] text-white hover:bg-[#0f5132] shadow-xl flex items-center justify-center transition-all duration-300 animate-in fade-in zoom-in-75 cursor-pointer ring-2 ring-[#6ffbbe]/20 focus:outline-none focus:ring-[#6ffbbe]"
      aria-label="Scroll to top"
    >
      <span className="material-symbols-outlined text-xl">arrow_upward</span>
    </button>
  );
};
