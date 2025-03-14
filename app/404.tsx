'use client';

export default function Custom404() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center bg-black">
      <div className="absolute inset-0 bg-gradient-to-b from-purple-900/20 to-transparent pointer-events-none blur-2xl opacity-30 -z-10"></div>
      
      <div className="cyber-border rounded-xl shadow-lg shadow-purple-900/20 p-8 max-w-md">
        <h1 className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-purple-600 font-mono cyber-glitch-text flex items-center justify-center mb-6">
          <span className="mr-3">4</span>
          <span className="text-6xl">🏴‍☠️</span>
          <span className="ml-3">4</span>
        </h1>
        
        <p className="text-xl text-gray-300 mb-6">
          SIGNAL LOST // COORDINATES UNKNOWN
        </p>
        
        <div className="text-sm text-gray-400 font-mono mb-8 bg-gray-900/50 p-4 rounded-lg">
          <p>
            &gt; ERROR: REQUESTED NODE NOT FOUND IN RELAY NETWORK
            <br />
            &gt; CONNECTION TERMINATED
          </p>
        </div>
        
        <a
          href="/"
          className="inline-flex items-center justify-center px-6 py-3 bg-purple-600 text-white rounded-md transition-all duration-300 hover:bg-purple-700 hover:shadow-lg hover:shadow-purple-900/50 cyber-glow font-mono"
        >
          RETURN TO BASE 🏴‍☠️
        </a>
      </div>
    </div>
  );
} 