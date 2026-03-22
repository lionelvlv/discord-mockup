import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import './TypingIndicator.css';

interface TypingIndicatorProps {
  userIds: string[];
}

// Module-level username cache — avoids re-fetching users we already know.
// Shared across all TypingIndicator instances for the session lifetime.
const usernameCache = new Map<string, string>();

const TypingIndicator: React.FC<TypingIndicatorProps> = ({ userIds }) => {
  const [usernames, setUsernames] = useState<string[]>([]);

  useEffect(() => {
    if (userIds.length === 0) {
      setUsernames([]);
      return;
    }

    let cancelled = false;

    const resolveNames = async () => {
      const names: string[] = [];
      for (const id of userIds) {
        if (usernameCache.has(id)) {
          names.push(usernameCache.get(id)!);
          continue;
        }
        try {
          const snap = await getDoc(doc(db, 'users', id));
          const name = snap.exists() ? (snap.data().username as string) : id.slice(0, 8);
          usernameCache.set(id, name);
          names.push(name);
        } catch {
          names.push(id.slice(0, 8));
        }
      }
      if (!cancelled) setUsernames(names);
    };

    resolveNames();
    return () => { cancelled = true; };
  }, [userIds.join(',')]); // stable dep — only re-runs when the set of IDs changes

  if (usernames.length === 0) return null;

  const text =
    usernames.length === 1
      ? `${usernames[0]} is typing`
      : usernames.length === 2
      ? `${usernames[0]} and ${usernames[1]} are typing`
      : `${usernames.length} people are typing`;

  return (
    <div className="typing-indicator">
      <span className="typing-text">{text}</span>
      <span className="typing-dots">
        <span className="dot">.</span>
        <span className="dot">.</span>
        <span className="dot">.</span>
      </span>
    </div>
  );
};

export default TypingIndicator;
