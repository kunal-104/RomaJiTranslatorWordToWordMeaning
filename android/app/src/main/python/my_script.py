from translate import Translator

def translate_text(text):
    try:
        translator = Translator(to_lang="en", from_lang="ja")
        translation = translator.translate(text)
        return translation
    except Exception as e:
        return str(e)

