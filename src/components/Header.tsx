import TopBar from './TopBar';

interface HeaderProps {
  announcementHeight?: number;
  verificationBannerHeight?: number;
}

const Header = ({ announcementHeight = 0, verificationBannerHeight = 0 }: HeaderProps) => {
  return <TopBar announcementHeight={announcementHeight} verificationBannerHeight={verificationBannerHeight} />;
};

export default Header;