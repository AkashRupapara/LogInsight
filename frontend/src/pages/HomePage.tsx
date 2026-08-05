import { useAuth } from '../context/AuthContext';

export function HomePage() {
  const { user, logout } = useAuth();

  return (
    <div>
      <p>
        Signed in as {user?.email}. <button onClick={logout}>Log out</button>
      </p>
      <p>Upload page coming next.</p>
    </div>
  );
}
