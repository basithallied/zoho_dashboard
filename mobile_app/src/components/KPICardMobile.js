import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export const KPICardMobile = ({ title, value, unit, trend, trendValue }) => {
  const formattedValue = typeof value === 'number' ? value.toLocaleString() : value;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.value}>
        {unit}{formattedValue}
      </Text>
      <View style={styles.trendRow}>
        <Text style={[styles.trendText, { color: trend === 'down' && !title.includes('DSO') ? '#ef4444' : '#10b981' }]}>
          {trendValue || (trend === 'up' ? '▲ Positive' : '▼ Decreasing')}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 14,
    marginRight: 10,
    width: 160,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4
  },
  title: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600'
  },
  value: {
    fontSize: 18,
    fontWeight: '800',
    color: '#f8fafc',
    marginVertical: 6
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  trendText: {
    fontSize: 11,
    fontWeight: '700'
  }
});
