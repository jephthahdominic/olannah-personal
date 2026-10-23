import {
  IconAlertTriangle,
  IconBox,
  IconBuildingWarehouse,
  IconCamera,
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconClipboardCheck,
  IconClipboardList,
  IconDots,
  IconEye,
  IconEyeOff,
  IconFileText,
  IconHelp,
  IconInbox,
  IconLayoutDashboard,
  IconLifebuoy,
  IconMessage,
  IconMinus,
  IconPlus,
  IconRefresh,
  IconSend,
  IconSettings,
  IconSparkles,
  IconWifiOff,
  IconX,
  type Icon as TablerIcon,
} from '@tabler/icons-react';

// Tabler OUTLINE icons are the only icon family (BRD 1.3 section 9). Every glyph is registered here, so a non-Tabler
// or filled icon cannot be used. Add a name to this map to make a glyph available.
const GLYPHS = {
  'alert-triangle': IconAlertTriangle,
  box: IconBox,
  'building-warehouse': IconBuildingWarehouse,
  camera: IconCamera,
  check: IconCheck,
  'chevron-down': IconChevronDown,
  'chevron-right': IconChevronRight,
  'clipboard-check': IconClipboardCheck,
  'clipboard-list': IconClipboardList,
  dots: IconDots,
  eye: IconEye,
  'eye-off': IconEyeOff,
  'file-text': IconFileText,
  help: IconHelp,
  inbox: IconInbox,
  'layout-dashboard': IconLayoutDashboard,
  lifebuoy: IconLifebuoy,
  message: IconMessage,
  minus: IconMinus,
  plus: IconPlus,
  refresh: IconRefresh,
  send: IconSend,
  settings: IconSettings,
  sparkles: IconSparkles,
  'wifi-off': IconWifiOff,
  x: IconX,
} satisfies Record<string, TablerIcon>;

export type IconName = keyof typeof GLYPHS;
export type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const PX: Record<IconSize, string> = {
  xs: 'var(--icon-xs)',
  sm: 'var(--icon-sm)',
  md: 'var(--icon-md)',
  lg: 'var(--icon-lg)',
  xl: 'var(--icon-xl)',
};

export interface IconProps {
  name: IconName;
  size?: IconSize;
  /** Informative icons carry a label. Decorative ones, and ones that repeat adjacent text, are hidden from assistive technology. */
  label?: string;
}

// Icons inherit the color of their context (currentColor). They never carry a hardcoded color.
export function Icon({ name, size = 'md', label }: IconProps) {
  const Glyph = GLYPHS[name];
  const a11y = label ? { role: 'img' as const, 'aria-label': label } : { 'aria-hidden': true as const };
  return <Glyph size={PX[size]} stroke={1.75} {...a11y} />;
}
