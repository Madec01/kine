import { NavLink, Outlet, Link } from 'react-router-dom';
import { useLibrary } from '../state/LibraryProvider';
import { useSelection } from '../state/SelectionProvider';
import { IconExercises, IconSettings, IconSheet, IconTags } from './icons';
import { SyncBadge } from './SyncBadge';

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
  const { library } = useLibrary();
  const { count } = useSelection();

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
          <SyncBadge />
          {library && <span>{library.name}</span>}
        </div>
      </aside>

      <header className="topbar">
        <Link to="/exercices" className="brand">
          <span className="brand__mark">Kiné</span>
          <span className="brand__sub">Exercices</span>
        </Link>
        <SyncBadge compact />
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
