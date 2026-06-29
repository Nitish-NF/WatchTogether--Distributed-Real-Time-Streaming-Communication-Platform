import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useChatFeatures } from '../hooks/useChatFeatures';
import ChatMessage from './ChatMessage';
import ChatInput   from './ChatInput';
import ScrollFAB   from './ScrollFAB';

export default function ChatBox({ messages = [], onSend }) {
  const { user } = useAuth();
  const [text, setText] = useState('');

  const {
    scrollRef,
    bottomRef,
    isAtBottom,
    unreadCount,
    scrollToBottom,
    reactions,
    addReaction,
  } = useChatFeatures(messages);

  const handleSend = () => {
    if (!text.trim()) return;
    onSend(text.trim());
    setText('');
  };

  return (
    <div className="chatbox" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Header */}
      <div className="chatbox-header" style={{
        display:        'flex',
        justifyContent: 'space-between',
        alignItems:     'center',
        padding:        '12px 14px',
        borderBottom:   '0.5px solid rgba(255,255,255,0.08)',
        flexShrink:     0,
      }}>
        <span style={{ fontWeight: 600, fontSize: '13px' }}>💬 Party Chat</span>
        <span style={{ fontSize: '11px', color: 'var(--text3)' }}>
          {messages.length} messages
        </span>
      </div>

      {/* Messages — scrollable */}
      <div
        ref={scrollRef}
        style={{
          flex:      1,
          overflowY: 'auto',
          padding:   '12px 24px 12px 12px',
          display:   'flex',
          flexDirection: 'column',
          gap:       '2px',
          position:  'relative',
        }}
      >
        {messages.length === 0 && (
          <div style={{
            textAlign:  'center',
            color:      'var(--text3)',
            fontSize:   '13px',
            marginTop:  '2rem',
          }}>
            No messages yet 👋<br />Start the conversation.
          </div>
        )}

        {messages.map((msg, i) => {
          const myId      = user?._id?.toString();
          const senderId  = (msg.userId ?? msg.senderId)?.toString();
          const prevSender = (messages[i - 1]?.userId ?? messages[i - 1]?.senderId)?.toString();
          const isOwn     = senderId === myId;
          const showAvatar = !isOwn && (i === 0 || prevSender !== senderId);
          const msgId     = msg._id ?? `idx-${i}`;

          return (
            <ChatMessage
              key={msgId}
              msg={msg}
              isOwn={isOwn}
              showAvatar={showAvatar}
              showName={showAvatar}
              reactions={reactions[msgId] || {}}
              onReact={(emoji) => addReaction(msgId, emoji)}
              variant="party"
            />
          );
        })}

        <div ref={bottomRef} />
      </div>

      {/* Scroll FAB */}
      <div style={{ position: 'relative' }}>
        <ScrollFAB
          visible={!isAtBottom}
          unreadCount={unreadCount}
          onClick={scrollToBottom}
          variant="party"
        />
      </div>

      {/* Input */}
      <ChatInput
        value={text}
        onChange={setText}
        onSend={handleSend}
        placeholder="Type a message…"
        variant="party"
      />

    </div>
  );
}