
import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  PermissionsAndroid,
  Alert,
  Modal,
  TouchableWithoutFeedback,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  SafeAreaView,
  Button,
  FlatList,
  Platform,
  Animated,
  Image
} from 'react-native';
import WebView from 'react-native-webview';
import Tts from 'react-native-tts';
import RNFS from 'react-native-fs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules } from 'react-native';
import { RNCamera } from 'react-native-camera';
import TextRecognition, { TextRecognitionScript } from "@react-native-ml-kit/text-recognition";
import wanakana from 'wanakana';

import ImagePicker from 'react-native-image-crop-picker';
import Icon from 'react-native-vector-icons/Ionicons';
import Icons from 'react-native-vector-icons/MaterialIcons';
import Iconss from 'react-native-vector-icons/Feather';

import ImageCropper from './components/ImageCropper';
import Settings from './components/Settings';
import { checkAndClearCache } from './utils/cacheManager';
import Toast from 'react-native-toast-message';

const { Python } = NativeModules;
const { width, height } = Dimensions.get('window');
const MAX_CHARS_PER_TRANSLATION = 20;

const chunkText = (text) => {
  const lines = text.split('\n');
  const chunks = [];
  let currentChunk = '';
  let currentLines = [];

  for (const line of lines) {
    // If adding this line would exceed the limit
    if ((currentChunk + '\n' + line).length > MAX_CHARS_PER_TRANSLATION) {
      // If we have accumulated lines, save them as a chunk
      if (currentLines.length > 0) {
        chunks.push(currentLines.join('\n'));
        currentChunk = line;
        currentLines = [line];
      } else {
        // If a single line is longer than the limit, split it by characters
        const words = line.split(' ');
        let tempChunk = '';
        for (const word of words) {
          if ((tempChunk + ' ' + word).length > MAX_CHARS_PER_TRANSLATION) {
            if (tempChunk) chunks.push(tempChunk.trim());
            tempChunk = word;
          } else {
            tempChunk += (tempChunk ? ' ' : '') + word;
          }
        }
        if (tempChunk) chunks.push(tempChunk.trim());
      }
    } else {
      currentChunk += (currentChunk ? '\n' : '') + line;
      currentLines.push(line);
    }
  }

  // Don't forget the last chunk
  if (currentLines.length > 0) {
    chunks.push(currentLines.join('\n'));
  }

  return chunks;
};

async function translateJapaneseToEnglish(japaneseText) {
  try {
    if (!japaneseText.trim()) return '';

    // If text is within limits, translate directly
    if (japaneseText.length <= MAX_CHARS_PER_TRANSLATION) {
      return await Python.call('translate_text', japaneseText);
    }

    // Split text into chunks and translate each chunk
    const chunks = chunkText(japaneseText);
    const translations = await Promise.all(
      chunks.map(chunk => Python.call('translate_text', chunk))
    );

    return translations.join('\n');
  } catch (error) {
    console.error('Translation error:', error);
    throw new Error(`Translation failed: ${error.message}`);
  }
}

