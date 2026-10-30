// @ai-generated
import React from 'react';
import {View} from 'react-native';
import MenuView, {type MenuAction} from '@expo/ui/community/menu';
import {useNativeTheme} from './useNativeTheme';
import {
  isMenuGroup,
  type NativeMenuItem,
  type NativeMenuProps,
} from './menuTypes';

function toAction(item: NativeMenuItem): MenuAction {
  return {
    id: item.id,
    title: item.title,
    state: item.checked === undefined ? undefined : item.checked ? 'on' : 'off',
    attributes: {destructive: item.destructive, disabled: item.disabled},
  };
}

/**
 * A Material dropdown menu around a React Native trigger. A tap or a long
 * press opens it, anchored to the trigger.
 */
export function NativeMenu({
  entries,
  onSelect,
  trigger = 'tap',
  accessibilityLabel,
  style,
  testID,
  children,
}: NativeMenuProps) {
  const native = useNativeTheme();
  const actions: MenuAction[] = entries.map(entry =>
    isMenuGroup(entry)
      ? {
          id: entry.id,
          title: entry.title ?? '',
          displayInline: !entry.submenu,
          subactions: entry.items.map(toAction),
        }
      : toAction(entry),
  );
  return (
    <MenuView
      actions={actions}
      onPressAction={event => onSelect(event.nativeEvent.event)}
      shouldOpenOnLongPress={trigger === 'longPress'}
      colorScheme={native.colorScheme}
      style={style}
      testID={testID}>
      <View
        accessible
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}>
        {children}
      </View>
    </MenuView>
  );
}
