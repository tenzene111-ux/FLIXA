import React, { useRef } from 'react';
import { PanResponder, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import type { VideoOverlay } from '../types/post';

type Props = {
  overlays: VideoOverlay[];
  editable?: boolean;
  onChange?: (overlays: VideoOverlay[]) => void;
};

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

export default function OverlayLayer({ overlays, editable = false, onChange }: Props) {
  const sizeRef = useRef({ width: 0, height: 0 });

  const handleLayout = (event: LayoutChangeEvent) => {
    sizeRef.current = { width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height };
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={editable ? 'box-none' : 'none'} onLayout={handleLayout}>
      {overlays.map((overlay) => (
        <OverlayItem
          key={overlay.id}
          overlay={overlay}
          editable={editable}
          getSize={() => sizeRef.current}
          onMove={(x, y) => {
            onChange?.(overlays.map((item) => (item.id === overlay.id ? { ...item, x, y } : item)));
          }}
        />
      ))}
    </View>
  );
}

function OverlayItem({
  overlay,
  editable,
  getSize,
  onMove,
}: {
  overlay: VideoOverlay;
  editable: boolean;
  getSize: () => { width: number; height: number };
  onMove: (x: number, y: number) => void;
}) {
  // PanResponder is created once, so the handlers below read live values
  // through refs rather than closing over render-time props.
  const overlayRef = useRef(overlay);
  overlayRef.current = overlay;
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;
  const getSizeRef = useRef(getSize);
  getSizeRef.current = getSize;
  const editableRef = useRef(editable);
  editableRef.current = editable;
  const startRef = useRef({ x: overlay.x, y: overlay.y });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => editableRef.current,
      onMoveShouldSetPanResponder: (_, gesture) =>
        editableRef.current && (Math.abs(gesture.dx) > 2 || Math.abs(gesture.dy) > 2),
      onPanResponderGrant: () => {
        startRef.current = { x: overlayRef.current.x, y: overlayRef.current.y };
      },
      onPanResponderMove: (_, gesture) => {
        const { width, height } = getSizeRef.current();
        if (!width || !height) return;
        onMoveRef.current(
          clamp01(startRef.current.x + gesture.dx / width),
          clamp01(startRef.current.y + gesture.dy / height)
        );
      },
    })
  ).current;

  return (
    <View
      {...(editable ? panResponder.panHandlers : {})}
      style={[styles.item, { left: `${overlay.x * 100}%`, top: `${overlay.y * 100}%` }]}
    >
      <Text style={overlay.kind === 'sticker' ? styles.stickerText : styles.overlayText}>{overlay.content}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  item: {
    position: 'absolute',
  },
  overlayText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  stickerText: {
    fontSize: 40,
  },
});