const RomajiTranslator = () => {
  const camera = useRef(null);
  const [hasPermission, setHasPermission] = useState(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [recognizedText, setRecognizedText] = useState('');
  const [romajiText, setRomajiText] = useState('');
  const [englishText, setEnglishText] = useState('');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [wordsAndRomaji, setWordsAndRomaji] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasPreviousResults, setHasPreviousResults] = useState(false);
  const [isWebViewModalVisible, setIsWebViewModalVisible] = useState(false);
  const [searchUrl, setSearchUrl] = useState('');

  const [isSaved, setIsSaved] = useState(false); // Track if the image is saved

  const [isCropping, setIsCropping] = useState(false);
  const [tempImageUri, setTempImageUri] = useState(null);
  const [isSettingsVisible, setIsSettingsVisible] = useState(false);

  const scrollViewRef = useRef(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [initialContentReady, setInitialContentReady] = useState(false);

  const [isProcessingTranslation, setIsProcessingTranslation] = useState(false);
  const translationQueue = useRef([]);
  const isMounted = useRef(true);

  const [isJapaneseOnly, setIsJapaneseOnly] = useState(true);
  const [galleryPermission, setGalleryPermission] = useState(null);
  const translateX = useRef(new Animated.Value(0)).current;

  const handleSearch = (searchQuery) => {

    // Clean up the text by replacing newlines with spaces and removing extra spaces
    const cleanedQuery = searchQuery
      .replace(/\n/g, ' ')  // Replace all newlines with spaces
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .trim();             // Remove leading/trailing spaces

    const encodedQuery = encodeURIComponent(cleanedQuery);


    const url = isJapaneseOnly
      ? `https://www.google.com/search?q=${encodedQuery}`
      : `https://chatgpt.com/search?q=${encodedQuery}`;

    // const url = `https://chatgpt.com/search?q=${encodedQuery}`;
    setSearchUrl(url);
    setIsWebViewModalVisible(true);
  };

  const showPreviousResults = () => {
    if (recognizedText) {
      setIsModalVisible(true);
    }
  };

  
  useEffect(() => {
    checkAndClearCache();
  }, []);

    // Load saved state or set default on first-time open
    useEffect(() => {
      const loadToggleState = async () => {
        try {
          const storedValue = await AsyncStorage.getItem('toggleState');
          if (storedValue === null) {
            // First-time open → Set default value (`false`)
            await AsyncStorage.setItem('toggleState', JSON.stringify(false));
            setIsJapaneseOnly(true);
          } else {
            setIsJapaneseOnly(JSON.parse(storedValue)); // Load saved value
          }
        } catch (error) {
          console.error('Error loading toggle state:', error);
        }
      };
      loadToggleState();
    }, []);

  // Update the animation value when the state changes
  useEffect(() => {
    Animated.timing(translateX, {
      toValue: isJapaneseOnly ? 26 : 0, // Adjust this value based on your design
      duration: 200,
      useNativeDriver: true,
    }).start();
    console.log(isJapaneseOnly);

  }, [isJapaneseOnly]);

  const toggleSwitch = async () => {
    try {
      const newValue = !isJapaneseOnly;
      setIsJapaneseOnly(newValue);
      await AsyncStorage.setItem('toggleState', JSON.stringify(newValue));
    } catch (error) {
      console.error('Error saving toggle state:', error);
    }
  };

  const flatListRef = useRef(null);
  const verticalScrollRef = useRef(null);

  useEffect(() => {
    const triggerPermissionRequests = async () => {
      await requestPermissions().then(
        setTimeout(async () => {
          await requestPermissions(); // Second call after 3 seconds

        }, 1000)
      )
    };

    triggerPermissionRequests();
  }, []);


  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Split translation into smaller chunks to prevent UI blocking
  const translateInChunks = async (words) => {
    const CHUNK_SIZE = 5; // Process 5 words at a time
    const chunks = [];

    for (let i = 0; i < words.length; i += CHUNK_SIZE) {
      chunks.push(words.slice(i, i + CHUNK_SIZE));
    }

    const translations = new Array(words.length).fill('Translating...');
    setWordsAndRomaji(prevWords =>
      prevWords.map((word, index) => ({
        ...word,
        english: translations[index]
      }))
    );

    for (let i = 0; i < chunks.length; i++) {
      if (!isMounted.current) return;

      const chunk = chunks[i];
      const startIndex = i * CHUNK_SIZE;

      try {
        const chunkTranslations = await Promise.all(
          chunk.map(word =>
            word.trim() ? translateJapaneseToEnglish(word) : Promise.resolve('')
          )
        );

        if (!isMounted.current) return;

        // Update translations array
        chunkTranslations.forEach((translation, index) => {
          translations[startIndex + index] = translation;
        });

        // Update state with new translations
        setWordsAndRomaji(prevWords =>
          prevWords.map((word, index) => ({
            ...word,
            english: translations[index]
          }))
        );

        // Give UI thread a chance to breathe
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (error) {
        console.error('Error translating chunk:', error);
        // Continue with next chunk even if one fails
      }
    }
  };


  const requestPermissions = async () => {
    try {
      // Define permissions based on Android version
      const permissions = {
        CAMERA: PermissionsAndroid.PERMISSIONS.CAMERA,
        AUDIO: PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      };

      if (Platform.Version < 33) {
        // For Android versions below 13, include READ_EXTERNAL_STORAGE
        permissions.STORAGE = PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;
      } else {
        // For Android 13 and above, include media-specific permissions
        permissions.MEDIA_IMAGES = PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES;
        permissions.MEDIA_VIDEO = PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO;
        permissions.MEDIA_AUDIO = PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO;
      }

      // Request all permissions simultaneously
      const grantedPermissions = await PermissionsAndroid.requestMultiple(Object.values(permissions));

      // Check if all permissions were granted
      const hasAllPermissions = Object.keys(permissions).every(
        key => grantedPermissions[permissions[key]] === PermissionsAndroid.RESULTS.GRANTED
      );

      setHasPermission(hasAllPermissions);

      if (!hasAllPermissions) {
        Alert.alert(
          'Permissions Required',
          'Please enable all required permissions (camera, audio, and storage) in your device settings to use this feature.',
          [{ text: 'OK' }]
        );
      }
    } catch (err) {
      console.error('Permission request error:', err);
      setError('Failed to request permissions');
      setHasPermission(false);
    }
  };

  // Function to handle gallery image selection
  const pickImage = async () => {
    try {
      const image = await ImagePicker.openPicker({
        mediaType: 'photo',
        compressImageMaxWidth: 2000,
        compressImageMaxHeight: 2000,
        compressImageQuality: 0.8,
      });

      if (image) {
        setTempImageUri(image.path);
      setIsCropping(true);
        // processImage(image.path);
      }
    } catch (error) {
      if (error.message !== 'User cancelled image selection') {
        console.error('Image picker error:', error);
        Alert.alert('Error', 'Failed to pick image from gallery');
      }
    }
  };

  const isJapaneseText = (text) => {
    const japaneseRegex = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/gu;
    return japaneseRegex.test(text);
  };

  const convertToRomaji = (text) => {
    if (isJapaneseOnly) {
      console.log('text', text);
      if (isJapaneseText(text)) {
        return wanakana.toRomaji(text);
      }
      return 'No Japanese text detected';
    }
  };

  const splitTextIntoWords = (text) => {
    return text.split(/[\s、。]+/).filter(word => word.length > 0);
  };

// Function to speak the Japanese word
const handleSpeak = (text) => {
  Tts.setDefaultLanguage('ja-JP'); // Set Japanese language
  Tts.speak(text);
};



  const processImage = async (imageUri) => {
    setIsLoading(true);
    setError(null);
    setInitialContentReady(false);

    try {
      const result = await TextRecognition.recognize(
        imageUri,
        isJapaneseOnly ? TextRecognitionScript.JAPANESE : TextRecognitionScript.LATIN
      );
      // console.log('resul:t',result);

      // const recognizedText = result.blocks
      //   .map(block => block.text)
      //   .filter(text => isJapaneseOnly ? isJapaneseText(text) : true)
      //   .join("\n");
      const recognizedText = result.blocks
        .map(block => block.text)
        .filter(text => isJapaneseOnly ? isJapaneseText(text) : true)
        .join(" ")
        .replace(/\s+/g, " "); // Ensures no extra spaces or newlines



      if (!recognizedText) {
        throw new Error(isJapaneseOnly ? 'No Japanese text detected' : 'No text detected');
      }

      // Process the recognized text as before...
      setRecognizedText(recognizedText);
      const initialRomaji = isJapaneseOnly ? convertToRomaji(recognizedText) : recognizedText;
      setRomajiText(initialRomaji);



      const words = splitTextIntoWords(recognizedText);

      const romajiWords = words.map(word => convertToRomaji(word));

      setWordsAndRomaji(
        words.map((word, index) => ({
          japanese: word,
          romaji: romajiWords[index],
          english: 'Waiting for translation...',
          key: `${index}-${word}`,
        }))
      );

      setIsModalVisible(true);
      setInitialContentReady(true);
      setHasPreviousResults(true);

      // Start non-blocking translation process
      if ((Platform.OS === 'android') && isJapaneseOnly) {
        setIsProcessingTranslation(true);

        // Start full text translation
        translateJapaneseToEnglish(recognizedText)
          .then(fullTranslation => {
            if (isMounted.current) {
              setEnglishText(fullTranslation);
            }
          })
          .catch(error => {
            console.error('Full text translation error:', error);
            if (isMounted.current) {
              setEnglishText('Translation failed. Please try again.');
            }
          });

        // Start word-by-word translation in chunks
        translateInChunks(words)
          .catch(error => {
            console.error('Word translation error:', error);
            Alert.alert(
              'Translation Warning',
              'Some words could not be translated. Please try again or use the search buttons for individual words.'
            );
          })
          .finally(() => {
            if (isMounted.current) {
              setIsProcessingTranslation(false);
            }
          });
      } else {
        setIsProcessingTranslation(false);
      }
    } catch (error) {
      setError(error.message || 'Failed to process image');
      Alert.alert('Error', error.message || 'Failed to process image');
    } finally {
      setIsLoading(false);
    }
  };

  const onSaveImage = async() => {
    if (!tempImageUri || isSaved) {
      // Toast.show({
      //   type: 'error',
      //   text1: 'Error',
      //   text2: 'No image captured yet.',
      //   visibilityTime: 3000,
      // });
      return;
    }

    try {
      const newPath = `${RNFS.PicturesDirectoryPath}/${Date.now()}.jpg`;
      const fileExists = await RNFS.exists(tempImageUri);

      if (!fileExists) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'The image file does not exist.',
          visibilityTime: 3000,
        });
        return;
      }

      await RNFS.copyFile(tempImageUri, newPath);
            // Update the button state
            setIsSaved(true);

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Image saved successfully!',
        visibilityTime: 3000,
      });
    } catch (error) {
      console.error('Error saving image:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to save the image.',
        visibilityTime: 3000,
      });
    }
  };

  const toastConfig = {
    success: (props) => (
      <View style={[styles.toastContainer, styles.successToast]}>
        <Text style={styles.toastText1}>{props.text1}</Text>
        <Text style={styles.toastText2}>{props.text2}</Text>
      </View>
    ),
    error: (props) => (
      <View style={[styles.toastContainer, styles.errorToast]}>
        <Text style={styles.toastText1}>{props.text1}</Text>
        <Text style={styles.toastText2}>{props.text2}</Text>
      </View>
    ),
  };

  const takePictureAndRecognizeText = async () => {
    if (!camera.current) return;

    try {
      const data = await camera.current.takePictureAsync({
        quality: 1,
        base64: true,
      });

      setTempImageUri(data.uri);
      setIsSaved(false);
      console.log('data.uri::::',data.uri);
      setIsCropping(true);

      // await processImage(data.uri);
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('Error', 'Failed to take picture');
    }
  };

  const handleCropComplete = async (croppedImage) => {
    setIsCropping(false);
    await processImage(croppedImage.path);
    // setTempImageUri(croppedImage.path);  // For showing and saving Cropped Image
    // await processImage(croppedImage.uri || croppedImage);
  };
  
  const handleCropCancel = () => {
    setIsCropping(false);
    setTempImageUri(null);
  };

  // Add translation status indicator component
  const TranslationStatus = () => {
    if (!isProcessingTranslation) return null;

    return (
      <View style={styles.translationStatus}>
        <ActivityIndicator size="small" color="#007AFF" />
        <Text style={styles.translationStatusText}>
          Translating in background...
        </Text>
      </View>
    );
  };

  if (hasPermission === null) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Initializing camera...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Camera access denied</Text>
        <TouchableOpacity style={styles.retryButton} onPress={requestPermissions}>
          <Text style={styles.retryButtonText}>Request Permissions</Text>
        </TouchableOpacity>
      </View>
    );
  }



  const renderModalContent = () => {
    if (!isJapaneseOnly) {
      // Render only one box when isJapaneseOnly is false
      return (
        <ScrollView
          ref={scrollViewRef}
          style={styles.translationsContainer}
          showsVerticalScrollIndicator={true}
          contentContainerStyle={styles.translationsContent}
          scrollEventThrottle={16}
          decelerationRate="normal"
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          windowSize={5}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.translationsContainer}>
            <View style={styles.translationSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Result</Text>



                <TouchableOpacity
                  style={styles.sectionSearchButton}
                  onPress={() =>
                    handleSearch(`can you solve this ${recognizedText}`)
                  }
                >
                  <Text style={styles.searchButtonText}>Solve with ChatGPT</Text>
                </TouchableOpacity>
              </View>
              <Text selectable style={styles.translationText}>{recognizedText}</Text>
            </View>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setIsModalVisible(false)}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      );
    }

    // Render full content when isJapaneseOnly is true
    return (
      <ScrollView
        ref={scrollViewRef}
        style={styles.translationsContainer}
        showsVerticalScrollIndicator={true}
        contentContainerStyle={styles.translationsContent}
        scrollEventThrottle={16}
        decelerationRate="fast"
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        windowSize={5}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.translationSection}>


          <View style={styles.sectionHeader}>
        
            <Text style={styles.sectionTitle}>Japanese Text</Text>
            <TouchableOpacity
              style={styles.sectionSearchButton}
              onPress={() =>
                handleSearch(`${recognizedText} meaning in Japanese`)
              }
            >
              <Text style={styles.searchButtonText}>Search</Text>
            </TouchableOpacity>
          </View>
          <Text selectable style={styles.translationText}>{recognizedText}</Text>
        </View>

        <View style={styles.translationSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Romaji</Text>
            <TouchableOpacity
              style={styles.sectionSearchButton}
              onPress={() =>
                handleSearch(`${romajiText} meaning in Japanese`)
              }
            >
              <Text style={styles.searchButtonText}>Search</Text>
            </TouchableOpacity>
          </View>
          <Text selectable style={styles.translationText}>{romajiText}</Text>
        </View>

        {Platform.OS !== 'ios' && (
          <View style={styles.translationSection}>
            <Text style={styles.sectionTitle}>
              English {isTranslating && '(Translating...)'}
            </Text>
            <Text selectable style={styles.translationText}>
              {englishText || 'Translation in progress...'}
            </Text>
          </View>
        )}

        <View style={styles.wordCardsContainer}>
          {wordsAndRomaji.map((pair, index) => (
            <View style={styles.space} key={index}>
              <View style={styles.wordCard}>
                {/* Speaker Icon */}
            <TouchableOpacity onPress={() => handleSpeak(pair.japanese)} style={styles.speakerIcon}>
              {/* <Ionicons name="volume-high" size={24} color="black" /> */}
              <Iconss name="volume-2" size={24} color="black" />
            </TouchableOpacity>
                <Text selectable style={styles.japaneseWord}>
                  {pair.japanese}
                </Text>
                <Text selectable style={styles.romajiWord}>{pair.romaji}</Text>

                {Platform.OS !== 'ios' && (
                  <Text selectable style={styles.englishWord}>
                    {pair.english}
                  </Text>
                )}

                <View style={styles.searchButtonsContainer}>
                  <TouchableOpacity
                    style={styles.searchButton}
                    onPress={() =>
                      handleSearch(`${pair.japanese} meaning in Japanese`)
                    }
                  >
                    <Text style={styles.searchButtonText}>JP</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.searchButton}
                    onPress={() =>
                      handleSearch(`${pair.romaji} meaning in Japanese`)
                    }
                  >
                    <Text style={styles.searchButtonText}>ROM</Text>
                  </TouchableOpacity>

                  {Platform.OS !== 'ios' && (
                    <TouchableOpacity
                      style={styles.searchButton}
                      onPress={() => handleSearch(`${pair.english} meaning`)}
                    >
                      <Text style={styles.searchButtonText}>ENG</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => setIsModalVisible(false)}
        >
          <Text style={styles.closeButtonText}>Close</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  };



  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity 
      style={styles.settingsButton}
      onPress={() => setIsSettingsVisible(true)}
    >
      <Icon name="settings-outline" size={24} color="#FFF" />
    </TouchableOpacity>

      <RNCamera
        ref={camera}
        style={styles.preview}
        type={RNCamera.Constants.Type.back}
        // resizeMode="cover"  
         ratio="16:9"
        onCameraReady={() => setIsCameraReady(true)}
        androidCameraPermissionOptions={{
          title: 'Permission to use camera',
          message: 'We need your permission to use your camera',
          buttonPositive: 'Ok',
          buttonNegative: 'Cancel',
        }}
      />

      {isCameraReady && (
        <View style={styles.buttonsContainer}>

          <TouchableOpacity
            style={[
              styles.toggleButton,
              { backgroundColor: isJapaneseOnly ? '#34C759' : '#CCCCCC' }
            ]}
            onPress={toggleSwitch}
          >
            <Animated.View
              style={[
                styles.slider,
                { transform: [{ translateX }] }
              ]}
            />
            <Text style={[
              styles.toggleButtonText,
              isJapaneseOnly ? styles.textLeft : styles.textRight
            ]}>
              {isJapaneseOnly ? 'JP' : 'ENG'}
            </Text>
          </TouchableOpacity>


          {/* Camera Capture Button */}
          <View style={styles.cameraButtonContainer}>
            <View style={styles.captureOuterBorder}>
              <TouchableOpacity
                onPress={takePictureAndRecognizeText}
                style={styles.capture}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFF" size="large" />
                ) : (
                  <Icon name="camera" size={30} color="#FFF" />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Gallery Picker Button */}
          <TouchableOpacity
            style={styles.galleryButton}
            onPress={pickImage}
            disabled={isLoading}
          >
            <Icon name="images" size={24} color="#FFF" />
          </TouchableOpacity>

          {/* Previous Results Button */}
          {hasPreviousResults && (
            <View style={styles.previousButtonContainer}>
              <TouchableOpacity
                onPress={showPreviousResults}
                style={styles.previousButton}
                disabled={isLoading}
              >
                <Icon name="arrow-back" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>
          )}
        </View>


      )}

      <Modal
        visible={isModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsModalVisible(false)}
      >
        {/* <TouchableWithoutFeedback onPress={() => setIsModalVisible(false)}> */}
          <View style={styles.modalBackground}>

            {/* <TouchableWithoutFeedback onPress={e => e.stopPropagation()}> */}
              <View style={styles.modalWrapper}>
              <Toast
        config={toastConfig}
        position="top" // Change position to 'bottom'
        // topOffset={160} // Adjust offset from the top (if position is 'top')
        // bottomOffset={20} 
/>

                <Text style={styles.modalHeader}>Translation Results</Text>
                <TranslationStatus />
                <ScrollView>


                <View style={styles.imageContainer}>
          <Image source={{ uri: tempImageUri }} style={styles.resultImage} />
          <TouchableOpacity 
            style={styles.saveButton}
            disabled={isSaved}
            onPress={() => onSaveImage()}
          >
            {isSaved ? (
              <Icons name="check-circle" size={24} color="#FFF" />
            ) : (
              <Icon name="save-outline" size={24} color="#FFF" />
            )}
          </TouchableOpacity>
        </View>
                {initialContentReady && renderModalContent()}
                </ScrollView>

              </View>
            {/* </TouchableWithoutFeedback> */}
          </View>
        {/* </TouchableWithoutFeedback> */}
      </Modal>

      <Modal
        visible={isWebViewModalVisible}
        transparent={false}
        animationType="slide"
        onRequestClose={() => setIsWebViewModalVisible(false)}
      >
        <SafeAreaView style={styles.webViewContainer}>
          <View style={styles.webViewHeader}>
            <TouchableOpacity
              style={styles.webViewCloseButton}
              onPress={() => setIsWebViewModalVisible(false)}
            >
              <Text style={styles.webViewCloseButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
          <WebView
            source={{ uri: searchUrl }}
            style={styles.webView}
            startInLoadingState={true}
            renderLoading={() => (
              <ActivityIndicator
                style={styles.webViewLoading}
                size="large"
                color="#007AFF"
              />
            )}
          />
        </SafeAreaView>
      </Modal>

      {isCropping && (
      <ImageCropper
        imageUri={tempImageUri}
        onCropComplete={handleCropComplete}
        onCancel={handleCropCancel}
      />
    )}

    <Settings
      isVisible={isSettingsVisible}
      onClose={() => setIsSettingsVisible(false)}
    />
               
    </SafeAreaView>
  );
};

export const styles = StyleSheet.create({
  speakerIcon: {
    position: 'absolute',
    top: 5,
    right: 5,
    zIndex: 10, // Ensures it's above other elements
  },
  toastContainer: {
    padding: 15,
    borderRadius: 10,
    marginHorizontal: 20,
    zIndex: 9999, // Ensure toast is always on top
    position: 'absolute', // Use absolute positioning
    alignSelf: 'center', // Center the toast horizontally
    top: -115, // Position the toast 20 units from the bottom
  },
  successToast: {
    backgroundColor: 'green',
  },
  errorToast: {
    backgroundColor: 'red',
  },
  toastText1: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  toastText2: {
    color: 'white',
    fontSize: 14,
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
  settingsButton: {
    position: 'absolute',
    top: 40,
    left: 20,
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    padding: 8,
  },
  textLeft: {
    left: 10, // Move text to the left when "ON"
  },
  textRight: {
    right: 6, // Move text to the right when "OFF"
  },
  toggleButton: {
    top: -660,
    right: -245,
    width: 60,
    height: 30,
    borderRadius: 30,
    padding: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
  },
  slider: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#34C759',
    backgroundColor: '#FFF',
    position: 'absolute',
    top: 2,
    left: 2,
  },
  toggleButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 12,
    position: 'absolute',
    // right: 10,
    // marginLeft: 8,
  },

  buttonsContainer: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  centerButtonContainer: {
    flex: 1,
    alignItems: 'center',
  },
  languageToggle: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toggleText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  galleryButton: {
    backgroundColor: '#34C759',
    padding: 12,
    borderRadius: 25,
  },
  // previousButton: {
  //   position: 'absolute',
  //   left: 20,
  //   top: 20,
  //   backgroundColor: '#007AFF',
  //   borderRadius: 25,
  //   padding: 12,
  //   flexDirection: 'row',
  //   alignItems: 'center',
  //   zIndex: 10,
  //   shadowColor: '#000',
  //   shadowOffset: { width: 0, height: 2 },
  //   shadowOpacity: 0.25,
  //   shadowRadius: 4,
  //   elevation: 5,
  // },
  translationStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    marginBottom: 10,
  },
  translationStatusText: {
    marginLeft: 8,
    color: '#666',
    fontSize: 14,
  },
  space: {
    flex: 1,
    justifyContent: 'space-evenly'
  },
  container: {
    flex: 1,
    // backgroundColor: '#e6d2fd',
    // backgroundColor: '#07e2ff',
    backgroundColor: 'grey',
    // backgroundColor: '#d2f8fd',
  },
  previousButtonContainer: {
    position: 'absolute',
    left: 20,
    // bottom: 10,
    zIndex: 1,
  },
  cameraButtonContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    zIndex: 0,
  },

  // New style for outer border container
  captureOuterBorder: {
    width: 80,
    height: 80,
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.4)', // More transparent white for outer border
    backgroundColor: 'transparent',
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#007AFF',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#FF3B30',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  preview: {
    flex: 1,
    marginVertical: 10,
    marginHorizontal: 10,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  captureContainer: {
    position: 'absolute',
    bottom: 30,
    alignSelf: 'center',
  },
  modalBackground: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalWrapper: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: height,
    padding: 20,
  },
  modalHeader: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    textAlign: 'center',
    marginBottom: 20,
  },
  wordCardsContainer: {
    marginBottom: 10,
  },
  wordCardsScroll: {
    paddingHorizontal: 10,
  },
  wordCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 15,
    marginRight: 15,
    marginVertical: 10,
    maxWidth: 250, // Set a reasonable max width
    alignSelf: 'flex-start', // Allow card size to adjust based on content
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    opacity: 1,
    // borderWidth:0.1,
    // borderColor:'#000',
    // marginLeft:5,
  },
  japaneseWord: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8,
    textAlign: 'center',
    flexWrap: 'wrap', // Wrap text within the container
  },
  romajiWord: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
    textAlign: 'center',
    flexWrap: 'wrap', // Ensure no overflow
  },
  englishWord: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
    marginBottom: 4,
    flexWrap: 'wrap', // Handle longer English words
  },

  translationsContainer: {
    flex: 1,
    marginBottom: 20,
  },
  translationsContent: {
    paddingBottom: 20,
  },
  translationSection: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    opacity: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionSearchButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  searchButtonText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 10,
  },
  translationText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
    opacity: 1,
  },
  closeButton: {
    backgroundColor: '#FF3B30',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },

  wordCardsScroll: {
    paddingHorizontal: 10,
  },
  // buttonsContainer: {
  //   position: 'absolute',
  //   bottom: 30,
  //   flexDirection: 'row',
  //   alignItems: 'center',
  //   justifyContent: 'center',
  //   width: '100%',
  //   paddingHorizontal: 20,
  //   gap: 20,
  // },
  capture: {
    backgroundColor: '#007AFF',
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    borderWidth: 2,
    borderColor: 'white',
  },
  previousButton: {
    // borderWidth: 1,
    // borderColor: 'white',

    backgroundColor: '#34C759',
    borderRadius: 25,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  searchButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingHorizontal: 5,
  },
  searchButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginHorizontal: 2,
  },
  searchButtonText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  webViewContainer: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  webViewHeader: {
    height: 50,
    backgroundColor: '#F8F9FA',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  webViewCloseButton: {
    backgroundColor: '#FF3B30',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 8,
  },
  webViewCloseButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  webView: {
    flex: 1,
  },
  webViewLoading: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -25 }, { translateY: -25 }],
  },
});

export default RomajiTranslator;
