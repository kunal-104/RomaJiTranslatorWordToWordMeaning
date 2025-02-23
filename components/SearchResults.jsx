// components/SearchResults.js
const SearchResults = ({ results, onSaveImage }) => {
    const renderImageWithSaveButton = (imageUri) => {
      return (
        <View style={styles.imageContainer}>
          <Image source={{ uri: imageUri }} style={styles.resultImage} />
          <TouchableOpacity 
            style={styles.saveButton}
            onPress={() => onSaveImage(imageUri)}
          >
            <Icon name="save-outline" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>
      );
    };
  
    return (
      <View style={styles.resultsContainer}>
        {results.images && results.images.map((image, index) => (
          renderImageWithSaveButton(image.uri)
        ))}
        {/* Rest of your existing search results */}
      </View>
    );
  };

  export default SearchResults;
  
  const styles = StyleSheet.create({
    // ... existing styles ...
    
    settingsContainer: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    settingsContent: {
      width: '80%',
      backgroundColor: '#FFF',
      borderRadius: 20,
      padding: 20,
    },
    settingsTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      marginBottom: 20,
      textAlign: 'center',
    },
    settingItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 15,
    },
    settingLabel: {
      fontSize: 16,
    },
    clearCacheButton: {
      backgroundColor: '#007AFF',
      padding: 15,
      borderRadius: 10,
      marginTop: 20,
    },
    clearCacheText: {
      color: '#FFF',
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
  });

