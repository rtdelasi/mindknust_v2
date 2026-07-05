import { MaterialCommunityIcons } from '@expo/vector-icons';
import { forwardRef } from 'react';
import {
  StyleProp,
  StyleSheet,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';

import {
  BorderRadius,
  FontSize,
  FontWeight,
  Size,
  Shadows,
  Spacing,
} from '@/constants/theme';
import { useTheme, useThemeMode } from '@/hooks/use-theme';

type SearchBarProps = TextInputProps & {
  containerStyle?: StyleProp<ViewStyle>;
};

export const SearchBar = forwardRef<TextInput, SearchBarProps>(function SearchBar(
  { style, containerStyle, placeholderTextColor, ...props },
  ref,
) {
  const theme = useTheme();
  const isDark = useThemeMode() === 'dark';
  const shadow = isDark ? Shadows.dark : Shadows.light;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.surfaceSoft,
          borderColor: theme.border,
          borderRadius: BorderRadius.full,
          minHeight: Size.inputHeight,
          ...shadow.card,
        },
        containerStyle,
      ]}>
      <MaterialCommunityIcons
        name="magnify"
        size={Size.iconMd}
        color={theme.textSecondary}
      />
      <TextInput
        ref={ref}
        placeholderTextColor={placeholderTextColor ?? theme.textSecondary}
        style={[
          styles.input,
          {
            color: theme.text,
            fontSize: FontSize.body,
            fontWeight: FontWeight.regular,
          },
          style,
        ]}
        {...props}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderWidth: 1,
  },
  input: {
    flex: 1,
    paddingVertical: 0,
  },
});
