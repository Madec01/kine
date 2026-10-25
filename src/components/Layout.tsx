import { NavLink, Outlet, Link } from 'react-router-dom';
import { useAuth } from '../state/AuthProvider';
import { useLibrary } from '../state/LibraryProvider';
import { useSelection } from '../state/SelectionProvider';
import { IconExercises, IconSettings, IconSheet, IconTags } from './icons';

const links = [
  { to: '/exercices', label: 'Exercices', Icon: IconExercises },
  { to: '/tags', label: 'Tags', Icon: IconTags },
  { to: '/selection', label: 'Sélection', Icon: IconSheet },
  { to: '/reglages', label: 'Réglages', Icon: IconSettings },
];

function Nav({ badge }: { badge: number }) {
  return (
    <>
      {links.map(({ to, label, Icon }) => (
        <NavLink key={to} to={to} className={({ isActive }) => `navlink ${isActive ? 'is-active' : ''}`}>
          <Icon />
          <span>{label}</span>
          {to === '/selection' && badge > 0 && <span className="navlink__badge">{badge}</span>}
        </NavLink>
      ))}
    </>
  );
}

export function Layout() {
  const { repo, user } = useAuth();
  const { library, role } = useLibrary();
  const { count } = useSelection();
  const roleLabel = role === 'owner' ? 'Propriétaire' : role === 'editor' ? 'Collaborateur' : 'Lecteur';

  return (
    <div className="app">
      <aside className="sidebar">
        <Link to="/exercices" className="brand">
          <span className="brand__mark">Kiné</span>
          <span className="brand__sub">Bibliothèque d’exercices</span>
        </Link>
        <nav aria-label="Navigation principale" style={{ display: 'grid', gap: 4 }}>
          <Nav badge={count} />
        </nav>
        <div className="sidebar__foot">
          <span>
            <span className={`badge ${repo.mode === 'supabase' ? 'badge--ok' : 'badge--warn'}`}>
              {repo.mode === 'supabase' ? 'En ligne · sécurisé' : 'Mode local'}
            </span>
          </span>
          {library && (
            <span>
              {library.name} · {roleLabel}
            </span>
          )}
          {user && <span style={{ overflowWrap: 'anywhere' }}>{user.email}</span>}
        </div>
      </aside>

      <header className="topbar">
        <Link to="/exercices" className="brand">
          <span className="brand__mark">Kiné</span>
          <span className="brand__sub">Exercices</span>
        </Link>
        <span className={`badge ${repo.mode === 'supabase' ? 'badge--ok' : 'badge--warn'}`}>
          {repo.mode === 'supabase' ? 'En ligne' : 'Local'}
        </span>
      </header>

      <main className="app__main">
        <Outlet />
      </main>

      <nav className="bottomnav" aria-label="Navigation principale">
        <Nav badge={count} />
      </nav>
    </div>
  );
}
