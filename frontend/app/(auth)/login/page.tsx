import { Suspense } from 'react';
import { LoginScreen } from './LoginScreen';

export default function LoginPage() {
  return (
    <Suspense>
      <LoginScreen />
    </Suspense>
  );
}
