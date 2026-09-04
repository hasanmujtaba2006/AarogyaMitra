'use client'

export default function Footer() {
  return (
    <footer className="bg-white border-t border-slate-200 mt-auto shrink-0 z-10 flex flex-col print:hidden">
      {/* GIGW Tricolor Footer Top Ribbon */}
      <div className="h-1 w-full flex shrink-0">
        <div className="h-full flex-1 bg-[#F97316]"></div>
        <div className="h-full flex-1 bg-white border-y border-slate-100"></div>
        <div className="h-full flex-1 bg-[#16A34A]"></div>
      </div>
      <div className="max-w-7xl mx-auto w-full py-2.5 sm:py-3 px-3 sm:px-6 flex flex-col sm:flex-row justify-between items-center gap-2 sm:gap-4">
        {/* Left/Center: Digital India Logo */}
        <div className="flex items-center shrink-0">
          <img
            src="/logos/digital-india-logo.jpg"
            alt="Digital India"
            className="h-6 xs:h-7 sm:h-9 w-auto object-contain"
          />
        </div>
        {/* Center/Right: Mockup Disclaimer */}
        <div className="text-center sm:text-right">
          <p className="text-[10px] xs:text-[11px] sm:text-xs text-gray-400 font-medium leading-relaxed">
            Mockup for Smart India Hackathon Prototype Only. Not an official government application.
          </p>
        </div>
      </div>
    </footer>
  )
}
