import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AntDesign from 'react-native-vector-icons/AntDesign';
import Feather from 'react-native-vector-icons/Feather';
import authService from '../../services/authService';
import { ApiError } from '../../services/api';

const ResetPasswordScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleResetPassword = async () => {
    if (!email.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập email của bạn.');
      return;
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      Alert.alert('Lỗi', 'Email không đúng định dạng.');
      return;
    }

    try {
      setLoading(true);
      await authService.forgotPassword(email);

      Alert.alert(
        'Đã gửi yêu cầu',
        'Kiểm tra email của bạn để nhận mã OTP đặt lại mật khẩu.',
        [
          {
            text: 'Nhập mã OTP',
            onPress: () =>
              navigation.navigate('OTPVerification', {
                email,
                purpose: 'password_reset',
              }),
          },
        ]
      );
    } catch (error) {
      let message = 'Không thể gửi yêu cầu. Vui lòng thử lại sau.';
      if (error instanceof ApiError) {
        switch (error.status) {
          case 404:
            message = 'Không tìm thấy tài khoản với email này.';
            break;
          case 429:
            message = 'Bạn đã yêu cầu quá nhiều lần. Vui lòng thử lại sau.';
            break;
          default:
            message = error.message || message;
        }
      }
      Alert.alert('Lỗi', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.headerRow}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <AntDesign name="arrowleft" size={20} color="#0A0A0A" />
            </TouchableOpacity>
            <View style={styles.headerTitleWrap}>
              <Text style={styles.headerTitle}>Quên mật khẩu</Text>
            </View>
            <View style={styles.headerPlaceholder} />
          </View>
          <Text style={styles.headerSubtitle}>
            Nhập email tài khoản của bạn để nhận mã OTP đặt lại mật khẩu. Mã có hiệu lực trong một thời gian ngắn.
          </Text>

          <View style={styles.card}>
            <View style={styles.inputCard}>
              <Feather name="mail" size={20} color="#8E8E93" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Email của bạn"
                placeholderTextColor="#B0B0B3"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <TouchableOpacity
              style={[styles.submitButton, loading && { opacity: 0.7 }]}
              onPress={handleResetPassword}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitText}>Gửi mã OTP</Text>}
            </TouchableOpacity>

            <View style={styles.noteRow}>
              <Feather name="info" size={16} color="#7A7A7A" />
              <Text style={styles.noteText}>
                Nếu không nhận được email, hãy kiểm tra thư mục spam hoặc liên hệ bộ phận hỗ trợ.
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F0F0',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 36,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: 'rgba(0,0,0,0.08)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
  },
  headerPlaceholder: {
    width: 44,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#7A7A7A',
    lineHeight: 22,
    marginBottom: 30,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    gap: 24,
    shadowColor: 'rgba(0,0,0,0.05)',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
  },
  inputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderWidth: 1,
    borderColor: '#E7E7EA',
  },
  inputIcon: {
    marginRight: 14,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#0A0A0A',
  },
  submitButton: {
    backgroundColor: '#000000',
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  noteText: {
    flex: 1,
    fontSize: 13,
    color: '#6D6D73',
    lineHeight: 20,
  },
});

export default ResetPasswordScreen;
