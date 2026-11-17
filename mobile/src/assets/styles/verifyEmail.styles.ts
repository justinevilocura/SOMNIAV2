import { StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  headerContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 0,
    marginTop: 0,
  },
  logo: {
    width: 300,
    height: 100,
    marginTop: 40,
    marginBottom: 0,
  },
  card: {
    width: '94%',
    maxWidth: 420,
    backgroundColor: '#fff',
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 28,
    paddingBottom: 36,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.13,
    shadowRadius: 18,
    elevation: 10,
    alignItems: 'center',
    alignSelf: 'center',
    marginTop: 0,
    marginBottom: 8,
  },
  backButton: {
    position: 'absolute',
    top: 18,
    left: 18,
    zIndex: 10,
    padding: 4,
  },
  iconContainer: {
    marginBottom: 16,
    marginTop: 8,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#eef3ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  emailText: {
    color: '#3578e5',
    fontWeight: '600',
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 28,
  },
  otpInput: {
    width: 46,
    height: 54,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    backgroundColor: '#f5f5f5',
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
    color: '#222',
  },
  otpInputFilled: {
    borderColor: '#3578e5',
    backgroundColor: '#eef3ff',
  },
  verifyButton: {
    backgroundColor: '#3578e5',
    borderRadius: 12,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    marginBottom: 20,
  },
  verifyButtonDisabled: {
    backgroundColor: '#a8c4f0',
  },
  verifyButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: 'bold',
  },
  resendContainer: {
    alignItems: 'center',
  },
  resendText: {
    fontSize: 14,
    color: '#888',
    marginBottom: 4,
  },
  resendLink: {
    fontSize: 14,
    color: '#3578e5',
    fontWeight: '600',
  },
  resendLinkDisabled: {
    color: '#aaa',
  },
});

export default styles;
