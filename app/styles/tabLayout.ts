import React from 'react';
import type { BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { StyleSheet } from 'react-native';

export const getTabScreenOptions = (colorScheme: 'light' | 'dark'): BottomTabNavigationOptions => ({
  headerShown: false,
  tabBarActiveTintColor: colorScheme === 'dark' ? '#ffff' : '#fff',
  tabBarInactiveTintColor: colorScheme === 'dark' ? '#e7e7e765' : '#e7e7e765',
  tabBarLabelStyle: { fontWeight: '700', fontSize: 12 },
  tabBarItemStyle: {
    borderRadius: 12,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  tabBarStyle: {
    // Barra flutuante para o conteúdo passar por baixo da tab bar
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 14,
    /*
    backgroundColor: 'transparent',
    borderColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.75)',
    */
    backgroundColor: colorScheme === 'light' ? 'rgba(20,20,20,0.8)' : 'rgba(20, 20, 20, 0.34)',
    borderWidth: 1,
    borderColor: colorScheme === 'light' ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.35)',
    borderTopWidth: 0,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    height: 80,
    paddingBottom: 10,
    paddingTop: 10,
    borderRadius: 22,
  },
  tabBarBackground: () =>
    React.createElement(BlurView, {
      intensity: 0,
      tint: colorScheme === 'dark' ? 'dark' : 'light',
      style: StyleSheet.absoluteFill,
    }),
});
 /*
    backgroundColor: "rgba(255,255,255,0.45)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.75)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    */