import React, { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { MdOutlineEmojiEmotions } from "react-icons/md";

const AVATAR_COLORS = [
  '#b71c1c','#1a237e','#1b5e20','#4a148c','#e65100','#006064','#880e4f',
];

export function getColor(username) {
  return AVATAR_COLORS[(username?.charCodeAt(0) || 0) % AVATAR_COLORS.length];
}

const QUICK_EMOJIS = ['👍','❤️','😂','😮','😢','🔥','👏','🎉'];

/**
 * ChatMessage
 *
 * Shared bubble component used by both MessagesPage and ChatBox (WatchParty).
 *
 * Props:
 *   msg          — message object ({ senderId|userId, senderUsername|username, text, createdAt|timestamp, _id })
 *   isOwn        — bool
 *   showAvatar   — bool
 *   showName     — bool
 *   reactions    — { [emoji]: count }  for this message
 *   onReact      — fn(emoji)
 *   variant      — 'dm' (MessagesPage style) | 'party' (ChatBox style, smaller)
 */
export default function ChatMessage({
  msg,
  isOwn,
  showAvatar,
  showName,
  reactions = {},
  onReact,
  variant = 'dm',
}) {
  const [showReactions, setShowReactions] = useState(false);
  const [reactiontimer, setReactionTimer] = useState(null);
  const [showemojiicon, setShowEmojiIcon] = useState(false);
  
  

  const username  = msg.senderUsername ?? msg.username ?? '?';
  const timestamp = msg.createdAt      ?? msg.timestamp;
  const msgId     = msg._id            ?? msg.tempId;

  const isParty = variant === 'party';

  const openReactions = () => {
    if (reactiontimer) clearTimeout(reactiontimer);
    setShowReactions(true);
  };

  const closeReactions = () => {
    const timer = setTimeout(() => {
      setShowReactions(false);
    }, 1000);

    setReactionTimer(timer);
  };

const showIcon = () => {
  clearTimeout(hideTimer.current);
  setShowEmojiIcon(true);
};

const hideIcon = () => {
  hideTimer.current = setTimeout(() => {
    setShowEmojiIcon(false);
  }, 300);
};

  const bubbleStyle = isParty ? {
    background:   isOwn ? 'var(--red, #e53935)' : 'rgba(255,255,255,0.08)',
    color:        '#fff',
    borderRadius: isOwn ? ' 18px 4px 18px 18px' : '4px 18px 18px 18px',
    padding:      '8px 12px',
    fontSize:     '13px',
    lineHeight:   '1.5',
    wordBreak:    'break-word',
    alignItems:   isOwn ? 'right' : 'left',
  } : {
    background:   isOwn ? 'var(--red, #e53935)' : 'var(--bg3)',
    color:        isOwn ? '#fff' : 'var(--text)',
    borderRadius: isOwn ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
    padding:      '9px 14px',
    fontSize:     '14px',
    lineHeight:   '1.5',
    wordBreak:    'break-word',
    border:       isOwn ? 'none' : '0.5px solid var(--border)',
    opacity:      msg.optimistic ? 0.7 : 1,
  };

  const avatarSize  = isParty ? 28 : 28;
  const hasReactions = Object.keys(reactions).filter(e => reactions[e] > 0).length > 0;

  return (
    <div
      style={{
        display:       'flex',
        flexDirection: isOwn ? 'row-reverse' : 'row',
        gap:           '8px',
        alignItems:    'flex-end',
        marginTop:     showAvatar ? (isParty ? '8px' : '10px') : '2px',
        position:      'relative',
      }}
    >
      {/* Avatar */}
      {!isOwn && (
        <div
          style={{
            width:           avatarSize,
            height:          avatarSize,
            borderRadius:    '50%',
            background:      showAvatar ? getColor(username) : 'transparent',
            color:           '#fff',
            display:         'flex',
            alignItems:      'center',
            justifyContent:  'center',
            fontSize:        '10px',
            fontWeight:      600,
            flexShrink:      0,
          }}
        >
          {showAvatar ? username.slice(0, 2).toUpperCase() : ''}
        </div>
      )}

      {/* Bubble column */}
      <div style={{ maxWidth: isParty ? '80%' : '65%', position: 'relative' }}>
        {showName && !isOwn && (
          <div style={{
            fontSize: '11px',
            color: 'var(--text3)',
            marginBottom: '3px',
            paddingLeft: '4px',
          }}>
            {username}
          </div>
        )}

        {/* Bubble */}
        <div
            style={{
              position: "relative",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px"
            }}
            onMouseEnter={() => setShowEmojiIcon(true)}
            onMouseLeave={() => setShowEmojiIcon(false)}
          >
            <div style={bubbleStyle}>
              {msg.text}
            </div>

            {showemojiicon && (
              <div
                onMouseLeave={closeReactions}
                onClick={() => setShowReactions(prev => !prev)}
                style={{
                  cursor: "pointer",
                  color: "var(--text3)",
                  fontSize: "18px",
                  display: "flex",
                  alignItems: "center"
                }}
              >
                <MdOutlineEmojiEmotions />
              </div>
            )}
          </div>
        

        {/* Reactions strip */}
        {hasReactions && (
          <div style={{
            display:    'flex',
            flexWrap:   'wrap',
            gap:        '3px',
            marginTop:  '4px',
            justifyContent: isOwn ? 'flex-end' : 'flex-start',
          }}
          >
            {QUICK_EMOJIS.filter(e => reactions[e] > 0).map(emoji => (
              <button
                key={emoji}
                onClick={() => onReact?.(emoji)}
                style={{
                  background:   'rgba(255,255,255,0.1)',
                  border:       '0.5px solid rgba(255,255,255,0.15)',
                  borderRadius: '99px',
                  padding:      '2px 7px',
                  fontSize:     '12px',
                  cursor:       'pointer',
                  color:        'var(--text, #fff)',
                  display:      'flex',
                  alignItems:   'center',
                  gap:          '3px',
                  transition:   'background 0.15s',
                }}
              >
                {emoji}
                <span style={{ fontSize: '10px', color: 'var(--text3)' }}>
                  {reactions[emoji]}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Timestamp */}
        {!isParty && (
          <div style={{
            fontSize:    '10px',
            color:       'var(--text3)',
            marginTop:   '3px',
            textAlign:   isOwn ? 'right' : 'left',
            paddingLeft: isOwn ? 0 : '4px',
            paddingRight: isOwn ? '4px' : 0,
          }}>
            {timestamp
              ? formatDistanceToNow(new Date(timestamp), { addSuffix: true })
              : 'just now'}
            {isOwn && !msg.optimistic && ' · ✓'}
          </div>
        )}
        {isParty && (
          <div style={{
            fontSize:  '10px',
            color:     'rgba(255,255,255,0.4)',
            marginTop: '2px',
            textAlign: isOwn ? 'right' : 'left',
          }}>
            {timestamp
              ? formatDistanceToNow(new Date(timestamp), { addSuffix: true })
              : 'just now'}
          </div>
        )}
      </div>

      {/* Reaction quick-bar — appears on hover */}
      {showReactions && onReact && (
        <div
          style={{
            position:        'absolute',
            [isOwn ? 'right' : 'left']: isOwn ? (isParty ? 36 : 36) : (isParty ? 36 : 36),
            bottom:          '100%',
            marginBottom:    '4px',
            background:      'var(--bg2, #1e1e1e)',
            border:          '0.5px solid var(--border, rgba(255,255,255,0.1))',
            borderRadius:    '99px',
            padding:         '5px 10px',
            display:         'flex',
            gap:             '6px',
            zIndex:          100,
            boxShadow:       '0 4px 20px rgba(0,0,0,0.4)',
            animation:       'fadeInUp 0.12s ease',
          }}
          onMouseEnter={openReactions}
          onMouseLeave={closeReactions}
        >
          {QUICK_EMOJIS.map(emoji => (
            <button
              key={emoji}
              onClick={() => {
                onReact(emoji);
                setShowReactions(false);
              }}
              title={emoji}
              style={{
                background:  'none',
                border:      'none',
                fontSize:    '16px',
                cursor:      'pointer',
                padding:     '0 2px',
                lineHeight:  1,
                transition:  'transform 0.5s',
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.3)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}