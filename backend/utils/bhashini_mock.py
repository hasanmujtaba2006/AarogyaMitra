import logging
import httpx
from config import settings

logger = logging.getLogger("bhashini")

# A mapping of common medical phrases for high-fidelity mock translation
MOCK_TRANSLATION_MAP = {
    # Hindi to English
    "छाती में दर्द हो रहा है": "I am having chest pain",
    "मुझे दो दिनों से बुखार है": "I have a fever for two days",
    "पेट में बहुत तेज दर्द है": "There is a very sharp pain in my stomach",
    "सिर घूम रहा है और कमजोरी महसूस हो रही है": "My head is spinning and I feel weak",
    "नमस्ते": "Hello",
    "हाँ": "Yes",
    "नहीं": "No",
    "बहुत दर्द है": "It hurts a lot",
    "मुझे बहुत तेज बुखार है": "I have a very high fever",
    "बहुत तेज, मैं एक से 10 में से नौ नंबर देना चाहूंगा": "Very severe, I would rate it 9 out of 10",

    # Tamil to English
    "நெஞ்சு வலி இருக்கிறது": "I have chest pain",
    "எனக்கு இரண்டு நாட்களாக காய்ச்சல் உள்ளது": "I have had a fever for two days",
    "தலைச்சுற்றல் மற்றும் சோர்வாக உள்ளது": "I feel dizzy and weak",
    "வணக்கம்": "Hello",
    "ஆம்": "Yes",
    "இல்லை": "No",
    "வலி அதிகமாக உள்ளது": "The pain is high",

    # Telugu to English
    "గుండె నొప్పిగా ఉంది": "I am having chest pain",
    "రెండు రోజుల నుండి జ్వరం ఉంది": "I have had a fever for two days",
    "కళ్ళు తిరుగుతున్నాయి మరియు బలహీనంగా ఉంది": "I feel dizzy and weak",
    "నమస్కారం": "Hello",
    "అవును": "Yes",
    "లేదు": "No",
    "నొప్పి చాలా ఎక్కువగా ఉంది": "The pain is very severe",
    
    # English to Regional (Mock responses for chatbot questions)
    "Welcome. Please describe your main symptoms in detail. When did they start?": {
        "hi": "स्वागत है। कृपया अपने मुख्य लक्षणों के बारे में विस्तार से बताएं। वे कब शुरू हुए थे?",
        "ta": "வரவேற்கிறோம். தயவுசெய்து உங்கள் முக்கிய அறிகுறிகளை விரிவாக விவரிக்கவும். அவை எப்போது தொடங்கின?",
        "te": "స్వాగతం. దయచేసి మీ ప్రధాన లక్షణాలను వివరంగా తెలియజేయండి. అవి ఎప్పుడు ప్రారంభమయ్యాయి?"
    },
    "Where is the pain or discomfort located, and does it spread to any other part of your body?": {
        "hi": "दर्द या बेचैनी कहाँ पर है, और क्या यह आपके शरीर के किसी अन्य हिस्से में भी फैलती है?",
        "ta": "வலி அல்லது அசௌகரியம் எங்குள்ளது, அது உங்கள் உடலின் வேறு ஏதேனும் பகுதிக்கு பரவுகிறதா?",
        "te": "నొప్పి లేదా అసౌకర్యం ఎక్కడ ఉంది మరియు అది మీ శరీరంలోని ఇతర భాగాలకు వ్యాపిస్తుందా?"
    },
    "How would you rate the pain from 1 to 10 (with 10 being severe)? What does the pain feel like (sharp, squeezing, burning)?": {
        "hi": "आप दर्द को 1 से 10 के बीच क्या रेटिंग देंगे (जिसमें 10 सबसे गंभीर है)? दर्द कैसा महसूस होता है (तेज, दबाने वाला, या जलन जैसा)?",
        "ta": "வலியை 1 முதல் 10 வரை எவ்வாறு மதிப்பிடுவீர்கள் (10 என்பது கடுமையானது)? வலி எப்படி உணர்கிறது (கூர்மையானது, பிழிவது போன்றது, அல்லது எரிச்சல்)?",
        "te": "నొప్పిని 1 నుండి 10 వరకు ఎలా రేట్ చేస్తారు (10 తీవ్రమైనది)? నొప్పి ఎలా అనిపిస్తుంది (కూర్చోవడం, పిండడం, మంటగా ఉండడం)?"
    },
    "How is your digestion and appetite? Do you feel sensitive to hot or cold weather?": {
        "hi": "आपकी पाचन क्रिया और भूख कैसी है? क्या आप गर्म या ठंडे मौसम के प्रति संवेदनशील महसूस करते हैं?",
        "ta": "உங்கள் செரிமானம் மற்றும் பசி எப்படி இருக்கிறது? வெப்பமான அல்லது குளிர்ந்த வானிலைக்கு நீங்கள் உணர்திறன் உடையவராக உணர்கிறீர்களா?",
        "te": "మీ జీర్ణక్రియ మరియు ఆకలి ఎలా ఉన్నాయి? మీరు వేడి లేదా చల్లని వాతావరణానికి సున్నితంగా ఉన్నట్లు అనిపిస్తుందా?"
    },
    "Have you felt physically weak or tired recently? Are you experiencing any other symptoms like fever or nausea?": {
        "hi": "क्या आपने हाल ही में शारीरिक रूप से कमजोरी या थकान महसूस की है? क्या आप बुखार या मतली जैसे किसी अन्य लक्षण का अनुभव कर रहे हैं?",
        "ta": "சமீபத்தில் நீங்கள் உடல் ரீதியாக பலவீனமாக அல்லது சோர்வாக உணர்ந்தீர்களா? காய்ச்சல் அல்லது குமட்டல் போன்ற வேறு ஏதேனும் அறிகுறிகளை நீங்கள் அனுபவிக்கிறீர்களா?",
        "te": "మీరు ఇటీవల శారీరకంగా బలహీనంగా లేదా అలసిపోయినట్లు అనిపించిందా? జ్వరం లేదా వికారం వంటి ఇతర లక్షణాలు ఏవైనా ఉన్నాయా?"
    },
    "Thank you, I have gathered all necessary information. I am completing the session now.": {
        "hi": "धन्यवाद, मैंने सभी आवश्यक जानकारी एकत्र कर ली है। मैं अब सत्र पूरा कर रहा हूँ।",
        "ta": "நன்றி, தேவையான அனைத்து தகவல்களையும் சேகரித்துவிட்டேன். நான் இப்போது அமர்வை நிறைவு செய்கிறேன்.",
        "te": "ధన్యవాదాలు, నేను అవసరమైన సమాచారాన్ని సేకరించాను. నేను ఇప్పుడు సెషన్‌ను ముగిస్తున్నాను."
    },
    "Thank you for the information. Do you feel any chest pain, breathing difficulty, or radiating discomfort?": {
        "hi": "जानकारी के लिए धन्यवाद। क्या आपको छाती में दर्द, सांस लेने में तकलीफ या बेचैनी महसूस हो रही है?",
        "ta": "தகவலுக்கு நன்றி. நெஞ்சு வலி, மூச்சு விடுவதில் சிரமம் அல்லது ஏதேனும் அசௌகரியம் இருக்கிறதா?",
        "te": "సమాచారానికి ధన్యవాదాలు. మీకు గుండెనొప్పి, శ్వాస తీసుకోవడంలో ఇబ్బంది లేదా ఏవైనా అసకోరాలు ఉన్నాయా?"
    },
    "Please tell me when the fever started and if you have body aches.": {
        "hi": "कृपया मुझे बताएं कि बुखार कब शुरू हुआ और क्या आपको शरीर में दर्द है।",
        "ta": "காய்ச்சல் எப்போது தொடங்கியது மற்றும் உடல் வலி இருக்கிறதா என்று சொல்லுங்கள்.",
        "te": "జ్వరం ఎప్పుడు ప్రారంభమైందో మరియు ఒంటి నొప్పులు ఉన్నాయో చెప్పండి."
    }
}

