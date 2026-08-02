import {
  BookOpen,
  Brain,
  Calculator,
  FlaskConical,
  Folder,
  Globe2,
  Landmark,
  Leaf,
  Scale,
  ScrollText,
  type LucideIcon,
} from "lucide-react";

/** Curated folder colours/icons. The lists mirror the database check
 *  constraints in supabase/migrations/20260803000004_folder_style.sql. */

export const FOLDER_COLOR_NAMES = [
  "indigo",
  "blue",
  "teal",
  "emerald",
  "amber",
  "rose",
  "violet",
  "slate",
] as const;
export type FolderColor = (typeof FOLDER_COLOR_NAMES)[number];

interface FolderColorStyle {
  /** Icon tile on cards and page headers. */
  tile: string;
  /** Small solid dot used in the colour picker. */
  swatch: string;
  /** Inline chip (set detail badge). */
  chip: string;
}

export const FOLDER_COLORS: Record<FolderColor, FolderColorStyle> = {
  indigo: {
    tile: "bg-indigo-500/15 text-indigo-700 dark:bg-indigo-400/20 dark:text-indigo-300",
    swatch: "bg-indigo-500",
    chip: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  },
  blue: {
    tile: "bg-sky-500/15 text-sky-700 dark:bg-sky-400/20 dark:text-sky-300",
    swatch: "bg-sky-500",
    chip: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  },
  teal: {
    tile: "bg-teal-500/15 text-teal-700 dark:bg-teal-400/20 dark:text-teal-300",
    swatch: "bg-teal-500",
    chip: "bg-teal-500/15 text-teal-700 dark:text-teal-300",
  },
  emerald: {
    tile: "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-400/20 dark:text-emerald-300",
    swatch: "bg-emerald-500",
    chip: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  },
  amber: {
    tile: "bg-amber-500/20 text-amber-800 dark:bg-amber-400/20 dark:text-amber-300",
    swatch: "bg-amber-500",
    chip: "bg-amber-500/20 text-amber-800 dark:text-amber-300",
  },
  rose: {
    tile: "bg-rose-500/15 text-rose-700 dark:bg-rose-400/20 dark:text-rose-300",
    swatch: "bg-rose-500",
    chip: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  },
  violet: {
    tile: "bg-violet-500/15 text-violet-700 dark:bg-violet-400/20 dark:text-violet-300",
    swatch: "bg-violet-500",
    chip: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  },
  slate: {
    tile: "bg-slate-500/15 text-slate-700 dark:bg-slate-400/20 dark:text-slate-300",
    swatch: "bg-slate-500",
    chip: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
  },
};

export const FOLDER_ICON_NAMES = [
  "folder",
  "book",
  "landmark",
  "globe",
  "scroll",
  "flask",
  "calculator",
  "scale",
  "leaf",
  "brain",
] as const;
export type FolderIcon = (typeof FOLDER_ICON_NAMES)[number];

export const FOLDER_ICONS: Record<FolderIcon, LucideIcon> = {
  folder: Folder,
  book: BookOpen,
  landmark: Landmark,
  globe: Globe2,
  scroll: ScrollText,
  flask: FlaskConical,
  calculator: Calculator,
  scale: Scale,
  leaf: Leaf,
  brain: Brain,
};

export function folderColorStyle(color: string): FolderColorStyle {
  return FOLDER_COLORS[color as FolderColor] ?? FOLDER_COLORS.indigo;
}

export function folderIconComponent(icon: string): LucideIcon {
  return FOLDER_ICONS[icon as FolderIcon] ?? Folder;
}
