// @ts-nocheck
/**
 * SECURE ELECTION MANAGEMENT MOBILE APPLICATION - REACT NATIVE (ANDROID & IOS)
 * Production-ready React Native + Expo implementation
 */

import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Alert,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';

const API_BASE = 'https://your-election-api-domain.com/api';

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [election, setElection] = useState<any>(null);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [hasVoted, setHasVoted] = useState(false);
  const [transactionRef, setTransactionRef] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password, roleHint: 'VOTER' }),
      });
      const data = await res.json();
      if (res.ok) {
        setToken(data.token);
        setUser(data.user);
        loadElection(data.token);
      } else {
        Alert.alert('Login Failed', data.error || 'Invalid credentials');
      }
    } catch {
      Alert.alert('Network Error', 'Unable to connect to election server');
    } finally {
      setLoading(false);
    }
  };

  const loadElection = async (authToken: string) => {
    try {
      const elecRes = await fetch(`${API_BASE}/elections/active`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const elecData = await elecRes.json();
      setElection(elecData.election);

      const statusRes = await fetch(`${API_BASE}/elections/voters/me/voting-status`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const statusData = await statusRes.json();
      setHasVoted(statusData.hasVoted);
      setTransactionRef(statusData.transactionReference);

      if (elecData.election) {
        const candRes = await fetch(`${API_BASE}/elections/${elecData.election.id}/candidates`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        const candData = await candRes.json();
        setCandidates(candData.candidates || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const castVote = async (candidateId: string, candidateName: string) => {
    Alert.alert(
      'Confirm Your Vote',
      `Please verify your selection for "${candidateName}" before submitting. Your vote cannot be changed after submission.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Vote',
          onPress: async () => {
            setLoading(true);
            try {
              const res = await fetch(`${API_BASE}/elections/${election.id}/vote`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ candidateId }),
              });
              const data = await res.json();
              if (res.ok) {
                setHasVoted(true);
                setTransactionRef(data.transactionReference);
                Alert.alert('Success', 'Vote Successfully Submitted');
              } else {
                Alert.alert('Notice', data.error || 'Failed to submit vote');
              }
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  if (!token) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loginBox}>
          <Text style={styles.title}>National Election Portal</Text>
          <Text style={styles.subtitle}>Android & iOS Secure Voting App</Text>

          <TextInput
            placeholder="Voter ID / Mobile / Email"
            placeholderTextColor="#64748B"
            value={identifier}
            onChangeText={setIdentifier}
            style={styles.input}
          />
          <TextInput
            placeholder="Password"
            placeholderTextColor="#64748B"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            style={styles.input}
          />

          <TouchableOpacity
            style={styles.btnPrimary}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.btnText}>Sign In to Vote</Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{user?.name}</Text>
        <Text style={styles.headerSub}>Voter ID: {user?.voterId}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{election?.electionName}</Text>
        <Text style={styles.statusLive}>
          {election?.status === 'ACTIVE'
            ? '● Voting is LIVE'
            : election?.status === 'UPCOMING'
            ? '⏳ Election starts soon'
            : 'Voting has ended'}
        </Text>
      </View>

      {hasVoted ? (
        <View style={[styles.card, styles.receiptCard]}>
          <Text style={styles.receiptTitle}>Vote Successfully Submitted</Text>
          <Text style={styles.receiptRef}>Ref: {transactionRef}</Text>
          <Text style={styles.receiptSub}>You have already voted in this election.</Text>
        </View>
      ) : (
        <FlatList
          data={candidates}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.candidateCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.candName}>{item.candidateName}</Text>
                <Text style={styles.candParty}>{item.partyOrSlate}</Text>
              </View>
              <TouchableOpacity
                style={styles.voteBtn}
                onPress={() => castVote(item.id, item.candidateName)}
                disabled={election?.status !== 'ACTIVE'}
              >
                <Text style={styles.voteBtnText}>Vote</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A', padding: 16 },
  loginBox: { flex: 1, justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#FFF', textAlign: 'center' },
  subtitle: { fontSize: 13, color: '#94A3B8', textAlign: 'center', marginBottom: 24 },
  input: {
    backgroundColor: '#1E293B',
    color: '#FFF',
    padding: 14,
    borderRadius: 10,
    marginBottom: 12,
  },
  btnPrimary: {
    backgroundColor: '#6366F1',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  btnText: { color: '#FFF', fontWeight: 'bold', fontSize: 15 },
  header: { marginBottom: 16 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#FFF' },
  headerSub: { fontSize: 12, color: '#94A3B8' },
  card: { backgroundColor: '#1E293B', padding: 16, borderRadius: 12, marginBottom: 16 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#FFF' },
  statusLive: { color: '#34D399', fontWeight: 'bold', marginTop: 4 },
  candidateCard: {
    backgroundColor: '#1E293B',
    padding: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  candName: { fontSize: 15, fontWeight: 'bold', color: '#FFF' },
  candParty: { fontSize: 12, color: '#94A3B8' },
  voteBtn: { backgroundColor: '#6366F1', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 },
  voteBtnText: { color: '#FFF', fontWeight: 'bold' },
  receiptCard: { backgroundColor: '#064E3B', borderColor: '#059669', borderWidth: 1 },
  receiptTitle: { fontSize: 16, fontWeight: 'bold', color: '#34D399' },
  receiptRef: { fontFamily: 'monospace', color: '#A7F3D0', marginVertical: 6 },
  receiptSub: { fontSize: 12, color: '#E2E8F0' },
});
