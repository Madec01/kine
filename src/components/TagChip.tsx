import type { Tag, TagFamily } from '../data/types';

interface Props {
  tag: Tag;
  family?: TagFamily;
  selected?: boolean;
  count?: number;
  small?: boolean;
  onClick?: () => void;
  title?: string;
}

export function TagChip({ tag, family, selected, count, small, onClick, title }: Props) {
  const className = ['chip', small ? 'chip--sm' : '', onClick ? 'chip--btn' : '', selected ? 'is-selected' : ''].filter(Boolean).join(' ');
  const content = (
    <>
      <span className="chip__dot" />
      {tag.name}
      {count !== undefined && count > 0 && <span className="chip__count">{count}</span>}
    </>
  );
  if (onClick) {
    return (
      <button type="button" className={className} data-color={family?.color ?? 'sable'} aria-pressed={selected} onClick={onClick} title={title}>
        {content}
      </button>
    );
  }
  return (
    <span className={className} data-color={family?.color ?? 'sable'} title={title}>
      {content}
    </span>
  );
}
