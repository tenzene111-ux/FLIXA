import React from 'react';
import { StyleSheet, View } from 'react-native';
import { isTrackReference, VideoTrack, type TrackReferenceOrPlaceholder } from '@livekit/react-native';
import colors from '../theme/colors';

type Props = {
  tracks: TrackReferenceOrPlaceholder[];
};

// Fullscreen when there's a single publisher (the common case — just the
// host); a simple up-to-4 grid once co-hosts start publishing too.
export default function LiveStageGrid({ tracks }: Props) {
  const valid = tracks.filter(isTrackReference);

  if (valid.length === 0) {
    return <View style={[StyleSheet.absoluteFillObject, styles.placeholder]} />;
  }
  if (valid.length === 1) {
    return <VideoTrack trackRef={valid[0]} style={StyleSheet.absoluteFillObject} />;
  }
  return (
    <View style={[StyleSheet.absoluteFillObject, styles.grid]}>
      {valid.slice(0, 4).map((track) => (
        <View key={`${track.participant.identity}-${track.publication?.trackSid ?? track.source}`} style={styles.cell}>
          <VideoTrack trackRef={track} style={StyleSheet.absoluteFillObject} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: colors.surfaceAlt,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: '50%',
    height: '50%',
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.4)',
  },
});
