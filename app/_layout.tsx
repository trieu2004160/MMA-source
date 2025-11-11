import { Stack } from 'expo-router';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { store, persistor } from '../store/reduxStore';
import { ActivityIndicator, View } from 'react-native';

export default function RootLayout() {
  return (
    <Provider store={store}>
      <PersistGate loading={
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      } persistor={persistor}>
        <Stack>
      <Stack.Screen 
        name="index" 
        options={{ 
          title: 'Study Mate - Dashboard',
          headerShown: true,
        }} 
      />
      <Stack.Screen 
        name="add-edit-session" 
        options={{ 
          title: 'Study Session',
          presentation: 'modal',
          headerShown: true,
        }} 
      />
            <Stack.Screen 
              name="planner" 
              options={{ 
                title: 'Study Planner',
                headerShown: true,
              }} 
            />
            <Stack.Screen 
              name="analytics" 
              options={{ 
                title: 'Learning Analytics',
                headerShown: true,
              }} 
            />
        </Stack>
      </PersistGate>
    </Provider>
  );
}

