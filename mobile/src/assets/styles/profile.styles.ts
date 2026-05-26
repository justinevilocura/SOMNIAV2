import { StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(35, 35, 75, 0.95)',
    borderRadius: 18,
    padding: 24,
    margin: 14,
    marginTop: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: '#a259ff',
  },
  profileName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    fontFamily: 'RussoOne',
    marginBottom: 0,
  },
  profileEmail: {
    color: '#888',
  },
  settingsList: {
    marginTop: 20,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#444',
  },
  settingText: {
    color: '#fff',
    marginLeft: 15,
    fontSize: 16,
  },
  sectionTitle: {
    color: 'skyblue',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 24,
    marginBottom: 16,
    textAlign: 'center',
  },
  wearableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#444',
  },
  wearableIconContainer: {
    backgroundColor: '#fff',
    padding: 8,
    borderRadius: 8,
    marginRight: 16,
  },
  wearableTextContainer: {
    flex: 1,
  },
  wearableTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  wearableStatusLive: {
    color: '#43e97b',
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 4,
  },
  wearableStatusDisconnected: {
    color: '#888',
    fontSize: 12,
    marginTop: 4,
  },
  connectButton: {
    backgroundColor: '#a259ff',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  connectButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});

export default styles;
