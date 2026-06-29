import React, { useRef } from 'react';

const QUICK_EMOJIS = ['😊','😂','❤️','👍','🔥','😭','🎉','😍'];

/**
 * ChatInput
 *
 * Shared input bar used by MessagesPage and ChatBox.
 *
 * Props:
 *   value        — string
 *   onChange     — fn(newValue)
 *   onSend       — fn()
 *   onTyping     — fn() — called on keystroke (for typing indicator)
 *   disabled     — bool
 *   placeholder  — string
 *   variant      — 'dm' | 'party'
 */
export default function ChatInput({
  value,
  onChange,
  onSend,
  onTyping,
  disabled = false,
  placeholder = 'Message…',
  variant = 'dm',
}) {
  const textareaRef = useRef(null);
  const isParty = variant === 'party';

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const handleInput = (e) => {
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  };

  const insertEmoji = (emoji) => {
    const el = textareaRef.current;
    if (!el) {
      onChange(value + emoji);
      return;
    }
    const start = el.selectionStart;
    const end   = el.selectionEnd;
    const next  = value.slice(0, start) + emoji + value.slice(end);
    onChange(next);
    // Restore cursor after emoji
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  };

  const containerStyle = isParty ? {
    borderTop:  '0.5px solid rgba(255,255,255,0.08)',
    padding:    '8px 10px',
    background: 'rgba(0,0,0,0.2)',
  } : {
    borderTop:  '0.5px solid var(--border)',
    padding:    '12px 16px',
    background: 'rgba(255,255,255,0.02)',
  };

  const textareaStyle = isParty ? {
    flex:        1,
    resize:      'none',
    minHeight:   '38px',
    maxHeight:   '120px',
    borderRadius:'18px',
    padding:     '8px 14px',
    fontSize:    '13px',
    lineHeight:  '1.5',
    overflowY:   'auto',
    background:  'rgba(255,255,255,0.07)',
    border:      '0.5px solid rgba(255,255,255,0.1)',
    color:       '#fff',
    outline:     'none',
  } : {
    flex:        1,
    resize:      'none',
    minHeight:   '42px',
    maxHeight:   '120px',
    borderRadius:'22px',
    padding:     '10px 16px',
    fontSize:    '14px',
    lineHeight:  '1.5',
    overflowY:   'auto',
  };

  return (
    <div style={containerStyle}>
      {/* Emoji quick-pick row */}
      <div style={{
        display:       'flex',
        gap:           '4px',
        marginBottom:  '8px',
        paddingLeft:   '4px',
      }}>
        {QUICK_EMOJIS.map(emoji => (
          <button
            key={emoji}
            onClick={() => insertEmoji(emoji)}
            style={{
              background:   'none',
              border:       'none',
              fontSize:     isParty ? '16px' : '18px',
              cursor:       'pointer',
              padding:      '2px 3px',
              borderRadius: '6px',
              transition:   'transform 0.1s, background 0.1s',
              lineHeight:   1,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform  = 'scale(1.25)';
              e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform  = 'scale(1)';
              e.currentTarget.style.background = 'none';
            }}
            title={emoji}
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* Text row */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={e => {
            onChange(e.target.value);
            onTyping?.();
          }}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          maxLength={isParty ? 500 : 1000}
          disabled={disabled}
          style={textareaStyle}
        />
        <button
          onClick={onSend}
          disabled={!value.trim() || disabled}
          style={{
            width:           isParty ? 36 : 42,
            height:          isParty ? 36 : 42,
            borderRadius:    '50%',
            background:      value.trim() ? 'var(--red, #e53935)' : 'var(--bg3, rgba(255,255,255,0.08))',
            border:          'none',
            color:           value.trim() ? '#fff' : 'var(--text3, rgba(255,255,255,0.3))',
            fontSize:        isParty ? '14px' : '18px',
            display:         'flex',
            alignItems:      'center',
            justifyContent:  'center',
            flexShrink:      0,
            transition:      'all 0.2s',
            cursor:          value.trim() ? 'pointer' : 'default',
          }}
        >
          ➤
        </button>
      </div>
    </div>
  );
}
