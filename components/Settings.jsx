// components/Settings.js
import React, {useEffect, useState} from 'react';
import { View, Switch, Text, TouchableOpacity, StyleSheet, Modal, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import { clearImageCache, deleteDirectory } from '../utils/cacheManager';
const Settings = ({ isVisible, onClose }) => {
  const [autoClearCache, setAutoClearCache] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const value = await AsyncStorage.getItem('autoClearCache');
      setAutoClearCache(value === 'true');
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const toggleAutoClearCache = async (value) => {
    try {
      await AsyncStorage.setItem('autoClearCache', value.toString());
      setAutoClearCache(value);
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  // const clearCache = async () => {
  //   try {
  //     const cacheDir = RNFS.CachesDirectoryPath;
  //     console.log('cache::',cacheDir);
  //     await RNFS.readDir(cacheDir).then((result) => {
  //       result.forEach(async (item) => {
  //         if (item.name.includes('.jpg') || item.name.includes('.png')) {
  //           await RNFS.unlink(item.path);
  //         }
  //       });
  //     });
  //     Alert.alert('Success', 'Cache cleared successfully');
  //   } catch (error) {
  //     console.error('Error clearing cache:', error);
  //     Alert.alert('Error', 'Failed to clear cache');
  //   }
  // };

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.settingsContainer}>
        <View style={styles.settingsContent}>
          <Text style={styles.settingsTitle}>Settings</Text>
          
          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>Auto Clear Cache</Text>
            <Switch
              value={autoClearCache}
              onValueChange={toggleAutoClearCache}
            />
          </View>

          <TouchableOpacity 
            style={styles.clearCacheButton}
            onPress={clearImageCache}
          >
            <Text style={styles.clearCacheText}>Clear Cache Now</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.closeButton}
            onPress={onClose}
          >
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default Settings;

const styles = StyleSheet.create({
  
  settingsContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsContent: {
    width: '80%',
    backgroundColor: 'grey',
    borderRadius: 20,
    padding: 20,
  },
  settingsTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color:'white',
    // color:'#333333',
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  settingLabel: {
    fontSize: 18,
    color:'#fff'
,  },
  clearCacheButton: {
    backgroundColor: '#87CEEB',
    padding: 15,
    borderRadius: 10,
    marginTop: 20,
  },
  clearCacheText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
  imageContainer: {
    position: 'relative',
    marginBottom: 15,
  },
  resultImage: {
    width: '100%',
    height: 200,
    borderRadius: 10,
  },
  saveButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    padding: 8,
  },
  closeButton: {
    backgroundColor: '#ff6347',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginTop:3,
  },
  closeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});