import { Outlet } from 'react-router-dom';
import { useState } from 'react';
import { useSpatialNavInit } from '@/hooks/useSpatialNavInit';
import { TVSidebar } from './TVSidebar';

export function AppShell() {
  useSpatialNavInit();

  const [sidebarFocused, setSidebarFocused] = useState(false);

  return (
    <div
      className="grid h-dvh overflow-hidden bg-bg"
      style={{
        gridTemplateColumns: sidebarFocused
          ? 'var(--sidebar-w, 200px) 1fr'
          : 'var(--sidebar-w-collapsed, 72px) 1fr',
        gridTemplateAreas: '"sidebar main"',
        transition: 'grid-template-columns 0.3s ease-out',
      }}
    >
      <TVSidebar onFocusChange={setSidebarFocused} />
      <main className="h-full w-full overflow-hidden" style={{ gridArea: 'main' }}>
        <Outlet />
      </main>
    </div>
  );
}
