import TopBar from './TopBar';

interface HeaderProps {
  announcementHeight?: number;
}

const Header = ({ announcementHeight = 0 }: HeaderProps) => {
  return <TopBar announcementHeight={announcementHeight} />;
};

export default Header;