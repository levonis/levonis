// Chat Commerce UI Components - Taobao Style
// Export all chat-related components

// Top Bar
export { default as ChatTopBar } from './ChatTopBar';

// Input Bar
export { default as ChatInputBar } from './ChatInputBar';

// Message Types
export { default as TextMessage } from './messages/TextMessage';
export { default as SystemMessage } from './messages/SystemMessage';
export { default as ProductCard } from './messages/ProductCard';
export { default as OrderCard } from './messages/OrderCard';
export type { OrderStatus } from './messages/OrderCard';
export { default as ConfirmationCard } from './messages/ConfirmationCard';
export type { ChangeType } from './messages/ConfirmationCard';

// Selectors & Dialogs
export { default as ProductSelector } from './ProductSelector';
export { default as PriceChangeDialog } from './PriceChangeDialog';
export { default as CreateOrderDialog } from './CreateOrderDialog';

// Emoji
export { default as EmojiPicker } from './EmojiPicker';
export { WECHAT_EMOJIS, parseEmojisInText } from './emojiData';
export type { EmojiItem } from './emojiData';
