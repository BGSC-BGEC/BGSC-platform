import { useAuth } from '../../store/auth';
import { usePopup } from '../popups/PopupProvider';

/** Returns a handler that asks for confirmation before signing out. */
export function useConfirmLogout() {
  const { logout } = useAuth();
  const popup = usePopup();
  return async () => {
    const confirmed = await popup.confirm({
      title: 'Log out?',
      message: 'You will need to sign in again to register for events or bid in auctions.',
      confirmLabel: 'Log out',
      destructive: true,
    });
    if (confirmed) await logout();
  };
}
