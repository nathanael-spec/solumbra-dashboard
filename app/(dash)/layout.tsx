import { DataProvider } from '@/lib/store';
import { Shell } from '@/components/Shell';

export default function DashLayout({ children }: { children: React.ReactNode }) {
  return (
    <DataProvider>
      <Shell>{children}</Shell>
    </DataProvider>
  );
}
