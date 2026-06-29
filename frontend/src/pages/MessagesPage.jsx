import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import conversationService from '../services/conversationService';
import socket from '../sockets/socket';
import toast from 'react-hot-toast';

import { useChatFeatures } from '../hooks/useChatFeatures';
import ChatMessage, { getColor } from '../components/ChatMessage';
import ChatInput   from '../components/ChatInput';
import ScrollFAB   from '../components/ScrollFAB';

import { useSearch } from '../hooks/useSearch';
import { getContactMode, lockedToast } from '../utils/canContact';

// ── Exported helpers ──────────────────────────────────────────────────────────

export function getConvName(conv, currentUserId) {
  if (conv.name) return conv.name;
  const others = (conv.participants || []).filter(p => {
    const id = typeof p === 'string' ? p : (p?._id?.toString?.() ?? String(p?._id ?? ''));
    return id !== currentUserId?.toString();
  });
  const names = others
    .map(p => typeof p === 'string' ? null : p.username || p.name || null)
    .filter(Boolean);
  return names.join(', ') || 'Conversation';
}

export function getConvInitials(conv, currentUserId) {
  return getConvName(conv, currentUserId).slice(0, 2).toUpperCase();
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TypingDot({ delay }) {
  return <span className="typing-dot" style={{ animationDelay: delay }} />;
}

export function MovieMessage({ msg, isOwn }) {
  const navigate = useNavigate();
  return (
    <div style={{ display: 'flex', flexDirection: isOwn ? 'row-reverse' : 'row', marginTop: '10px' }}>
      <div
        onClick={() => msg.movieId && navigate(`/movie/${msg.movieId._id}`)}
        style={{
          background: isOwn ? 'rgba(229,57,53,0.15)' : 'var(--bg3)',
          border: `0.5px solid ${isOwn ? 'rgba(229,57,53,0.4)' : 'var(--border)'}`,
          borderRadius: '14px', padding: '12px 14px',
          maxWidth: '280px', cursor: msg.movieId ? 'pointer' : 'default',
          display: 'flex', gap: '10px', alignItems: 'center',
        }}
      >
        <span style={{ fontSize: '24px' }}>🎬</span>
        <div>
          <div style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '2px' }}>Shared a movie</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '3px' }}>{msg.movieId?.title}</div>
            <div style={{ fontSize: '12px', color: 'var(--text2)' }}>{msg.movieId?.genre} · {msg.movieId?.year}</div>
            <div style={{ fontSize: '12px', color: 'var(--red)', marginTop: '4px' }}>Tap to watch →</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PartyMessage({ msg, isOwn }) {
  const navigate = useNavigate();
  return (
    <div style={{ display: 'flex', flexDirection: isOwn ? 'row-reverse' : 'row', marginTop: '10px' }}>
      <div style={{
        background: isOwn ? 'rgba(229,57,53,0.15)' : 'var(--bg3)',
        border: `0.5px solid ${isOwn ? 'rgba(229,57,53,0.4)' : 'var(--border)'}`,
        borderRadius: '14px', padding: '12px 14px', maxWidth: '280px',
      }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{ fontSize: '24px' }}>🎉</span>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '2px' }}>Watch Party Invite</div>
            <div style={{ fontSize: '13px', fontWeight: 500 }}>{msg.movieTitle || 'Join the party!'}</div>
          </div>
        </div>
        {msg.roomId?.active ? (
          <button className="btn btn-red btn-sm" style={{ width: '100%' }} onClick={() => navigate(`/party/${msg.roomId._id}`)}>
            Join Party →
          </button>
        ) : (
          <div className="btn btn-red btn-sm">Party over</div>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MessagesPage() {
  const { conversationId }   = useParams();
  const [searchParams]       = useSearchParams();
  const navigate             = useNavigate();
  const { user }             = useAuth();

  const [conversations,  setConversations]  = useState([]);
  const [convRequests,   setConvRequests]   = useState([]); // NEW — message requests
  const [convLoading,    setConvLoading]    = useState(true);
  const [activeConv,     setActiveConv]     = useState(null);
  const [messages,       setMessages]       = useState([]);
  const [msgLoading,     setMsgLoading]     = useState(false);
  const [text,           setText]           = useState('');
  const [sending,        setSending]        = useState(false);
  const [typingUsers,    setTypingUsers]    = useState([]);
  const [hasMore,        setHasMore]        = useState(false);
  const [sidebarOpen,    setSidebarOpen]    = useState(false);

  // sidebarMode: 'convs' | 'parties' | 'requests' | 'new'
  const [sidebarMode,    setSidebarMode]    = useState('convs');
  const [convSearch,     setConvSearch]     = useState('');
  const userSearch = useSearch({ users: true, movies: false, parties: false, debounce: 250 });

  const typingTimer  = useRef(null);
  const activeConvId = activeConv?._id;

  const { scrollRef, bottomRef, isAtBottom, unreadCount, scrollToBottom, reactions, addReaction } =
    useChatFeatures(messages);

  // ── Load conversations + requests ─────────────────────────────────
  useEffect(() => {
    Promise.all([
      conversationService.getConversations(),
      conversationService.getConversationRequests(),
    ])
      .then(([convData, reqData]) => {
        setConversations(convData || []);
        setConvRequests(reqData  || []);
      })
      .catch(() => toast.error('Could not load conversations'))
      .finally(() => setConvLoading(false));
  }, []);

  // ── Handle ?new= param ────────────────────────────────────────────
  useEffect(() => {
    const newUserId = searchParams.get('new');
    if (!newUserId) return;
    conversationService.createConversation([newUserId])
      .then(conv => {
        // If it's a request, add to requests list; else normal list
        if (conv.isRequest) {
          setConvRequests(prev => prev.find(c => c._id === conv._id) ? prev : [conv, ...prev]);
        } else {
          setConversations(prev => prev.find(c => c._id === conv._id) ? prev : [conv, ...prev]);
        }
        navigate(`/messages/${conv._id}`, { replace: true });
      })
      .catch(err => toast.error(err?.response?.data?.message || 'Could not open conversation'));
  }, [searchParams, navigate]);

  // ── Open conversation from URL param ─────────────────────────────
  useEffect(() => {
    if (!conversationId) return;
    const allConvs   = [...conversations, ...convRequests];
    const existing   = allConvs.find(c => c._id === conversationId);
    if (existing) {
      openConversation(existing);
    } else if (!convLoading) {
      Promise.all([
        conversationService.getConversations(),
        conversationService.getConversationRequests(),
      ]).then(([convData, reqData]) => {
        setConversations(convData || []);
        setConvRequests(reqData  || []);
        const found = [...(convData || []), ...(reqData || [])].find(c => c._id === conversationId);
        if (found) openConversation(found);
      });
    }
  }, [conversationId, convLoading]); // eslint-disable-line

  const openConversation = useCallback(async (conv) => {
    if (activeConvId) socket.emit('leave_conversation', { conversationId: activeConvId });
    setActiveConv(conv);
    setMessages([]);
    setTypingUsers([]);
    setMsgLoading(true);
    setSidebarOpen(false);
    setConvSearch('');
    userSearch.clear();
    setSidebarMode('convs');
    navigate(`/messages/${conv._id}`, { replace: true });
    try {
      const msgs = await conversationService.getMessages(conv._id);
      setMessages(msgs || []);
      setHasMore((msgs?.length ?? 0) === 50);
    } catch {
      toast.error('Could not load messages');
    } finally {
      setMsgLoading(false);
    }
    socket.emit('join_conversation', { conversationId: conv._id });
    conversationService.markSeen(conv._id).catch(() => {});
  }, [activeConvId, navigate]); // eslint-disable-line

  // ── Accept / decline a message request ───────────────────────────
  const handleAcceptRequest = useCallback(async (conv) => {
    try {
      const accepted = await conversationService.acceptConversationRequest(conv._id);
      setConvRequests(prev => prev.filter(c => c._id !== conv._id));
      setConversations(prev => [accepted, ...prev]);
      toast.success('Message request accepted');
      openConversation(accepted);
    } catch {
      toast.error('Could not accept request');
    }
  }, [openConversation]);

  const handleDeclineRequest = useCallback(async (convId) => {
    try {
      await conversationService.declineConversationRequest(convId);
      setConvRequests(prev => prev.filter(c => c._id !== convId));
      toast.success('Request declined');
    } catch {
      toast.error('Could not decline request');
    }
  }, []);

  // ── Start DM from user search ─────────────────────────────────────
  const startDM = useCallback(async (targetUser) => {
    if (getContactMode(targetUser) === 'locked') {
      toast.error(lockedToast(targetUser.username));
      return;
    }
    try {
      const conv = await conversationService.createConversation([targetUser._id]);
      if (conv.isRequest) {
        setConvRequests(prev => prev.find(c => c._id === conv._id) ? prev : [conv, ...prev]);
      } else {
        setConversations(prev => prev.find(c => c._id === conv._id) ? prev : [conv, ...prev]);
      }
      openConversation(conv);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not open conversation');
    }
  }, [openConversation]);

  // ── Socket: incoming messages ─────────────────────────────────────
  useEffect(() => {
    const handleMessage = (msg) => {
      if (msg.conversationId !== activeConvId) {
        setConversations(prev =>
          prev.map(c => c._id === msg.conversationId
            ? { ...c, lastMessage: { text: msg.text || `📎 ${msg.type}`, senderId: msg.senderId, type: msg.type, createdAt: msg.timestamp }, unread: (c.unread || 0) + 1 }
            : c
          )
        );
        return;
      }
      setMessages(prev => [...prev, msg]);
      conversationService.markSeen(activeConvId).catch(() => {});
      setTypingUsers(prev => prev.filter(u => u !== msg.username));
    };
    const handleTyping = ({ username }) => {
      if (username === user?.username) return;
      setTypingUsers(prev => prev.includes(username) ? prev : [...prev, username]);
      setTimeout(() => setTypingUsers(prev => prev.filter(u => u !== username)), 3000);
    };
    socket.on('conversation_message', handleMessage);
    socket.on('typing', handleTyping);
    return () => {
      socket.off('conversation_message', handleMessage);
      socket.off('typing', handleTyping);
    };
  }, [activeConvId, user]);

  useEffect(() => {
    return () => {
      if (activeConvId) socket.emit('leave_conversation', { conversationId: activeConvId });
    };
  }, [activeConvId]);

  // ── Send message ──────────────────────────────────────────────────
  const handleSend = async () => {
    if (!text.trim() || !activeConvId || sending) return;
    const trimmed = text.trim();
    setText('');
    const optimistic = {
      _id: `opt-${Date.now()}`, conversationId: activeConvId,
      senderId: user._id, senderUsername: user.username,
      type: 'text', text: trimmed, timestamp: new Date().toISOString(), optimistic: true,
    };
    setMessages(prev => [...prev, optimistic]);
    setSending(true);
    try {
      const saved = await conversationService.sendMessage(activeConvId, { type: 'text', text: trimmed });
      setMessages(prev => prev.map(m => m._id === optimistic._id ? saved : m));
      socket.emit('conversation_message', { conversationId: activeConvId, message: saved });
      setConversations(prev =>
        prev.map(c => c._id === activeConvId
          ? { ...c, lastMessage: { text: trimmed, senderId: user._id, type: 'text', createdAt: new Date() }, updatedAt: new Date() }
          : c
        ).sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
      );
    } catch {
      toast.error('Message failed to send');
      setMessages(prev => prev.filter(m => m._id !== optimistic._id));
    } finally {
      setSending(false);
    }
  };

  const handleTyping = () => {
    if (!activeConvId) return;
    clearTimeout(typingTimer.current);
    socket.emit('typing', { conversationId: activeConvId });
    typingTimer.current = setTimeout(() => { typingTimer.current = null; }, 3000);
  };

  const loadMore = async () => {
    if (!activeConvId || !messages.length) return;
    const oldest = messages[0];
    const older  = await conversationService.getMessages(activeConvId, oldest.createdAt || oldest.timestamp);
    setMessages(prev => [...(older || []), ...prev]);
    setHasMore((older?.length ?? 0) === 50);
  };

  // ── Derived lists ─────────────────────────────────────────────────
  // Normal DM conversations (no party last message)
  const dmConversations = conversations.filter(c => c.lastMessage?.type !== 'party');

  // Party conversations — last message is a party invite
  const partyConversations = conversations.filter(c => c.lastMessage?.type === 'party');

  const filterBySearch = (list) => !convSearch.trim() ? list : list.filter(conv => {
    const name = getConvName(conv, user?._id).toLowerCase();
    return name.includes(convSearch.toLowerCase());
  });

  const filteredDMs      = filterBySearch(dmConversations);
  const filteredParties  = filterBySearch(partyConversations);

  // ── Sidebar tab counts ────────────────────────────────────────────
  const TABS = [
    { key: 'convs',    label: '💬 DMs',      count: null                },
    { key: 'parties',  label: '🎉 Parties',  count: partyConversations.length || null },
    { key: 'requests', label: '📨 Requests', count: convRequests.length || null },
    { key: 'new',      label: '✏️ New',      count: null                },
  ];

  return (
    <div className="messages-layout" style={{ position: 'relative' }}>

      {/* ── LEFT: Conversation Sidebar ───────────────────────────── */}
      <div className={`messages-sidebar${sidebarOpen ? ' messages-sidebar--open' : ''}`}>

        {/* Header */}
        <div className="messages-sidebar-header">
          <span>Messages</span>
          <button className="messages-sidebar-close btn btn-ghost btn-sm" onClick={() => setSidebarOpen(false)}>✕</button>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', borderBottom: '0.5px solid var(--border)', overflowX: 'auto' }}>
          {TABS.map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => { setSidebarMode(key); setConvSearch(''); userSearch.clear(); }}
              style={{
                flex: 1, padding: '9px 4px', fontSize: '11.5px', fontWeight: sidebarMode === key ? 600 : 400,
                color: sidebarMode === key ? 'var(--red)' : 'var(--text3)',
                background: 'none', border: 'none', cursor: 'pointer',
                borderBottom: `2px solid ${sidebarMode === key ? 'var(--red)' : 'transparent'}`,
                transition: 'all 0.15s', whiteSpace: 'nowrap', position: 'relative',
              }}
            >
              {label}
              {count > 0 && (
                <span style={{
                  position: 'absolute', top: '5px', right: '4px',
                  background: 'var(--red)', color: '#fff',
                  borderRadius: '99px', padding: '0 5px',
                  fontSize: '9px', fontWeight: 700,
                }}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search input — shown on convs, parties, requests tabs */}
        {sidebarMode !== 'new' && (
          <div style={{ padding: '8px 12px', borderBottom: '0.5px solid var(--border)' }}>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', fontSize: '13px', pointerEvents: 'none' }}>🔍</span>
              <input
                value={convSearch}
                onChange={e => setConvSearch(e.target.value)}
                placeholder={
                  sidebarMode === 'requests' ? 'Search requests…' :
                  sidebarMode === 'parties'  ? 'Search party chats…' :
                  'Search conversations…'
                }
                style={{ paddingLeft: '36px', paddingRight: '32px', height: '36px', fontSize: '13px', background: 'var(--bg2)' }}
              />
              {convSearch && (
                <button onClick={() => setConvSearch('')} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text3)', fontSize: '16px', cursor: 'pointer', lineHeight: 1 }}>×</button>
              )}
            </div>
          </div>
        )}

        {/* User search input — new tab only */}
        {sidebarMode === 'new' && (
          <div style={{ padding: '8px 12px', borderBottom: '0.5px solid var(--border)' }}>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', fontSize: '13px', pointerEvents: 'none' }}>
                {userSearch.loading ? '⏳' : '🔍'}
              </span>
              <input
                value={userSearch.query}
                onChange={e => userSearch.setQuery(e.target.value)}
                placeholder="Search users to message…"
                style={{ paddingLeft: '36px', paddingRight: '32px', height: '36px', fontSize: '13px', background: 'var(--bg2)' }}
              />
              {userSearch.query && (
                <button onClick={userSearch.clear} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text3)', fontSize: '16px', cursor: 'pointer', lineHeight: 1 }}>×</button>
              )}
            </div>
          </div>
        )}

        {/* ── Sidebar body ─────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto' }}>

          {/* ── TAB: New DM ──────────────────────────────────────────── */}
          {sidebarMode === 'new' && (
            <>
              {!userSearch.isSearching ? (
                <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text3)', fontSize: '13px' }}>
                  <div style={{ fontSize: '1.8rem', marginBottom: '8px' }}>👥</div>
                  Search for someone to message
                </div>
              ) : userSearch.loading ? (
                <div style={{ padding: '2rem', textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
              ) : userSearch.results.users.length === 0 ? (
                <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text3)', fontSize: '13px' }}>
                  No users found for "{userSearch.query}"
                </div>
              ) : (
                <>
                  {/* Locked count hint */}
                  {(() => {
                    const locked = userSearch.results.users.filter(u => getContactMode(u) === 'locked').length;
                    return locked > 0 ? (
                      <div style={{ padding: '8px 14px', fontSize: '12px', color: 'var(--text3)', borderBottom: '0.5px solid var(--border)', display: 'flex', gap: '6px', alignItems: 'center' }}>
                        🔒 {locked} private account{locked !== 1 ? 's' : ''} hidden
                      </div>
                    ) : null;
                  })()}
                  {userSearch.results.users.map(u => (
                    <UserRow key={u._id} user={u} onClick={() => startDM(u)} />
                  ))}
                </>
              )}
            </>
          )}

          {/* ── TAB: DMs ─────────────────────────────────────────────── */}
          {sidebarMode === 'convs' && (
            <>
              {convLoading ? (
                <div style={{ padding: '2rem', textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
              ) : dmConversations.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text3)', fontSize: '13px' }}>
                  No DMs yet.<br />Use ✏️ New to start one!
                </div>
              ) : filteredDMs.length === 0 ? (
                <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text3)', fontSize: '13px' }}>
                  No conversations matching "{convSearch}"
                </div>
              ) : (
                filteredDMs.map(conv => (
                  <ConvRow
                    key={conv._id}
                    conv={conv}
                    userId={user?._id}
                    isActive={conv._id === activeConvId}
                    convSearch={convSearch}
                    onClick={() => openConversation(conv)}
                  />
                ))
              )}
            </>
          )}

          {/* ── TAB: Party Conversations ─────────────────────────────── */}
          {sidebarMode === 'parties' && (
            <>
              {convLoading ? (
                <div style={{ padding: '2rem', textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
              ) : partyConversations.length === 0 ? (
                <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text3)', fontSize: '13px' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🎉</div>
                  No party chats yet.<br />Create or join a watch party!
                </div>
              ) : filteredParties.length === 0 ? (
                <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text3)', fontSize: '13px' }}>
                  No party chats matching "{convSearch}"
                </div>
              ) : (
                filteredParties.map(conv => (
                  <ConvRow
                    key={conv._id}
                    conv={conv}
                    userId={user?._id}
                    isActive={conv._id === activeConvId}
                    convSearch={convSearch}
                    onClick={() => openConversation(conv)}
                    isParty
                  />
                ))
              )}
            </>
          )}

          {/* ── TAB: Message Requests ────────────────────────────────── */}
          {sidebarMode === 'requests' && (
            <>
              {convLoading ? (
                <div style={{ padding: '2rem', textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
              ) : convRequests.length === 0 ? (
                <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text3)', fontSize: '13px' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📨</div>
                  No message requests
                </div>
              ) : (
                filterBySearch(convRequests).map(conv => (
                  <RequestRow
                    key={conv._id}
                    conv={conv}
                    userId={user?._id}
                    isActive={conv._id === activeConvId}
                    onClick={() => openConversation(conv)}
                    onAccept={() => handleAcceptRequest(conv)}
                    onDecline={() => handleDeclineRequest(conv._id)}
                  />
                ))
              )}
            </>
          )}

        </div>
      </div>

      {sidebarOpen && <div className="messages-sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}

      {/* ── RIGHT: Chat Window ────────────────────────────────────── */}
      {activeConv ? (
        <div className="messages-chat">
          <div className="messages-chat-header">
            <button className="messages-back-btn" onClick={() => setSidebarOpen(true)}>
              ← <span>Chats</span>
            </button>
            <div className="conv-avatar" style={{ width: 38, height: 38, background: getColor(getConvName(activeConv, user?._id)), fontSize: '12px' }}>
              {getConvInitials(activeConv, user?._id)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {getConvName(activeConv, user?._id)}
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                {activeConv.participants?.length} participants
                {activeConv.isRequest && (
                  <span style={{ background: 'rgba(229,57,53,0.15)', color: 'var(--red)', borderRadius: '99px', padding: '1px 8px', fontSize: '10px', fontWeight: 600 }}>
                    REQUEST
                  </span>
                )}
              </div>
            </div>
            {/* Accept/Decline inline in chat header for request convos */}
            {activeConv.isRequest && (
              <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                <button className="btn btn-red btn-sm" onClick={() => handleAcceptRequest(activeConv)} style={{ fontSize: '12px' }}>Accept</button>
                <button className="btn btn-ghost btn-sm" onClick={() => handleDeclineRequest(activeConv._id)} style={{ fontSize: '12px', color: 'var(--text3)' }}>Decline</button>
              </div>
            )}
          </div>

          <div ref={scrollRef} className="messages-body" style={{ position: 'relative' }}>
            {hasMore && (
              <button className="btn btn-ghost btn-sm" onClick={loadMore} style={{ alignSelf: 'center', marginBottom: '8px' }}>
                Load older messages
              </button>
            )}
            {msgLoading ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: '4rem' }}>
                <div className="spinner" />
              </div>
            ) : messages.length === 0 ? (
              <div style={{ paddingTop: '4rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: 'var(--text3)', fontSize: '13px' }}>
                <span style={{ fontSize: '2rem' }}>👋</span>
                Say hello to {getConvName(activeConv, user?._id)}!
              </div>
            ) : messages.map((msg, i) => {
              const isOwn      = msg.senderId?.toString() === user?._id?.toString();
              const prevSender = messages[i - 1]?.senderId?.toString();
              const showAvatar = !isOwn && (i === 0 || prevSender !== msg.senderId?.toString());
              const msgId      = msg._id ?? `idx-${i}`;
              if (msg.type === 'movie') return <MovieMessage key={msgId} msg={msg} isOwn={isOwn} />;
              if (msg.type === 'party') return <PartyMessage key={msgId} msg={msg} isOwn={isOwn} />;
              return (
                <ChatMessage
                  key={msgId} msg={msg} isOwn={isOwn}
                  showAvatar={showAvatar} showName={showAvatar}
                  reactions={reactions[msgId] || {}}
                  onReact={(emoji) => addReaction(msgId, emoji)}
                  variant="dm"
                />
              );
            })}

            {typingUsers.length > 0 && (
              <div className="typing-indicator">
                <div className="typing-bubble">
                  <TypingDot delay="0s" /><TypingDot delay="0.15s" /><TypingDot delay="0.3s" />
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text3)' }}>
                  {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing
                </span>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div style={{ position: 'relative', height: 0 }}>
            <ScrollFAB visible={!isAtBottom} unreadCount={unreadCount} onClick={scrollToBottom} variant="dm" />
          </div>

          <ChatInput
            value={text} onChange={setText} onSend={handleSend}
            onTyping={handleTyping} disabled={sending || activeConv.isRequest}
            placeholder={activeConv.isRequest ? 'Accept request to reply…' : 'Message...'}
            variant="dm"
          />
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', gap: '12px', padding: '2rem', position: 'relative' }}>
          <button className="show-mobile btn btn-ghost btn-sm" style={{ position: 'absolute', top: '12px', left: '12px' }} onClick={() => setSidebarOpen(true)}>
            ☰ Chats
          </button>
          <span style={{ fontSize: '3rem' }}>💬</span>
          <div style={{ fontSize: '16px', fontWeight: 500, color: 'var(--text2)' }}>Your Messages</div>
          <div style={{ fontSize: '13px', textAlign: 'center', maxWidth: '280px' }}>
            Select a conversation or search for someone to chat with.
          </div>
          <button className="btn btn-red" onClick={() => setSidebarMode('new')}>New Message</button>
        </div>
      )}
    </div>
  );
}

// ── Conversation row ──────────────────────────────────────────────────────────
function ConvRow({ conv, userId, isActive, convSearch, onClick, isParty }) {
  const name     = getConvName(conv, userId);
  const initials = getConvInitials(conv, userId);
  const color    = getColor(name);
  const last     = conv.lastMessage;
  const unread   = conv.unread || 0;
  const highlighted = convSearch?.trim() ? highlightMatch(name, convSearch) : name;

  return (
    <div
      className={`conv-item${isActive ? ' active' : ''}`}
      onClick={onClick}
    >
      <div className="conv-avatar" style={{ background: color, position: 'relative' }}>
        {initials}
        {isParty && (
          <span style={{ position: 'absolute', bottom: -2, right: -2, fontSize: '10px' }}>🎉</span>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span
            className="conv-name"
            style={{ fontWeight: unread ? 600 : 500, color: unread ? 'var(--text)' : 'var(--text2)' }}
            dangerouslySetInnerHTML={{ __html: highlighted }}
          />
          {last?.createdAt && (
            <span style={{ fontSize: '11px', color: 'var(--text3)', flexShrink: 0 }}>
              {formatDistanceToNow(new Date(last.createdAt), { addSuffix: false })}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
          <span className="conv-last">
            {last?.type === 'movie' ? '🎬 Shared a movie'
              : last?.type === 'party' ? '🎉 Party invite'
              : last?.text || 'Start a conversation'}
          </span>
          {unread > 0 && (
            <span className="conv-unread-badge">{unread > 99 ? '99+' : unread}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Message request row ───────────────────────────────────────────────────────
function RequestRow({ conv, userId, isActive, onClick, onAccept, onDecline }) {
  const name     = getConvName(conv, userId);
  const initials = getConvInitials(conv, userId);
  const color    = getColor(name);
  const last     = conv.lastMessage;

  return (
    <div style={{
      padding: '12px 14px',
      background: isActive ? 'var(--surface)' : 'transparent',
      borderBottom: '0.5px solid var(--border)',
      cursor: 'pointer',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }} onClick={onClick}>
        <div className="conv-avatar" style={{ background: color, flexShrink: 0 }}>{initials}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 500, fontSize: '13.5px' }}>{name}</div>
          <div style={{ fontSize: '12px', color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '1px' }}>
            {last?.text || 'Wants to message you'}
          </div>
        </div>
        {last?.createdAt && (
          <span style={{ fontSize: '11px', color: 'var(--text3)', flexShrink: 0 }}>
            {formatDistanceToNow(new Date(last.createdAt), { addSuffix: false })}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', gap: '6px' }}>
        <button className="btn btn-red btn-sm" onClick={e => { e.stopPropagation(); onAccept(); }} style={{ flex: 1, fontSize: '12px' }}>✓ Accept</button>
        <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); onDecline(); }} style={{ flex: 1, fontSize: '12px', color: 'var(--text3)' }}>Decline</button>
      </div>
    </div>
  );
}

// ── User row (new DM search) ──────────────────────────────────────────────────
function UserRow({ user, onClick }) {
  const [hovered, setHovered] = useState(false);
  const mode  = getContactMode(user);
  const color = getColor(user.username);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '11px 14px', cursor: mode === 'locked' ? 'not-allowed' : 'pointer',
        background: hovered ? 'var(--surface)' : 'transparent',
        borderBottom: '0.5px solid var(--border)',
        transition: 'background 0.12s',
        opacity: mode === 'locked' ? 0.5 : 1,
      }}
    >
      <div style={{ width: 38, height: 38, borderRadius: '50%', background: color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600, flexShrink: 0 }}>
        {user.username?.slice(0, 2).toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13.5px', fontWeight: 500 }}>{user.username}</div>
        {user.bio && (
          <div style={{ fontSize: '11.5px', color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '1px' }}>
            {user.bio}
          </div>
        )}
      </div>
      <span style={{ fontSize: '12px', flexShrink: 0, color: mode === 'locked' ? 'var(--text3)' : mode === 'request' ? 'var(--text2)' : 'var(--red)' }}>
        {mode === 'locked' ? '🔒' : mode === 'request' ? 'Request →' : 'Message →'}
      </span>
    </div>
  );
}

// ── Highlight match ───────────────────────────────────────────────────────────
function highlightMatch(text, query) {
  if (!query.trim()) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    text.slice(0, idx) +
    `<mark style="background:rgba(229,57,53,0.25);color:inherit;border-radius:2px;padding:0 1px">${text.slice(idx, idx + query.length)}</mark>` +
    text.slice(idx + query.length)
  );
}