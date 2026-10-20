import type { FC } from 'react';
import type { SvgProps } from 'react-native-svg';

import Activity from '../../assets/icons/v2/activity.svg';
import ArrowLeft from '../../assets/icons/v2/arrow-left.svg';
import Bell from '../../assets/icons/v2/bell.svg';
import Calendar from '../../assets/icons/v2/calendar.svg';
import Check from '../../assets/icons/v2/check.svg';
import CheckCheck from '../../assets/icons/v2/check-check.svg';
import ChevronRight from '../../assets/icons/v2/chevron-right.svg';
import Clock from '../../assets/icons/v2/clock.svg';
import Coins from '../../assets/icons/v2/coins.svg';
import ExternalLink from '../../assets/icons/v2/external-link.svg';
import Gavel from '../../assets/icons/v2/gavel.svg';
import Home from '../../assets/icons/v2/home.svg';
import ImageIcon from '../../assets/icons/v2/image.svg';
import Lock from '../../assets/icons/v2/lock.svg';
import MapPin from '../../assets/icons/v2/map-pin.svg';
import Megaphone from '../../assets/icons/v2/megaphone.svg';
import Menu from '../../assets/icons/v2/menu.svg';
import Message from '../../assets/icons/v2/message.svg';
import Pin from '../../assets/icons/v2/pin.svg';
import Plus from '../../assets/icons/v2/plus.svg';
import Search from '../../assets/icons/v2/search.svg';
import Settings from '../../assets/icons/v2/settings.svg';
import Share from '../../assets/icons/v2/share.svg';
import Sparkles from '../../assets/icons/v2/sparkles.svg';
import Target from '../../assets/icons/v2/target.svg';
import Trophy from '../../assets/icons/v2/trophy.svg';
import User from '../../assets/icons/v2/user.svg';
import Users from '../../assets/icons/v2/users.svg';
import Zap from '../../assets/icons/v2/zap.svg';

/** The v2 icon set from Figma ("v2 / Components" → Icons). Strokes use currentColor. */
export const V2_ICONS = {
  activity: Activity,
  'arrow-left': ArrowLeft,
  back: ArrowLeft,
  bell: Bell,
  calendar: Calendar,
  check: Check,
  'check-check': CheckCheck,
  'chevron-right': ChevronRight,
  clock: Clock,
  coins: Coins,
  'external-link': ExternalLink,
  gavel: Gavel,
  home: Home,
  image: ImageIcon,
  lock: Lock,
  'map-pin': MapPin,
  megaphone: Megaphone,
  menu: Menu,
  message: Message,
  pin: Pin,
  plus: Plus,
  search: Search,
  settings: Settings,
  share: Share,
  sparkles: Sparkles,
  target: Target,
  trophy: Trophy,
  user: User,
  users: Users,
  zap: Zap,
} satisfies Record<string, FC<SvgProps>>;

export type V2IconName = keyof typeof V2_ICONS;
