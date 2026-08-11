import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

/**
 * One traceable figure. `subtitle` carries the period and the number of source
 * records behind the value, so the reader can see what it was computed from.
 */
export const KPICardMobile = ({ title, value, subtitle, change, positive }) => (
  <View style={styles.card}>
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>
      {change !== null && change !== undefined && (
        <Text style={[styles.change, { color: positive ? '#34d399' : '#f87171' }]}>
          {change >= 0 ? '▲' : '▼'} {Math.abs(change).toFixed(1)}%
        </Text>
      )}
    </View>
    <Text style={styles.value}>{value}</Text>
    {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1c1f3d',
    borderRadius: 14,
    padding: 14,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 12, color: '#a8adc9', fontWeight: '600', flexShrink: 1 },
  change: { fontSize: 11, fontWeight: '700' },
  value: { fontSize: 20, fontWeight: '800', color: '#f8fafc', marginTop: 6 },
  subtitle: { fontSize: 11, color: '#6b7186', marginTop: 3 },
});
