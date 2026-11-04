import React from 'react';
import { TopBar } from './TopBar';
import type { BarTab } from './BottomBar';

/** Back goes to the previous screen; if there is none (first screen), to the home page. */
export function goBackOrHome(navigation: any, home = 'dashboard') {
  if (navigation.canGoBack()) navigation.goBack();
  else navigation.navigate(home);
}

/** App bar for the tab screens: back button everywhere except on the five tabs themselves. */
export function screenHeader(tabs: BarTab[], home = 'dashboard') {
  return ({ navigation, route, options }: any) => {
    const isTab = tabs.some((x) => x.name === route.name);
    return (
      <TopBar
        title={String(options.title ?? route.name)}
        navigation={navigation}
        left={isTab ? 'none' : 'back'}
        onLeft={() => goBackOrHome(navigation, home)}
      />
    );
  };
}

/**
 * Header for the pages that have their own stack (calculators, user and organization management):
 * the same app bar, with back going up one level inside the stack, or out of the stack at its first page.
 */
export function useStackScreenOptions(home = 'dashboard') {
  return {
    contentStyle: { backgroundColor: 'transparent' },
    header: ({ navigation, options, back }: any) => (
      <TopBar
        title={String(options.title ?? '')}
        navigation={navigation}
        left="back"
        onLeft={() => {
          if (back) navigation.goBack();
          else goBackOrHome(navigation.getParent() ?? navigation, home);
        }}
      />
    ),
  } as const;
}
