import {
  Trophy,
  Users,
  Users2,
  User,
  UserPlus,
  UserCheck,
  Calendar,
  CalendarDays,
  CalendarCheck,
  CalendarClock,
  Clock,
  Star,
  Zap,
  Award,
  Target,
  Flag,
  Medal,
  Crown,
  Shield,
  Gamepad2,
  Heart,
  HeartPulse,
  Swords,
  Flame,
  Sparkles,
  PartyPopper,
  GraduationCap,
  BookOpen,
  Lightbulb,
  Timer,
  Play,
  CircleDot,
  Dumbbell,
  Activity,
  Bike,
  Compass,
  Rocket,
  Gift,
  Cake,
  Ticket,
  Mic,
  Megaphone,
  Bell,
  Mail,
  MessageCircle,
  Music,
  Camera,
  Video,
  Sun,
  Moon,
  Cloud,
  Leaf,
  Waves,
  Droplet,
  Wind,
  MapPin,
  Building,
  Building2,
  Store,
  Home,
  Tent,
  Mountain,
  TreePine,
  Stethoscope,
  Bookmark,
  Tag,
  Hash,
  AtSign,
  ThumbsUp,
  Smile,
  Circle,
  HelpCircle
} from 'lucide-react';

// Map of icon names to Lucide components
// Supports multiple naming conventions: PascalCase, camelCase, lowercase, kebab-case
const iconMap = {
  // Competition/Sports
  Trophy: Trophy,
  trophy: Trophy,
  Medal: Medal,
  medal: Medal,
  Award: Award,
  award: Award,
  Crown: Crown,
  crown: Crown,
  Target: Target,
  target: Target,
  Flame: Flame,
  flame: Flame,
  Swords: Swords,
  swords: Swords,
  Shield: Shield,
  shield: Shield,

  // Calendar/Time
  Calendar: Calendar,
  calendar: Calendar,
  CalendarDays: CalendarDays,
  'calendar-days': CalendarDays,
  CalendarCheck: CalendarCheck,
  'calendar-check': CalendarCheck,
  CalendarClock: CalendarClock,
  'calendar-clock': CalendarClock,
  Clock: Clock,
  clock: Clock,
  Timer: Timer,
  timer: Timer,

  // People
  Users: Users,
  users: Users,
  Users2: Users2,
  users2: Users2,
  User: User,
  user: User,
  UserPlus: UserPlus,
  'user-plus': UserPlus,
  UserCheck: UserCheck,
  'user-check': UserCheck,

  // Learning/Education
  BookOpen: BookOpen,
  'book-open': BookOpen,
  GraduationCap: GraduationCap,
  'graduation-cap': GraduationCap,
  graduationcap: GraduationCap,
  graduation: GraduationCap,
  Lightbulb: Lightbulb,
  lightbulb: Lightbulb,
  Sparkles: Sparkles,
  sparkles: Sparkles,
  Star: Star,
  star: Star,

  // Social/Fun
  PartyPopper: PartyPopper,
  'party-popper': PartyPopper,
  partypopper: PartyPopper,
  party: PartyPopper,
  Heart: Heart,
  heart: Heart,
  ThumbsUp: ThumbsUp,
  'thumbs-up': ThumbsUp,
  Smile: Smile,
  smile: Smile,
  Music: Music,
  music: Music,
  Gift: Gift,
  gift: Gift,
  Cake: Cake,
  cake: Cake,

  // Activity/Sports
  Dumbbell: Dumbbell,
  dumbbell: Dumbbell,
  Activity: Activity,
  activity: Activity,
  Bike: Bike,
  bike: Bike,
  CircleDot: CircleDot,
  'circle-dot': CircleDot,
  circledot: CircleDot,
  Compass: Compass,
  compass: Compass,
  Mountain: Mountain,
  mountain: Mountain,
  Zap: Zap,
  zap: Zap,
  Rocket: Rocket,
  rocket: Rocket,

  // Medical/Health
  Stethoscope: Stethoscope,
  stethoscope: Stethoscope,
  HeartPulse: HeartPulse,
  'heart-pulse': HeartPulse,

  // Communication
  MessageCircle: MessageCircle,
  'message-circle': MessageCircle,
  Megaphone: Megaphone,
  megaphone: Megaphone,
  Bell: Bell,
  bell: Bell,
  Mail: Mail,
  mail: Mail,

  // Location/Places
  MapPin: MapPin,
  'map-pin': MapPin,
  mappin: MapPin,
  Home: Home,
  home: Home,
  Building: Building,
  building: Building,
  Building2: Building2,
  building2: Building2,
  Store: Store,
  store: Store,
  Flag: Flag,
  flag: Flag,
  Tent: Tent,
  tent: Tent,

  // Nature
  Sun: Sun,
  sun: Sun,
  Moon: Moon,
  moon: Moon,
  Cloud: Cloud,
  cloud: Cloud,
  Leaf: Leaf,
  leaf: Leaf,
  TreePine: TreePine,
  'tree-pine': TreePine,
  treepine: TreePine,
  Waves: Waves,
  waves: Waves,
  Droplet: Droplet,
  droplet: Droplet,
  Wind: Wind,
  wind: Wind,

  // Misc
  Bookmark: Bookmark,
  bookmark: Bookmark,
  Tag: Tag,
  tag: Tag,
  Hash: Hash,
  hash: Hash,
  AtSign: AtSign,
  'at-sign': AtSign,
  Ticket: Ticket,
  ticket: Ticket,

  // Gaming & Entertainment
  Gamepad2: Gamepad2,
  gamepad2: Gamepad2,
  Gamepad: Gamepad2,
  gamepad: Gamepad2,
  Play: Play,
  play: Play,
  Mic: Mic,
  mic: Mic,
  Camera: Camera,
  camera: Camera,
  Video: Video,
  video: Video,

  // Default fallback
  Circle: Circle,
  circle: Circle,
  HelpCircle: HelpCircle,
  'help-circle': HelpCircle,
};

/**
 * Get a Lucide icon component by name
 * @param {string} iconName - The name of the icon (supports PascalCase, camelCase, lowercase, kebab-case)
 * @param {React.ComponentType} defaultIcon - The default icon to return if not found (defaults to HelpCircle)
 * @returns {React.ComponentType} The Lucide icon component
 */
export function getIconByName(iconName, defaultIcon = HelpCircle) {
  if (!iconName) return defaultIcon;
  return iconMap[iconName] || iconMap[iconName.toLowerCase()] || defaultIcon;
}

/**
 * Render an icon component with props
 * @param {string} iconName - The name of the icon
 * @param {object} props - Props to pass to the icon component (className, size, etc.)
 * @param {React.ComponentType} defaultIcon - Default icon if name not found
 * @returns {React.ReactElement|null}
 */
export function renderIcon(iconName, props = {}, defaultIcon = HelpCircle) {
  const IconComponent = getIconByName(iconName, defaultIcon);
  if (!IconComponent) return null;
  return <IconComponent {...props} />;
}

// Export the map for direct access if needed
export default iconMap;
