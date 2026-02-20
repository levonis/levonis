import { useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { WECHAT_EMOJIS } from './emojiData';

interface RichTextInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  onFocus?: () => void;
  onBlur?: () => void;
}

// Create a map for faster lookup
const emojiMap = new Map(WECHAT_EMOJIS.map(e => [e.code, e]));

// Convert text with emoji codes to HTML with images
function textToHtml(text: string): string {
  if (!text) return '';
  
  let html = text;
  // Escape HTML first
  html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  
  // Replace emoji codes with images
  const emojiRegex = /:e(\d{3}):/g;
  html = html.replace(emojiRegex, (match) => {
    const emoji = emojiMap.get(match);
    if (emoji) {
      return `<img src="${emoji.src}" alt="${emoji.alt}" class="inline-emoji" data-code="${match}" />`;
    }
    return match;
  });
  
  return html;
}

// Convert HTML with images back to text with emoji codes
function htmlToText(html: string): string {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  
  // Replace img elements with their data-code
  const images = tempDiv.querySelectorAll('img.inline-emoji');
  images.forEach(img => {
    const code = img.getAttribute('data-code') || '';
    const textNode = document.createTextNode(code);
    img.parentNode?.replaceChild(textNode, img);
  });
  
  // Get text content and normalize whitespace
  let text = tempDiv.textContent || '';
  // Preserve newlines but normalize other whitespace
  text = text.replace(/\u00A0/g, ' '); // Replace &nbsp; with space
  
  return text;
}

export default function RichTextInput({
  value,
  onChange,
  placeholder = 'اكتب رسالة...',
  disabled = false,
  className,
  onFocus,
  onBlur,
}: RichTextInputProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const isComposingRef = useRef(false);
  const lastValueRef = useRef(value);

  // Update content when value changes from outside
  useEffect(() => {
    if (!editorRef.current) return;
    
    // Only update if value actually changed (not from our own onChange)
    if (value !== lastValueRef.current) {
      const html = textToHtml(value);
      if (editorRef.current.innerHTML !== html) {
        editorRef.current.innerHTML = html;
      }
      lastValueRef.current = value;
    }
  }, [value]);

  // Handle input changes
  const handleInput = useCallback(() => {
    if (!editorRef.current || isComposingRef.current) return;
    
    const text = htmlToText(editorRef.current.innerHTML);
    lastValueRef.current = text;
    onChange(text);
  }, [onChange]);

  // Handle paste - strip formatting
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  }, []);

  // Handle key events
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Prevent Enter from creating new lines (let parent handle send)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // Trigger form submit - we'll let the parent handle this
      const form = editorRef.current?.closest('form');
      if (form) {
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      }
    }
  }, []);

  // Insert emoji at cursor position
  const insertEmoji = useCallback((emojiCode: string) => {
    if (!editorRef.current) return;
    
    editorRef.current.focus();
    
    const emoji = emojiMap.get(emojiCode);
    if (!emoji) {
      document.execCommand('insertText', false, emojiCode);
      return;
    }
    
    // Create and insert the emoji image
    const img = document.createElement('img');
    img.src = emoji.src;
    img.alt = emoji.alt;
    img.className = 'inline-emoji';
    img.dataset.code = emojiCode;
    
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(img);
      
      // Move cursor after the image
      range.setStartAfter(img);
      range.setEndAfter(img);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    
    handleInput();
  }, [handleInput]);

  // Expose insertEmoji method
  useEffect(() => {
    if (editorRef.current) {
      (editorRef.current as any).insertEmoji = insertEmoji;
    }
  }, [insertEmoji]);

  return (
    <div className="relative w-full">
      <div
        ref={editorRef}
        contentEditable={!disabled}
        className={cn(
          "min-h-[42px] max-h-24 overflow-y-auto rounded-full px-4 py-2.5 bg-background/80 border border-border/50 focus:ring-1 focus:ring-ring focus:outline-none text-sm leading-relaxed text-foreground",
          "empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground empty:before:pointer-events-none",
          "[&_.inline-emoji]:inline-block [&_.inline-emoji]:w-5 [&_.inline-emoji]:h-5 [&_.inline-emoji]:align-text-bottom [&_.inline-emoji]:mx-0.5",
          disabled && "opacity-50 cursor-not-allowed",
          className
        )}
        data-placeholder={placeholder}
        onInput={handleInput}
        onPaste={handlePaste}
        onKeyDown={handleKeyDown}
        onFocus={onFocus}
        onBlur={onBlur}
        onCompositionStart={() => { isComposingRef.current = true; }}
        onCompositionEnd={() => { 
          isComposingRef.current = false; 
          handleInput();
        }}
        dir="auto"
        role="textbox"
        aria-label={placeholder}
        suppressContentEditableWarning
      />
    </div>
  );
}

// Export for use in ChatInputBar
export { textToHtml, htmlToText };