def is_english(text: str) -> bool:
    """Helper to detect if text contains only English/ASCII-like characters."""
    for char in text:
        cp = ord(char)
        # Check if the character is in the Devnagari, Tamil, or Telugu unicode block
        if (0x0900 <= cp <= 0x097F) or (0x0B80 <= cp <= 0x0BFF) or (0x0C00 <= cp <= 0x0C7F):
            return False
    return True

def clean_for_lookup(text: str) -> str:
    """Cleans punctuation, casing, and whitespace for high-fidelity dictionary matching."""
    if not text:
        return ""
    cleaned = text.strip()
    for char in ['.', '?', '!', ',', '।', '\'', '"', '`']:
        cleaned = cleaned.replace(char, '')
    return cleaned.strip().lower()

async def translate_text(text: str, source_lang: str, target_lang: str) -> str:
    """
    Translates text using Bhashini translation API.
    If no Bhashini credentials are set, falls back to the MOCK_TRANSLATION_MAP or returns a clean string.
    """
    if not text:
        return ""
    if source_lang == target_lang:
        return text

    # Check if credentials are set to run actual Bhashini API
    if settings.BHASHINI_API_KEY and settings.BHASHINI_USER_ID:
        try:
            url = "https://meity-auth.ulca.in/ulca/apis/v0/model/getModelsPipeline"
            headers = {
                "userID": settings.BHASHINI_USER_ID,
                "ulcaApiKey": settings.BHASHINI_API_KEY
            }
            pipeline_payload = {
                "pipelineTasks": [
                    {
                        "taskType": "translation",
                        "config": {
                            "language": {
                                "sourceLanguage": source_lang,
                                "targetLanguage": target_lang
                            }
                        }
                    }
                ],
                "pipelineRequestConfig": {
                    "pipelineId": settings.BHASHINI_PIPELINE_ID or "meity"
                }
            }
            async with httpx.AsyncClient() as client:
                resp = await client.post(url, json=pipeline_payload, headers=headers, timeout=5.0)
                if resp.status_code == 200:
                    config_data = resp.json()
                    compute_url = config_data["pipelineResponseConfig"][0]["config"][0]["serviceFeedbackUrl"]
                    compute_payload = {
                        "pipelineTasks": [
                            {
                                "taskType": "translation",
                                "config": {
                                    "language": {
                                        "sourceLanguage": source_lang,
                                        "targetLanguage": target_lang
                                    },
                                    "serviceId": config_data["pipelineResponseConfig"][0]["config"][0]["serviceId"]
                                }
                            }
                        ],
                        "inputData": {
                            "input": [
                                {
                                    "source": text
                                }
                            ]
                        }
                    }
                    headers["Authorization"] = config_data["pipelineResponseConfig"][0]["config"][0]["authorization"]
                    comp_resp = await client.post(compute_url, json=compute_payload, headers=headers, timeout=5.0)
                    if comp_resp.status_code == 200:
                        res_json = comp_resp.json()
                        translated_result = res_json["pipelineResponse"][0]["output"][0]["target"]
                        return translated_result
        except Exception as ex:
            logger.error(f"Bhashini API translation failed: {ex}. Falling back to mock translation.")

    # High fidelity mock translation lookup
    clean_txt = clean_for_lookup(text)

    # 1. Look up regional-to-English direct translation
    if source_lang != 'en':
        for key, val in MOCK_TRANSLATION_MAP.items():
            if clean_for_lookup(key) == clean_txt:
                if isinstance(val, str):
                    return val
                elif isinstance(val, dict) and 'en' in val:
                    return val['en']

    # 2. Look up English-to-regional translation
    if source_lang == 'en':
        for key, val in MOCK_TRANSLATION_MAP.items():
            if clean_for_lookup(key) == clean_txt:
                if isinstance(val, dict) and target_lang in val:
                    return val[target_lang]

    # 3. Simple fallback heuristics for user simulation (without adding raw development wrappers)
    if target_lang == 'en':
        if is_english(text):
            return text
        # Translate to english by extracting key concepts
        if "बुखार" in text or "காய்ச்சல்" in text or "జ్వరం" in text:
            if "तेज" in text or "அதிக" in text or "ఎక్కువ" in text:
                return "I have a high fever."
            return "I have a fever."
        if "दर्द" in text or "வலி" in text or "నొప్పి" in text:
            if "तेజ" in text or "அதிக" in text or "ఎక్కువ" in text:
                return "I have a severe pain."
            return "I am experiencing pain."
        return text
    
    else:
        # Fallback translations if not found in dictionary
        fallbacks = {
            "hi": {
                "Welcome. Please describe your main symptoms in detail. When did they start?": "स्वागत है। कृपया अपने मुख्य लक्षणों के बारे में विस्तार से बताएं। वे कब शुरू हुए थे?",
                "Where is the pain or discomfort located, and does it spread to any other part of your body?": "दर्द या बेचैनी कहाँ पर है, और क्या यह आपके शरीर के किसी अन्य हिस्से में भी फैलती है?",
                "How would you rate the pain from 1 to 10 (with 10 being severe)? What does the pain feel like (sharp, squeezing, burning)?": "आप दर्द को 1 से 10 के बीच क्या रेटिंग देंगे (जिसमें 10 सबसे गंभीर है)? दर्द कैसा महसूस होता है (तेज, दबाने वाला, या जलन जैसा)?",
                "How is your digestion and appetite? Do you feel sensitive to hot or cold weather?": "आपकी पाचन क्रिया और भूख कैसी है? क्या आप गर्म या ठंडे मौसम के प्रति संवेदनशील महसूस करते हैं?",
                "Have you felt physically weak or tired recently? Are you experiencing any other symptoms like fever or nausea?": "क्या आपने हाल ही में शारीरिक रूप से कमजोरी या थकान महसूस की है? क्या आप बुखार या मतली जैसे किसी अन्य लक्षण का अनुभव कर रहे हैं?",
                "Thank you, I have gathered all necessary information. I am completing the session now.": "धन्यवाद, मैंने सभी आवश्यक जानकारी एकत्र कर ली है। मैं अब सत्र पूरा कर रहा हूँ।"
            },
            "ta": {
                "Welcome. Please describe your main symptoms in detail. When did they start?": "வரவேற்கிறோம். தயவுசெய்து உங்கள் முக்கிய அறிகுறிகளை விரிவாக விவரிக்கவும். அவை எப்போது தொடங்கின?",
                "Where is the pain or discomfort located, and does it spread to any other part of your body?": "வலி அல்லது அசௌகரியம் எங்குள்ளது, அது உங்கள் உடலின் வேறு ஏதேனும் பகுதிக்கு பரவுகிறதா?",
                "How would you rate the pain from 1 to 10 (with 10 being severe)? What does the pain feel like (sharp, squeezing, burning)?": "வலியை 1 முதல் 10 வரை எவ்வாறு மதிப்பிடுவீர்கள் (10 என்பது கடுமையானது)? வலி எப்படி உணர்கிறது (கூர்மையானது, பிழிவது போன்றது, அல்லது எரிச்சல்)?",
                "How is your digestion and appetite? Do you feel sensitive to hot or cold weather?": "உங்கள் செரிமானம் மற்றும் பசி எப்படி இருக்கிறது? வெப்பமான அல்லது குளிர்ந்த வானிலைக்கு நீங்கள் உணர்திறன் உடையவராக உணர்கிறீர்களா?",
                "Have you felt physically weak or tired recently? Are you experiencing any other symptoms like fever or nausea?": "சமீபத்தில் நீங்கள் உடல் ரீதியாக பலவீனமாக அல்லது சோர்வாக உணர்ந்தீர்களா? காய்ச்சல் அல்லது குமட்டல் போன்ற வேறு ஏதேனும் அறிகுறிகளை நீங்கள் அனுபவிக்கிறீர்களா?",
                "Thank you, I have gathered all necessary information. I am completing the session now.": "நன்றி, தேவையான அனைத்து தகவல்களையும் சேகரித்துவிட்டேன். நான் இப்போது அமர்வை நிறைவு செய்கிறேன்।"
            },
            "te": {
                "Welcome. Please describe your main symptoms in detail. When did they start?": "స్వాగతం. దయచేసి మీ ప్రధాన లక్షణాలను వివరంగా తెలియజేయండి. అవి ఎప్పుడు ప్రారంభమయ్యాయి?",
                "Where is the pain or discomfort located, and does it spread to any other part of your body?": "నొప్పి లేదా అసౌకర్యం ఎక్కడ ఉంది మరియు అది మీ శరీరంలోని ఇతర భాగాలకు వ్యాపిస్తుందా?",
                "How would you rate the pain from 1 to 10 (with 10 being severe)? What does the pain feel like (sharp, squeezing, burning)?": "నొప్పిని 1 నుండి 10 వరకు ఎలా రేట్ చేస్తారు (10 తీవ్రమైనది)? నొప్పి ఎలా అనిపిస్తుంది (కూర్చోవడం, పిండడం, మంటగా ఉండడం)?",
                "How is your digestion and appetite? Do you feel sensitive to hot or cold weather?": "మీ జీర్ణక్రియ మరియు ఆకలి ఎలా ఉన్నాయి? మీరు వేడి లేదా చల్లని వాతావరణానికి సున్నితంగా ఉన్నట్లు అనిపిస్తుందా?",
                "Have you felt physically weak or tired recently? Are you experiencing any other symptoms like fever or nausea?": "మీరు ఇటీవల శారీరకంగా బలహీనంగా లేదా అలసిపోయినట్లు అనిపించిందా? జ్వరం లేదా వికారం వంటి ఇతర లక్షణాలు ఏవైనా ఉన్నాయా?",
                "Thank you, I have gathered all necessary information. I am completing the session now.": "ధన్యవాదాలు, నేను అవసరమైన సమాచారాన్ని సేకరించాను. నేను ఇప్పుడు సెషన్‌ను ముగిస్తున్నాను।"
            }
        }

        # Check if the English text matches one of our known prompts
        lang_fallbacks = fallbacks.get(target_lang, {})
        for prompt_en, translation_reg in lang_fallbacks.items():
            if clean_for_lookup(prompt_en) == clean_txt:
                return translation_reg

        return text
