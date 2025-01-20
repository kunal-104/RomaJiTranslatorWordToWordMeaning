
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
  Platform
} from 'react-native';
import WebView from 'react-native-webview';
import { NativeModules } from 'react-native';
import { RNCamera } from 'react-native-camera';
import TextRecognition, { TextRecognitionScript } from "@react-native-ml-kit/text-recognition";
import wanakana from 'wanakana';
import Icon from 'react-native-vector-icons/Ionicons';



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

  const scrollViewRef = useRef(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [initialContentReady, setInitialContentReady] = useState(false);

  const [isProcessingTranslation, setIsProcessingTranslation] = useState(false);
  const translationQueue = useRef([]);
  const isMounted = useRef(true);


  
  const handleSearch = (searchQuery) => {

    // Clean up the text by replacing newlines with spaces and removing extra spaces
  const cleanedQuery = searchQuery
  .replace(/\n/g, ' ')  // Replace all newlines with spaces
  .replace(/\s+/g, ' ') // Replace multiple spaces with single space
  .trim();             // Remove leading/trailing spaces

    const encodedQuery = encodeURIComponent(cleanedQuery);
    const url = `https://www.google.com/search?q=${encodedQuery}`;
    setSearchUrl(url);
    setIsWebViewModalVisible(true);
  };

  const showPreviousResults = () => {
    if (recognizedText) {
      setIsModalVisible(true);
    }
  };

  const flatListRef = useRef(null);
  const verticalScrollRef = useRef(null);

  const WordCard = useCallback(({ item }) => (
    <View style={styles.wordCard}>
      <Text style={styles.japaneseWord}>{item.japanese}</Text>
      <Text style={styles.romajiWord}>{item.romaji}</Text>
      <Text style={styles.englishWord}>{item.english}</Text>
    </View>
  ), []);

  const renderWordCard = useCallback(({ item }) => (
    <WordCard item={item} />
  ), []);

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
      const [cameraPermission, audioPermission] = await Promise.all([
        PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: 'Camera Permission',
            message: 'We need your permission to access the camera.',
            buttonPositive: 'OK',
            buttonNegative: 'Cancel',
          }
        ),
        PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'Audio Permission',
            message: 'We need your permission to record audio.',
            buttonPositive: 'OK',
            buttonNegative: 'Cancel',
          }
        )
      ]);

      const hasAllPermissions =
        cameraPermission === PermissionsAndroid.RESULTS.GRANTED &&
        audioPermission === PermissionsAndroid.RESULTS.GRANTED;

      setHasPermission(hasAllPermissions);

      if (!hasAllPermissions) {
        Alert.alert(
          'Permissions Required',
          'Please enable camera and audio permissions in your device settings to use this feature.',
          [{ text: 'OK' }]
        );
      }
    } catch (err) {
      console.error('Permission request error:', err);
      setError('Failed to request permissions');
      setHasPermission(false);
    }
  };

  const isJapaneseText = (text) => {
    const japaneseRegex = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/gu;
    return japaneseRegex.test(text);
  };

  const convertToRomaji = (text) => {
    console.log('text', text);
    if (isJapaneseText(text)) {
      return wanakana.toRomaji(text);
    }
    return 'No Japanese text detected';
  };

  const splitTextIntoWords = (text) => {
    return text.split(/[\s、。]+/).filter(word => word.length > 0);
  };  

  

  const generateWordsAndRomaji = async (text) => {
    try {
      setIsLoading(true);
      const words = splitTextIntoWords(text);

      if (Platform.OS === 'android') {
        // Android-specific implementation with Chaquopy
        const romajiWords = words.map(word => convertToRomaji(word));

        // Translate full text
        const fullTranslation = await translateJapaneseToEnglish(text);
        setEnglishText(fullTranslation);

        // Translate individual words with chunking if needed
        const englishWords = await Promise.all(
          words.map(async (word) => {
            try {
              if (!word.trim()) return '';
              return await translateJapaneseToEnglish(word);
            } catch (error) {
              console.error(`Error translating word: ${word}`, error);
              return 'Translation error';
            }
          })
        );

        setWordsAndRomaji(
          words.map((word, index) => ({
            japanese: word,
            romaji: romajiWords[index],
            english: englishWords[index],
            key: `${index}-${word}`,
          }))
        );
      } else {
        // iOS implementation
        // Setting basic word splitting without translation
        setWordsAndRomaji(
          words.map((word, index) => ({
            japanese: word,
            romaji: romajiWords[index], // Placeholder for romaji
            english: 'Translation not available on iOS', // Placeholder for English
            key: `${index}-${word}`,
          }))
        );

        setEnglishText('Translation feature is only available on Android devices');
      }
    } catch (error) {
      console.error('Error generating translations:', error);
      Alert.alert(
        'Translation Error',
        Platform.OS === 'android'
          ? 'Failed to translate some parts of the text. Please try again with a shorter text.'
          : 'Text processing error occurred. Note that full translation features are only available on Android.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const takePictureAndRecognizeText = async () => {
    if (!camera.current) return;

    setIsLoading(true);
    setError(null);
    setInitialContentReady(false);

    try {
      const data = await camera.current.takePictureAsync({
        quality: 0.8,
        base64: true,
      });

      const result = await TextRecognition.recognize(
        data.uri,
        TextRecognitionScript.JAPANESE
      );

      const recognizedText = result.blocks
        .map(block => block.text)
        .filter(text => isJapaneseText(text))
        .join("\n");

      if (!recognizedText) {
        throw new Error('No Japanese text detected');
      }

      // Set initial content immediately
      setRecognizedText(recognizedText);
      const initialRomaji = convertToRomaji(recognizedText);
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
      if (Platform.OS === 'android') {
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
      }
    } catch (error) {
      setError(error.message || 'Failed to process image');
      Alert.alert('Error', error.message || 'Failed to process image');
    } finally {
      setIsLoading(false);
    }
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



  const renderModalContent = () => (
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
      <View style={styles.translationSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Japanese Text</Text>
          <TouchableOpacity
            style={styles.sectionSearchButton}
            onPress={() => handleSearch(`${recognizedText} meaning in Japanese`)}
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
            onPress={() => handleSearch(`${romajiText} meaning in Japanese`)}
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
              <Text selectable style={styles.japaneseWord}>{pair.japanese}</Text>
              <Text selectable style={styles.romajiWord}>{pair.romaji}</Text>
              
              {Platform.OS !== 'ios' && (
                <Text selectable style={styles.englishWord}>
                  {pair.english}
                </Text>
              )}

              <View style={styles.searchButtonsContainer}>
                <TouchableOpacity
                  style={styles.searchButton}
                  onPress={() => handleSearch(`${pair.japanese} meaning in Japanese`)}
                >
                  <Text style={styles.searchButtonText}>JP</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.searchButton}
                  onPress={() => handleSearch(`${pair.romaji} meaning in Japanese`)}
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


  return (
    <SafeAreaView style={styles.container}>
      <RNCamera
        ref={camera}
        style={styles.preview}
        type={RNCamera.Constants.Type.back}
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
        <TouchableWithoutFeedback onPress={() => setIsModalVisible(false)}>
          <View style={styles.modalBackground}>
            <TouchableWithoutFeedback onPress={e => e.stopPropagation()}>
              <View style={styles.modalWrapper}>
                <Text style={styles.modalHeader}>Translation Results</Text>
                <TranslationStatus />
                {initialContentReady && renderModalContent()}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
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
    bottom: 10,
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
    height: height * 0.8,
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
  buttonsContainer: {
    position: 'absolute',
    bottom: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: 20,
    gap: 20,
  },
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
    backgroundColor: '#34C759',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    borderWidth: 1,
    borderColor: 'white',
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