import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';

import { useLogin } from '../../auth/auth';
import { TextField } from '../../components/ui/TextField';
import { ApiError } from '../../lib/api';
import { AuthShell } from './AuthShell';
import { authLinkClass, submitButtonClass, useReturnTo } from './authHelpers';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const login = useLogin();
  const navigate = useNavigate();
  const returnTo = useReturnTo();

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    login.mutate(
      { email, password },
      { onSuccess: () => void navigate(returnTo, { replace: true }) },
    );
  };

  const err = login.error instanceof ApiError ? login.error : null;
  const fieldErrors = err?.fieldErrors() ?? {};
  const formError = err && Object.keys(fieldErrors).length === 0 ? err.message : undefined;

  return (
    <AuthShell
      title="Sign in"
      subtitle="Pick up your job search where you left off."
      formError={formError}
      footer={
        <>
          New here?{' '}
          <Link to="/register" className={authLinkClass}>
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={fieldErrors.email}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldErrors.password}
        />
        <button type="submit" disabled={login.isPending} className={submitButtonClass}>
          {login.isPending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </AuthShell>
  );
}
