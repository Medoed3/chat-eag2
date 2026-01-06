// frontend/src/components/LoadingScreen.tsx
const LoadingScreen = () => {
  return (
    <div className="fixed inset-0 bg-gradient-to-br from-[#0088cc] to-[#00a2ff] flex flex-col items-center justify-center">
      <div className="relative">
        {/* Анимированные круги */}
        <div className="w-20 h-20 border-4 border-white/30 rounded-full animate-ping" />
        <div className="absolute inset-0 w-20 h-20 border-4 border-white border-t-transparent rounded-full animate-spin" />

        {/* Логотип */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-white font-bold text-xl">💬</div>
        </div>
      </div>

      <div className="mt-8 text-white text-lg font-semibold">
        Корпоративный мессенджер
      </div>
      <div className="mt-2 text-white/80 text-sm">
        Загрузка...
      </div>

      {/* Волны внизу */}
      <div className="absolute bottom-0 left-0 right-0 overflow-hidden">
        <svg
          className="w-full h-12"
          viewBox="0 0 1440 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M0 60L48 68C96 76 192 92 288 92C384 92 480 76 576 60C672 44 768 28 864 28C960 28 1056 44 1152 52C1248 60 1344 60 1392 60H1440V120H1392C1344 120 1248 120 1152 120C1056 120 960 120 864 120C768 120 672 120 576 120C480 120 384 120 288 120C192 120 96 120 48 120H0V60Z"
            fill="white"
            fillOpacity="0.1"
          />
        </svg>
      </div>
    </div>
  )
}

export default LoadingScreen