/**
 * canContact / contactMode utility
 *
 * contactMode (set by backend searchUsers):
 *   'direct'  — follow relationship exists → straight through
 *   'request' — public stranger → goes to recipient's Requests tab
 *   'locked'  — private stranger → blocked
 *
 * For users from followers/following lists (no contactMode from backend)
 * they are always 'direct' — a follow relationship exists by definition.
 */

export function getContactMode(person) {
  if (person?.contactMode) return person.contactMode;
  // In followers/following lists — always connected
  return 'direct';
}

export function canContact(person) {
  return getContactMode(person) !== 'locked';
}

export function lockedToast(username) {
  return `@${username} has a private account. Follow them first.`;
}

export function requestHint(action) {
  const hints = {
    message: 'They can accept or decline this message request.',
    share:   'Goes to their Requests tab — they can accept or decline.',
    invite:  'Goes to their Requests tab — they can accept or decline.',
  };
  return hints[action] || 'Goes to their requests.';
}