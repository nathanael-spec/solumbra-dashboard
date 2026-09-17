import { LoginForm } from '@/components/LoginForm';
import { readConfig } from '@/lib/config';

export const dynamic = 'force-dynamic';

export default function LoginPage() {
  const c = readConfig();
  return <LoginForm name={c.businessName} logoUrl={c.logoUrl} />;
}
