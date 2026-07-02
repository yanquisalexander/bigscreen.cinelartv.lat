import { Outlet } from 'react-router-dom';
import { useSpatialNavInit } from '@/hooks/useSpatialNavInit';
import { TVSidebar } from './TVSidebar';

export function AppShell() {
  useSpatialNavInit();

  return (
    <div className="relative h-dvh overflow-hidden bg-bg">
      <TVSidebar />
      <main className="h-full w-full overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
