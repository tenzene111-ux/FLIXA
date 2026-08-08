import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { isTrackReference, VideoTrack, type TrackReferenceOrPlaceholder } from '@livekit/react-native';
import colors from '../theme/colors';

type Props = {
  tracks: TrackReferenceOrPlaceholder[];
  hostUid: string;
  hostUsername: string;
  opponentUid: string;
  opponentUsername: string;
  hostScore: number;
  opponentScore: number;
  secondsRemaining: number;
  ended: boolean;
  winnerUid: string | null;
};

function formatClock(seconds: number): string {
  const clamped = Math.max(0, Math.round(seconds));
  const m = Math.floor(clamped / 60);
  const s = clamped % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function LiveBattleStage({
  tracks,
  hostUid,
  hostUsername,
  opponentUid,
  opponentUsername,
  hostScore,
  opponentScore,
  secondsRemaining,
  ended,
  winnerUid,
}: Props) {
  const valid = tracks.filter(isTrackReference);
  const hostTrack = valid.find((track) => track.participant.identity === hostUid);
  const opponentTrack = valid.find((track) => track.participant.identity === opponentUid);
  const total = hostScore + opponentScore;
  const hostPct = total > 0 ? (hostScore / total) * 100 : 50;

  return (
    <View style={StyleSheet.absoluteFillObject}>
      <View style={styles.row}>
        <View style={styles.half}>
          {hostTrack ? (
            <VideoTrack trackRef={hostTrack} style={StyleSheet.absoluteFillObject} />
          ) : (
            <View style={[StyleSheet.absoluteFillObject, styles.placeholder]} />
          )}
        </View>
        <View style={styles.half}>
          {opponentTrack ? (
            <VideoTrack trackRef={opponentTrack} style={StyleSheet.absoluteFillObject} />
          ) : (
            <View style={[StyleSheet.absoluteFillObject, styles.placeholder]} />
          )}
        </View>
      </View>
      <View style={styles.divider} pointerEvents="none" />

      <View style={styles.scoreBarTrack} pointerEvents="none">
        <View style={[styles.scoreBarFill, { width: `${hostPct}%` }]} />
      </View>

      <View style={styles.namesRow} pointerEvents="none">
        <Text style={styles.nameLabel} numberOfLines={1}>
          @{hostUsername} · {hostScore}
        </Text>
        <View style={styles.vsPill}>
          <Text style={styles.vsLabel}>VS</Text>
          {secondsRemaining > 0 ? <Text style={styles.timerLabel}>{formatClock(secondsRemaining)}</Text> : null}
        </View>
        <Text style={[styles.nameLabel, styles.nameLabelRight]} numberOfLines={1}>
          {opponentScore} · @{opponentUsername}
        </Text>
      </View>

      {ended ? (
        <View style={styles.resultBanner} pointerEvents="none">
          <Text style={styles.resultText}>
            {winnerUid === hostUid
              ? `@${hostUsername} wins!`
              : winnerUid === opponentUid
                ? `@${opponentUsername} wins!`
                : "It's a tie!"}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flex: 1,
    flexDirection: 'row',
  },
  half: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
  },
  placeholder: {
    backgroundColor: colors.surfaceAlt,
  },
  divider: {
    position: 'absolute',
    left: '50%',
    top: 0,
    bottom: 0,
    width: 2,
    marginLeft: -1,
    backgroundColor: colors.pink,
  },
  scoreBarTrack: {
    position: 'absolute',
    top: 100,
    left: 16,
    right: 16,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.cyan,
    overflow: 'hidden',
  },
  scoreBarFill: {
    height: '100%',
    backgroundColor: colors.pink,
  },
  namesRow: {
    position: 'absolute',
    top: 114,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nameLabel: {
    flex: 1,
    color: colors.text,
    fontSize: 11,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  nameLabelRight: {
    textAlign: 'right',
  },
  vsPill: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginHorizontal: 8,
  },
  vsLabel: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '800',
  },
  timerLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 1,
  },
  resultBanner: {
    position: 'absolute',
    top: '42%',
    left: 24,
    right: 24,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 16,
    paddingVertical: 14,
  },
  resultText: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
});
