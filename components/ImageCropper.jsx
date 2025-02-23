// import { Styles as styles } from './Styles';
// components/ImageCropper.js
import React, {useEffect, useState} from 'react';
import { View, Image, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import ImagePicker from 'react-native-image-crop-picker';

const { width, height } = Dimensions.get('window');

const ImageCropper = ({ imageUri, onCropComplete, onCancel }) => {
  const handleCrop = async () => {
    try {
      const croppedImage = await ImagePicker.openCropper({
        path: imageUri,
        width: 1000,
        height: 1000,
        cropperToolbarTitle: 'Crop Image',
        cropperActiveWidgetColor: '#007AFF',
        cropperStatusBarColor: '#007AFF',
        cropperToolbarColor: '#007AFF',
        cropperToolbarWidgetColor: '#FFFFFF',
        freeStyleCropEnabled: true,
      });
      onCropComplete(croppedImage);
    } catch (error) {
      if (error.message !== 'User cancelled image selection') {
        console.error('Cropping error:', error);
      }
      onCancel();
    }
  };

  // Start cropping immediately when component mounts
  React.useEffect(() => {
    handleCrop();
  }, []);

  return (
    <View style={styles.container}>
      {/* <Image 
        source={{ uri: imageUri }} 
        style={styles.preview}
        resizeMode="contain"
      />
      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={[styles.button, styles.cancelButton]} 
          onPress={onCancel}
        >
          <Icon name="close" size={24} color="#FFF" />
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.button, styles.confirmButton]} 
          onPress={handleCrop}
        >
          <Icon name="crop" size={24} color="#FFF" />
        </TouchableOpacity>
      </View> */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'black',
    zIndex: 1000,
  },
  preview: {
    flex: 1,
    width: width,
    height: height - 100,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  button: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  cancelButton: {
    backgroundColor: '#FF3B30',
  },
  confirmButton: {
    backgroundColor: '#34C759',
  },
});

export default ImageCropper;