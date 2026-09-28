import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING, FONTS } from '../theme';
import { Button } from '../components/Button';

type Props = {
  title: string;
  actions?: { label: string; onPress: () => void }[];
  children?: React.ReactNode;
};

export const ScreenStub = ({ title, actions = [], children }: Props) => (
  <View style={styles.container}>
    <Text style={styles.title}>{title}</Text>
    <View style={styles.content}>{children}</View>
    <View style={styles.actionsContainer}>
      {actions.map((a) => (
        <Button key={a.label} title={a.label} onPress={a.onPress} variant="secondary" />
      ))}
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.ink,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.l,
    gap: 15,
  },

  title: {
    color: COLORS.text,
    fontFamily: FONTS.headline,
    fontSize: 24,
    marginBottom: SPACING.s,
  },
  button: {
    backgroundColor: COLORS.ink2,
    padding: 15,
    borderRadius: 10,
    width: 250,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.inkLine,
  },
  buttonText: {
    color: COLORS.ember,
    fontFamily: FONTS.bodySemiBold,
    fontSize: 16,
  },
  content: {
    width: '100%',
    gap: SPACING.m,
    marginBottom: SPACING.m,
  },
  actionsContainer: {
    width: '100%',
    gap: SPACING.s,
  },
});
