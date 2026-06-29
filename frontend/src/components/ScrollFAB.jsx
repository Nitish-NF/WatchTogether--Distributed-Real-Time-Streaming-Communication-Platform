import React from 'react';

/**
 * ScrollFAB
 *
 * Floating "scroll to bottom" button that appears when the user
 * scrolls up in a chat. Shows an unread count badge.
 *
 * Props:
 *   visible      — bool
 *   unreadCount  — number
 *   onClick      — fn
 *   variant      — 'dm' | 'party'
 */
export default function ScrollFAB({ visible, unreadCount, onClick, variant = 'dm' }) {
  if (!visible) return null;

  const isParty = variant === 'party';

  return (
    <button
      onClick={onClick}
      title="Scroll to latest"
      style={{
        position:        'absolute',
        bottom:          isParty ? '70px' : '80px',
        left:            '50%',
        transform:       'translateX(-50%)',
        zIndex:          50,
        background:      'var(--bg2, #1e1e1e)',
        border:          '0.5px solid var(--border, rgba(255,255,255,0.12))',
        borderRadius:    '99px',
        padding:         '6px 14px',
        display:         'flex',
        alignItems:      'center',
        gap:             '6px',
        cursor:          'pointer',
        boxShadow:       '0 4px 20px rgba(0,0,0,0.4)',
        color:           'var(--text, #fff)',
        fontSize:        '12px',
        fontWeight:      500,
        backdropFilter:  'blur(8px)',
        animation:       'fadeInUp 0.18s ease',
        whiteSpace:      'nowrap',
        transition:      'opacity 0.2s',
      }}
    >
      {unreadCount > 0 && (
        <span style={{
          background:   'var(--red, #e53935)',
          color:        '#fff',
          borderRadius: '99px',
          fontSize:     '10px',
          fontWeight:   700,
          padding:      '1px 6px',
          lineHeight:   '16px',
        }}>
          {unreadCount > 99 ? '99+' : unreadCount} new
        </span>
      )}
      <span style={{ fontSize: '14px' }}>↓</span>
    </button>
  );
}
