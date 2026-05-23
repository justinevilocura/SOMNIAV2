import 'react-native-gesture-handler';
import { AppRegistry } from 'react-native';
import App from './app/index';
import { name as appName } from './app.json';

// Register the app
AppRegistry.registerComponent(appName, () => App); 