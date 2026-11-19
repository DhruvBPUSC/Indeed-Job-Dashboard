import {
  Bookmark,
  FileText,
  GraduationCap,
  House,
  MessageSquare,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Home', icon: House },
  { to: '/applications', label: 'My Applications', icon: FileText },
  { to: '/saved', label: 'Saved Jobs', icon: Bookmark },
  { to: '/messages', label: 'Messages', icon: MessageSquare },
  { to: '/resources', label: 'Career Resources', icon: GraduationCap },
];
