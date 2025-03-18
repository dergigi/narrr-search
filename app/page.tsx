import { Suspense } from 'react';
import MainContent from '@/components/MainContent';
import { NostrProvider } from './contexts/NostrContext';

export default function Home() {
  console.log('Server: Rendering home page');
  
  return (
    <main className="min-h-screen bg-black text-white">
      <NostrProvider>
        <Suspense fallback={
          <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center">
            <div className="cyber-spinner mb-4">
              <div className="cyber-spinner-polygon"></div>
              <div className="cyber-spinner-polygon"></div>
            </div>
            <p className="text-purple-400 font-mono">LOADING...</p>
          </div>
        }>
          <MainContent />
        </Suspense>
      </NostrProvider>
    </main>
  );
}
