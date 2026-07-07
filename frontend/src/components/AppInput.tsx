import React, { useState } from 'react';
import { View, TextInput, Text, StyleSheet, TextInputProps } from 'react-native';
import { Colors, Radii, Spacing, Fonts } from '@/src/theme';

interface Props extends TextInputProps {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  testID?: string;
}

export function AppInput({ label, error, leftIcon, rightIcon, testID, ...props }: Props) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View
        style={[
          styles.field,
          focused && styles.focused,
          error && styles.errored,
        ]}
      >
        {leftIcon ? <View style={{ marginRight: 10 }}>{leftIcon}</View> : null}
        <TextInput
          {...props}
          testID={testID}
          placeholderTextColor={Colors.textTertiary}
          style={styles.input}
          onFocus={(e) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
        />
        {rightIcon}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  label: {
    fontFamily: Fonts.bodyBold,
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  field: {
    minHeight: 56,
    borderRadius: Radii.lg,
    backgroundColor: Colors.gray50,
    borderWidth: 1.5,
    borderColor: Colors.gray200,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  focused: {
    borderColor: Colors.asphaltBlack,
    backgroundColor: Colors.surface,
  },
  errored: {
    borderColor: Colors.error,
  },
  input: {
    flex: 1,
    fontFamily: Fonts.body,
    fontSize: 16,
    color: Colors.textPrimary,
    paddingVertical: 12,
  },
  errorText: {
    fontFamily: Fonts.body,
    color: Colors.error,
    fontSize: 12,
    marginTop: 4,
  },
});
