import React, { useMemo, useState } from 'react';
import { SafeAreaView, View, Text, Button, TextInput, ScrollView } from 'react-native';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:4004';

export default function App() {
  const [screen, setScreen] = useState('home');
  const [status, setStatus] = useState('idle');
  const [offline] = useState(true);
  const screens = useMemo(
    () => ['home', 'scan', 'inspect', 'photos', 'transfer', 'sync', 'settings'],
    [],
  );
  return (
    <SafeAreaView>
      <ScrollView>
        <Text accessibilityRole="header">Rental Equipment Mobile</Text>
        <Text>Offline-first demo. NFC is feature-flagged off. Billing posting cannot succeed from device-only state.</Text>
        <Text>API {API}</Text>
        <Text>Status {status} · offline {String(offline)}</Text>
        {screens.map((s) => (
          <Button key={s} title={s} onPress={() => setScreen(s)} />
        ))}
        <View>
          <Text>Current screen: {screen}</Text>
          {screen === 'inspect' && (
            <>
              <TextInput placeholder="Grade A-D" accessibilityLabel="condition grade" />
              <TextInput placeholder="Meter" accessibilityLabel="meter reading" />
              <TextInput placeholder="Notes" accessibilityLabel="notes" />
            </>
          )}
          <Button title="Queue inspection" onPress={() => setStatus('queued-local')} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
