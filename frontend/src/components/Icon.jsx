import {
  LayoutDashboard,
  Users,
  User,
  UserCog,
  Folder,
  FileText,
  Send,
  ClipboardList,
  BarChart3,
  Shield,
  Settings,
  Plus,
  Upload,
  Download,
  Pencil,
  Trash2,
  Pause,
  Play,
  X,
  Check,
  Copy,
  ExternalLink,
  Clock,
  Info,
  AlertTriangle,
  Mail,
  Phone,
  MessageCircle,
  Link2,
  Menu,
  LogOut,
  Landmark,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  FileSpreadsheet,
  Inbox,
  Search,
  Key,
} from "lucide-react";

const ICONS = {
  dashboard: LayoutDashboard,
  users: Users,
  user: User,
  userCog: UserCog,
  folder: Folder,
  file: FileText,
  send: Send,
  clipboard: ClipboardList,
  chart: BarChart3,
  shield: Shield,
  settings: Settings,
  plus: Plus,
  upload: Upload,
  download: Download,
  edit: Pencil,
  trash: Trash2,
  pause: Pause,
  play: Play,
  x: X,
  check: Check,
  copy: Copy,
  external: ExternalLink,
  clock: Clock,
  info: Info,
  alert: AlertTriangle,
  mail: Mail,
  phone: Phone,
  message: MessageCircle,
  link: Link2,
  menu: Menu,
  logout: LogOut,
  landmark: Landmark,
  arrowLeft: ArrowLeft,
  arrowUp: ArrowUp,
  arrowDown: ArrowDown,
  fileSpreadsheet: FileSpreadsheet,
  inbox: Inbox,
  search: Search,
  key: Key,
};

export default function Icon({ name, size = 16, strokeWidth = 1.9, className = "", style, ...rest }) {
  const Cmp = ICONS[name];
  if (!Cmp) return null;
  return (
    <Cmp
      size={size}
      strokeWidth={strokeWidth}
      className={`icon ${className}`}
      style={style}
      aria-hidden="true"
      {...rest}
    />
  );
}
