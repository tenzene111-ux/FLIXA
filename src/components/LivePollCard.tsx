import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import colors from '../theme/colors';
import { castLivePollVote, subscribeToLivePollVotes, subscribeToMyLivePollVote } from '../services/live';
import type { LivePoll } from '../types/livePoll';

type Props = {
  streamId: string;
  poll: LivePoll;
  uid: string | undefined;
};

export default function LivePollCard({ streamId, poll, uid }: Props) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [myVote, setMyVote] = useState<string | null>(null);

  useEffect(() => subscribeToLivePollVotes(streamId, poll.id, setCounts), [streamId, poll.id]);

  useEffect(() => {
    if (!uid) return;
    return subscribeToMyLivePollVote(streamId, poll.id, uid, setMyVote);
  }, [streamId, poll.id, uid]);

  const totalVotes = Object.values(counts).reduce((sum, count) => sum + count, 0);

  const handleVote = (optionId: string) => {
    if (!uid || myVote || !poll.active) return;
    castLivePollVote(streamId, poll.id, uid, optionId).catch(() => {});
  };

  return (
    <View style={styles.card}>
      <Text style={styles.question} numberOfLines={2}>
        {poll.question}
      </Text>
      {poll.options.map((option) => {
        const optionVotes = counts[option.id] ?? 0;
        const pct = totalVotes > 0 ? Math.round((optionVotes / totalVotes) * 100) : 0;
        const showResults = myVote !== null || !poll.active;
        return (
          <Pressable
            key={option.id}
            style={styles.option}
            onPress={() => handleVote(option.id)}
            disabled={!!myVote || !poll.active}
          >
            {showResults ? (
              <View style={[styles.optionFill, { width: `${pct}%` }, option.id === myVote && styles.optionFillMine]} />
            ) : null}
            <Text style={styles.optionText} numberOfLines={1}>
              {option.text}
            </Text>
            {showResults ? <Text style={styles.optionPct}>{pct}%</Text> : null}
          </Pressable>
        );
      })}
      <Text style={styles.voteCount}>{poll.active ? `${totalVotes} votes` : `Poll ended · ${totalVotes} votes`}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 16,
    padding: 14,
    gap: 8,
    maxWidth: '78%',
  },
  question: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  option: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  optionFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(124,77,255,0.35)',
  },
  optionFillMine: {
    backgroundColor: 'rgba(124,77,255,0.6)',
  },
  optionText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
  },
  optionPct: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 8,
  },
  voteCount: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    marginTop: 2,
  },
});
