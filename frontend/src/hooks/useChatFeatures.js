import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useChatFeatures
 * Shared logic for both MessagesPage and ChatBox (WatchParty).
 *
 * Returns:
 *  - scrollRef         : attach to the scrollable messages container
 *  - bottomRef         : attach to the invisible sentinel at the bottom
 *  - isAtBottom        : bool — whether the user is scrolled to the bottom
 *  - unreadCount       : number of new messages received while scrolled away
 *  - scrollToBottom    : fn — smooth-scroll to latest message
 *  - reactions         : { [msgId]: { [emoji]: count } }
 *  - addReaction       : fn(msgId, emoji) — toggle a reaction
 *  - onNewMessages     : call this whenever `messages` changes
 */
export function useChatFeatures(messages) {
  const scrollRef  = useRef(null);
  const bottomRef  = useRef(null);
  const prevCountRef = useRef(messages.length);

  const [isAtBottom,  setIsAtBottom]  = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [reactions,   setReactions]   = useState({}); // { msgId: { emoji: count } }

  // Track scroll position
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      const atBottom = scrollHeight - scrollTop - clientHeight < 60;
      setIsAtBottom(atBottom);
      if (atBottom) setUnreadCount(0);
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  // When new messages arrive
  useEffect(() => {
    const newCount = messages.length - prevCountRef.current;
    prevCountRef.current = messages.length;

    if (newCount <= 0) return;

    if (isAtBottom) {
      // Auto-scroll
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    } else {
      // Show unread badge
      setUnreadCount(prev => prev + newCount);
    }
  }, [messages.length]); // eslint-disable-line

  // Initial scroll on mount / conversation change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'instant' });
    setUnreadCount(0);
  }, []); // eslint-disable-line

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    setUnreadCount(0);
    setIsAtBottom(true);
  }, []);

  // Reactions: stored locally (can be extended to persist via API)
  const addReaction = useCallback((msgId, emoji) => {
    setReactions(prev => {
      const msgReactions = prev[msgId] || {};
      const current = msgReactions[emoji] || 0;
      // Toggle: if already reacted remove it, else add
      const next = current > 0 ? current - 1 : current + 1;
      const updated = { ...msgReactions, [emoji]: next };
      // Clean up zero counts
      if (updated[emoji] === 0) delete updated[emoji];
      return { ...prev, [msgId]: updated };
    });
  }, []);

  return {
    scrollRef,
    bottomRef,
    isAtBottom,
    unreadCount,
    scrollToBottom,
    reactions,
    addReaction,
  };
}
