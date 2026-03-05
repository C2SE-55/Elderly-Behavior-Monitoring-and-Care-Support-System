import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';

import { COLORS } from '../../constants/color';

type Props = {
  title: string;
  onBack: () => void;
  avatarUri?: string;
};

export function ProfileHeader({
  title,
  onBack,
  avatarUri = 'https://i.pravatar.cc/200?img=12',
}: Props) {
  return (
    <View style={styles.header}>
      <View style={styles.headerTopRow}>
        <TouchableOpacity
          onPress={onBack}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.backButton}
        >
          <Text style={styles.backIcon}>{'←'}</Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle}>{title}</Text>

        {/* Placeholder để cân đối bố cục */}
        <View style={styles.headerRightPlaceholder} />
      </View>

      <View style={styles.avatarWrapper}>
        <View style={styles.avatarBorder}>
          <Image source={{ uri: avatarUri }} style={styles.avatar} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: COLORS.PURPLE,
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingBottom: 40,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  backIcon: {
    color: '#FFFFFF',
    fontSize: 20,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  headerRightPlaceholder: {
    width: 24,
  },
  avatarWrapper: {
    alignItems: 'center',
    marginTop: 20,
  },
  avatarBorder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: COLORS.CARD,
    overflow: 'hidden',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
});

