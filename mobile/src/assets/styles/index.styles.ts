import { StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
    padding: 20,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  contentContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logoOnly: {
    width: 300,
    height: 110,
    marginBottom: 12,
    alignSelf: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: '#bfc9db',
    textAlign: 'center',
    lineHeight: 26,
    fontWeight: '400',
    marginTop: 0,
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  featuresContainer: {
    marginBottom: 15,
  },
  featureCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'flex-start',
  },
  featureIcon: {
    marginBottom: 6,
    fontSize: 22,
  },
  featureTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#ffffff',
    marginBottom: 4,
  },
  featureText: {
    fontSize: 16,
    color: '#94A3B8',
    lineHeight: 18,
  },
  buttonContainer: {
    gap: 12,
  },
  getStartedButton: {
    backgroundColor: '#5d3fd3',
    borderRadius: 30,
    paddingVertical: 18,
    paddingHorizontal: 32,
    alignItems: 'center',
    shadowColor: '#5d3fd3',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
    transform: [{ scale: 1 }],
  },
  getStartedButtonPressed: {
    backgroundColor: '#4b2fc9',
    transform: [{ scale: 0.97 }],
  },
  getStartedButtonText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  inlineHeading: {
    display: 'none',
  },
  title: {
    display: 'none',
  },
  inlineLogo: {
    display: 'none',
  },
});

export default styles;