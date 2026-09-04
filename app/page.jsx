import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { COOKIE_NAME, safeEqual, sessionToken } from './auth';

export default async function LoginPage({ searchParams }) {
  const jar = await cookies();
  const expected = sessionToken();
  const actual = jar.get(COOKIE_NAME)?.value;
  if (expected && safeEqual(actual, expected)) redirect('/radar');
  const params = await searchParams;
  const failed = params?.error === '1';

  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="login-kicker">PRIVATE ACCESS</div>
        <h1>PlayStation Radar</h1>
        <p>Geschützte Daily-Intelligence-Ansicht.</p>
        {failed ? <div className="error">Passwort nicht korrekt.</div> : null}
        <form action="/api/login" method="post">
          <input type="password" name="password" placeholder="Passwort" autoComplete="current-password" required autoFocus />
          <button type="submit">Radar öffnen</button>
        </form>
      </section>
    </main>
  );
}
