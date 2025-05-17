import { useState, useEffect, useMemo } from 'react';

interface EmojiPickerProps {
  editor: any; // Using any since we might have type compatibility issues with the editor
}

const EmojiPicker = ({ editor }: EmojiPickerProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [emojis, setEmojis] = useState<string[]>([]);
  
  // Common emojis organized by categories
  const commonEmojis = useMemo(() => {
    return [
      // Smileys & Emotion
      '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', 
      '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '😋', '😛', '😜', '😝',
      '🤑', '🤔', '🤫', '🤭', '🤗', '🤥', '😬', '😌', '😪', '🤤', '😴',
      
      // People & Body
      '👍', '👎', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉',
      '👆', '👇', '☝️', '🖖', '🖐️', '✋', '👋', '🤚', '🖕', '👏', '🙌', '👐',
      '🤲', '🤝', '🙏', '💪', '🦾', '👀', '👁️', '👅', '👄', '❤️', '🧠',
      
      // Animals & Nature
      '🐵', '🐒', '🦍', '🦧', '🐶', '🐕', '🦮', '🐩', '🐺', '🦊', '🦝', '🐱',
      '🐈', '🦁', '🐯', '🐴', '🦄', '🦓', '🐮', '🐷', '🐭', '🐰', '🐻', '🐨',
      '🐼', '🦥', '🦦', '🦨', '🦘', '🐔', '🐧', '🐦', '🐤', '🦉', '🦇', '🐺',
      
      // Food & Drink
      '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍈', '🍒', '🍑', '🥭',
      '🍍', '🥥', '🥝', '🍅', '🥑', '🍆', '🥔', '🥕', '🌽', '🌶️', '🥦', '🥬',
      '🍄', '🥜', '🌰', '🍞', '🥐', '🥖', '🥨', '🥯', '🥞', '🧇', '🧀', '🍖',
      
      // Travel & Places
      '🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🛻', '🚚',
      '🚛', '🚜', '🛵', '🏍️', '🛺', '🚲', '🛴', '🚀', '✈️', '🛫', '🛬', '🛩️',
      '🚁', '🛸', '🚢', '⛴️', '🛥️', '🛳️', '⚓', '🚧', '⛽', '🚏', '🚦', '🚥',
      
      // Activities
      '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓',
      '🏸', '🏒', '🏑', '🥍', '🏏', '🪃', '🥅', '⛳', '🪁', '🎣', '🎽', '🎿',
      '🛷', '🥌', '🎯', '🎮', '🎲', '🧩', '🎭', '🎨', '🎼', '🎤', '🎧', '🎷',
      
      // Objects
      '⌚', '📱', '📲', '💻', '⌨️', '🖥️', '🖨️', '🖱️', '🖲️', '📷', '📹', '🎥',
      '📽️', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙️', '🎚️', '🎛️', '🧭', '⏱️', 
      '⏲️', '⏰', '🕰️', '⌛', '⏳', '📡', '🔋', '🔌', '💡', '🔦', '💸', '💵',
      
      // Symbols
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕',
      '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️',
      '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈', '♉', '♊', '♋', '♌',
      
      // Flags
      '🏁', '🚩', '🎌', '🏴', '🏳️', '🏳️‍🌈', '🏳️‍⚧️', '🏴‍☠️'
    ];
  }, []);
  
  useEffect(() => {
    // Filter emojis based on search query
    if (searchQuery.trim() === '') {
      setEmojis(commonEmojis);
    } else {
      // Simple filtering algorithm - could be improved with emoji metadata
      const lowercaseQuery = searchQuery.toLowerCase();
      const emojiKeywords: Record<string, string[]> = {
        'smile': ['😀', '😃', '😄', '😁', '😆', '😅', '🙂', '😊'],
        'laugh': ['🤣', '😂', '😆', '😅'],
        'love': ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '😍', '🥰'],
        'sad': ['😢', '😭', '😞', '😔', '😟', '😕', '🙁', '☹️'],
        'angry': ['😠', '😡', '🤬', '😤', '😤', '👿'],
        'food': ['🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍈', '🍒', '🍑', '🥭'],
        'animal': ['🐵', '🐒', '🦍', '🦧', '🐶', '🐕', '🦮', '🐩', '🐺', '🦊', '🦝', '🐱'],
        'sport': ['⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱'],
        'tech': ['⌚', '📱', '📲', '💻', '⌨️', '🖥️', '🖨️', '🖱️', '🖲️', '📷'],
        'flag': ['🏁', '🚩', '🎌', '🏴', '🏳️', '🏳️‍🌈', '🏳️‍⚧️', '🏴‍☠️']
      };
      
      // Check if query matches any keyword
      let filteredEmojis: string[] = [];
      
      // Search by keyword
      Object.keys(emojiKeywords).forEach(keyword => {
        if (keyword.includes(lowercaseQuery)) {
          filteredEmojis = [...filteredEmojis, ...emojiKeywords[keyword]];
        }
      });
      
      // If no keywords match, show all emojis (user might be searching for a specific character)
      if (filteredEmojis.length === 0) {
        setEmojis(commonEmojis);
      } else {
        setEmojis(filteredEmojis);
      }
    }
  }, [searchQuery, commonEmojis]);
  
  const insertEmoji = (emoji: string) => {
    if (editor) {
      editor.chain().focus().insertContent(emoji).run();
    }
  };
  
  return (
    <div className="emoji-picker-container">
      <input
        type="text"
        className="emoji-search"
        placeholder="Search for emojis..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />
      <div className="emoji-picker">
        {emojis.map((emoji, index) => (
          <button
            key={index}
            className="emoji-item"
            onClick={() => insertEmoji(emoji)}
            type="button"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
};

export default EmojiPicker;