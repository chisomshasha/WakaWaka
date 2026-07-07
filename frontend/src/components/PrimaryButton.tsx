import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle, StyleProp } from 'react-native';
import { Colors, Radii, Spacing, Fonts } from '@/src/theme';

interface Props {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  icon?: React.ReactNode;
}

export function PrimaryButton({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  style,
  testID,
  icon,
}: Props) {
  const isDisabled = disabled || loading;
  const bg =
    variant === 'primary'
      ? Colors.okadaOrange
      : variant === 'secondary'
      ? Colors.asphaltBlack
      : variant === 'outline'
      ? 'transparent'
      : 'transparent';
  const textColor =
    variant === 'outline' || variant === 'ghost' ? Colors.asphaltBlack : Colors.textOnDark;
  const borderColor = variant === 'outline' ? Colors.asphaltBlack : 'transparent';

  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.85}
      style={[
        styles.btn,
        { backgroundColor: bg, borderColor, borderWidth: variant === 'outline' ? 2 : 0 },
        isDisabled && { opacity: 0.5 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <>
          {icon}
          <Text style={[styles.txt, { color: textColor, marginLeft: icon ? 8 : 0 }]}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 56,
    borderRadius: Radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
  },
  txt: {
    fontFamily: Fonts.bodyBold,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
