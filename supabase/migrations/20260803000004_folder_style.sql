-- Folder personalization: a curated colour and icon per folder.

alter table public.folders
  add column color text not null default 'indigo',
  add column icon text not null default 'folder';

alter table public.folders
  add constraint folders_color_check check (
    color in ('indigo', 'blue', 'teal', 'emerald', 'amber', 'rose', 'violet', 'slate')
  ),
  add constraint folders_icon_check check (
    icon in ('folder', 'book', 'landmark', 'globe', 'scroll', 'flask', 'calculator', 'scale', 'leaf', 'brain')
  );
