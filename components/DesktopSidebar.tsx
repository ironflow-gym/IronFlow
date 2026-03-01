import React from 'react';
import { Layout, Dumbbell, History, Search, BookOpen, Utensils, ShieldCheck, FileText, Trash2, Settings, Plus } from 'lucide-react';
import { useMediaQuery } from '../hooks/useMediaQuery';

interface DesktopSidebarProps {
  activeTab: 'plan' | 'active' | 'history';
  onTabChange: (tab: 'plan' | 'active' | 'history') => void;
  onOpenDiscovery: () => void;
  onNewTemplate: () => void;
  onOpenLibrary: () => void;
  onOpenPantry: () => void;
  onOpenBackup: () => void;
  onOpenCSV: () => void;
  onOpenTrash: () => void;
  onOpenSettings: () => void;
}

interface NavItem {
  icon: React.ReactNode;
  label: string;
  action: () => void;
  isTab?: boolean;
  tabKey?: 'plan' | 'active' | 'history';
  accent?: string;
}

const DesktopSidebar: React.FC<DesktopSidebarProps> = ({
  activeTab, onTabChange,
  onOpenDiscovery, onNewTemplate, onOpenLibrary,
  onOpenPantry, onOpenBackup, onOpenCSV, onOpenTrash, onOpenSettings,
}) => {
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  if (!isDesktop) return null;

  const primaryNav: NavItem[] = [
    { icon: <Layout size={20} />, label: 'Plan', action: () => onTabChange('plan'), isTab: true, tabKey: 'plan' },
    { icon: <Dumbbell size={20} />, label: 'Workout', action: () => onTabChange('active'), isTab: true, tabKey: 'active' },
    { icon: <History size={20} />, label: 'Stats', action: () => onTabChange('history'), isTab: true, tabKey: 'history' },
  ];

  const secondaryNav: NavItem[] = [
    { icon: <Search size={18} />, label: 'Find Workout', action: onOpenDiscovery, accent: 'text-emerald-400' },
    { icon: <Plus size={18} />, label: 'New Template', action: onNewTemplate, accent: 'text-emerald-400' },
    { icon: <BookOpen size={18} />, label: 'Library', action: onOpenLibrary, accent: 'text-emerald-400' },
    { icon: <Utensils size={18} />, label: 'Food Pantry', action: onOpenPantry, accent: 'text-orange-400' },
    { icon: <ShieldCheck size={18} />, label: 'Vault Backup', action: onOpenBackup, accent: 'text-emerald-400' },
    { icon: <FileText size={18} />, label: 'Manage Data', action: onOpenCSV, accent: 'text-emerald-400' },
    { icon: <Trash2 size={18} />, label: 'Trash Can', action: onOpenTrash, accent: 'text-rose-400' },
  ];

  const NavButton: React.FC<{ item: NavItem }> = ({ item }) => {
    const isActive = item.isTab && item.tabKey === activeTab;
    const iconColor = isActive
      ? 'text-emerald-400'
      : item.accent || 'text-slate-400';

    return (
      <button
        onClick={item.action}
        title={item.label}
        className={`group/btn w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-all duration-150
          ${isActive
            ? 'bg-emerald-500/10 border border-emerald-500/20'
            : 'hover:bg-slate-800/70 border border-transparent'
          }`}
      >
        <span className={`shrink-0 transition-colors ${iconColor}`}>
          {item.icon}
        </span>
        {/* Label — visible only when sidebar is expanded */}
        <span className={`text-[11px] font-black uppercase tracking-widest whitespace-nowrap overflow-hidden transition-all duration-200
          w-0 opacity-0 group-hover/sidebar:w-28 group-hover/sidebar:opacity-100
          ${isActive ? 'text-emerald-400' : 'text-slate-300'}`}>
          {item.label}
        </span>
      </button>
    );
  };

  return (
    <aside className={`group/sidebar hidden lg:flex flex-col fixed left-0 top-0 h-full z-40
      bg-slate-900/95 backdrop-blur-xl border-r border-slate-800 shadow-2xl
      transition-all duration-200 ease-out
      w-16 hover:w-52 overflow-hidden`}
    >
      {/* Logo mark */}
      <div className="px-3 py-5 flex items-center gap-3 border-b border-slate-800 shrink-0">
        <div className="w-10 h-10 shrink-0 bg-gradient-to-br from-emerald-500 to-cyan-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
          <Dumbbell size={20} className="text-slate-950" />
        </div>
        <span className="text-sm font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 tracking-tighter whitespace-nowrap
          opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-200">
          IronFlow
        </span>
      </div>

      {/* Primary nav — tabs */}
      <nav className="flex flex-col gap-1 p-2 border-b border-slate-800">
        {primaryNav.map(item => <NavButton key={item.label} item={item} />)}
      </nav>

      {/* Secondary nav — tools */}
      <nav className="flex flex-col gap-1 p-2 flex-1 overflow-y-auto">
        {secondaryNav.map(item => <NavButton key={item.label} item={item} />)}
      </nav>

      {/* Settings at bottom */}
      <div className="p-2 border-t border-slate-800 shrink-0">
        <NavButton item={{ icon: <Settings size={18} />, label: 'Settings', action: onOpenSettings, accent: 'text-slate-400' }} />
      </div>
    </aside>
  );
};

export default DesktopSidebar;
