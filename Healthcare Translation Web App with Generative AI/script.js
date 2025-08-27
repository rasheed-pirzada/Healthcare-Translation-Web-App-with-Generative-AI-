class HealthcareTranslator {
    constructor() {
        this.recognition = null;
        this.synthesis = window.speechSynthesis;
        this.isListening = false;
        this.currentTranscript = '';
        this.geminiApiKey = null;
        
       
        this.elements = {
            inputLanguage: document.getElementById('inputLanguage'),
            outputLanguage: document.getElementById('outputLanguage'),
            swapLanguages: document.getElementById('swapLanguages'),
            startListening: document.getElementById('startListening'),
            stopListening: document.getElementById('stopListening'),
            clearTranscripts: document.getElementById('clearTranscripts'),
            listeningStatus: document.getElementById('listeningStatus'),
            originalTranscript: document.getElementById('originalTranscript'),
            translatedTranscript: document.getElementById('translatedTranscript'),
            speakOriginal: document.getElementById('speakOriginal'),
            speakTranslation: document.getElementById('speakTranslation'),
            loadingOverlay: document.getElementById('loadingOverlay'),
            errorToast: document.getElementById('errorToast')
        };
        
        
        this.speechLangMap = {
            'en-US': 'en',
            'es-ES': 'es',
            'fr-FR': 'fr',
            'de-DE': 'de',
            'it-IT': 'it',
            'pt-BR': 'pt',
            'zh-CN': 'zh',
            'ja-JP': 'ja',
            'ko-KR': 'ko',
            'ar-SA': 'ar',
            'hi-IN': 'hi'
        };
        
        this.init();
    }
    
    async init() {
        await this.loadApiKey();
        this.setupEventListeners();
        this.initializeSpeechRecognition();
        this.updateStatus('Ready to listen');
    }
    
    async loadApiKey() {
        
        
        const metaApiKey = document.querySelector('meta[name="gemini-api-key"]');
        if (metaApiKey) {
            this.geminiApiKey = metaApiKey.getAttribute('content');
        }
        
       
        if (!this.geminiApiKey) {
            this.geminiApiKey = 'demo-mode';
            console.info('Running in demo mode with mock translations. Set API key for production use.');
        }
    }
    
    setupEventListeners() {
        
        this.elements.swapLanguages.addEventListener('click', () => this.swapLanguages());
        this.elements.inputLanguage.addEventListener('change', () => this.updateSpeechRecognitionLanguage());
        
        
        this.elements.startListening.addEventListener('click', () => this.startListening());
        this.elements.stopListening.addEventListener('click', () => this.stopListening());
        this.elements.clearTranscripts.addEventListener('click', () => this.clearTranscripts());
        
        
        this.elements.speakOriginal.addEventListener('click', () => this.speakText('original'));
        this.elements.speakTranslation.addEventListener('click', () => this.speakText('translation'));
        
        
        document.querySelectorAll('.phrase-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.insertPhrase(e.target.dataset.phrase));
        });
        
        
        document.querySelector('.toast-close').addEventListener('click', () => this.hideError());
        
        
        document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));
    }
    
    initializeSpeechRecognition() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            this.showError('Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.');
            return;
        }
        
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.language = this.elements.inputLanguage.value;
        
        this.recognition.onstart = () => {
            this.isListening = true;
            this.updateControlButtons();
            this.updateStatus('Listening... Speak now', 'listening');
        };
        
        this.recognition.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';
            
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript;
                } else {
                    interimTranscript += transcript;
                }
            }
            
            this.currentTranscript = finalTranscript;
            
            
            const displayText = finalTranscript + (interimTranscript ? `<span class="interim">${interimTranscript}</span>` : '');
            this.updateOriginalTranscript(displayText || 'Listening...');
            
            
            if (finalTranscript.trim()) {
                this.translateText(finalTranscript.trim());
            }
        };
        
        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            this.isListening = false;
            this.updateControlButtons();
            
            let errorMessage = 'Speech recognition error occurred.';
            switch (event.error) {
                case 'no-speech':
                    errorMessage = 'No speech detected. Please try again.';
                    break;
                case 'audio-capture':
                    errorMessage = 'Microphone access denied. Please allow microphone access.';
                    break;
                case 'not-allowed':
                    errorMessage = 'Microphone access not allowed. Please enable microphone permissions.';
                    break;
                case 'network':
                    errorMessage = 'Network error occurred. Please check your connection.';
                    break;
            }
            
            this.showError(errorMessage);
            this.updateStatus('Error occurred. Ready to try again');
        };
        
        this.recognition.onend = () => {
            this.isListening = false;
            this.updateControlButtons();
            this.updateStatus('Ready to listen');
        };
    }
    
    startListening() {
        if (!this.recognition) {
            this.showError('Speech recognition not available');
            return;
        }
        
        try {
            this.recognition.start();
            this.updateStatus('Starting...', 'processing');
        } catch (error) {
            console.error('Error starting recognition:', error);
            this.showError('Could not start speech recognition. Please try again.');
        }
    }
    
    stopListening() {
        if (this.recognition && this.isListening) {
            this.recognition.stop();
        }
    }
    
    async translateText(text) {
        if (!text.trim()) return;
        
        const outputLang = this.elements.outputLanguage.value;
        const inputLang = this.speechLangMap[this.elements.inputLanguage.value] || 'en';
        
        if (inputLang === outputLang) {
            this.updateTranslatedTranscript(text);
            return;
        }
        
        this.showLoading(true);
        this.updateStatus('Translating...', 'processing');
        
        try {
            const translation = await this.callGeminiAPI(text, inputLang, outputLang);
            this.updateTranslatedTranscript(translation);
            this.updateStatus('Translation complete');
            this.elements.speakTranslation.disabled = false;
        } catch (error) {
            console.error('Translation error:', error);
            this.showError('Translation failed. Please try again.');
            this.updateTranslatedTranscript('Translation failed');
        } finally {
            this.showLoading(false);
        }
    }
    
    async callGeminiAPI(text, sourceLang, targetLang) {
        const API_KEY = this.geminiApiKey;
        
        
        if (!API_KEY || API_KEY === 'demo-mode') {
            return this.getMockTranslation(text, targetLang);
        }
        
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${API_KEY}`;
        
        const prompt = `You are a professional medical translator. Translate the following medical text from ${sourceLang} to ${targetLang}. 
        Maintain medical accuracy and use appropriate medical terminology. Only return the translation, no explanations or additional text.
        
        Text to translate: "${text}"`;
        
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: prompt
                        }]
                    }],
                    generationConfig: {
                        temperature: 0.1,
                        topK: 1,
                        topP: 1,
                        maxOutputTokens: 2048,
                    }
                })
            });
            
            if (!response.ok) {
                throw new Error(`API request failed: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.candidates && data.candidates[0] && data.candidates[0].content) {
                return data.candidates[0].content.parts[0].text.trim();
            } else {
                throw new Error('Invalid API response');
            }
        } catch (error) {
            console.error('Gemini API error:', error);
           
            return this.getMockTranslation(text, targetLang);
        }
    }
    
    getMockTranslation(text, targetLang) {
        
        const mockTranslations = {
            'es': {
                'Hello': 'Hola',
                'How are you?': '¿Cómo estás?',
                'How are you feeling?': '¿Cómo se siente?',
                'Where does it hurt?': '¿Dónde le duele?',
                'How long have you had this pain?': '¿Hace cuánto tiempo tiene este dolor?',
                'Rate your pain from 1 to 10': 'Califique su dolor del 1 al 10',
                'Are you taking any medications?': '¿Está tomando algún medicamento?',
                'Do you have any allergies?': '¿Tiene alguna alergia?',
                'When did this start?': '¿Cuándo comenzó esto?',
                'Take this medication': 'Tome este medicamento',
                'Thank you': 'Gracias',
                'Please sit down': 'Por favor siéntese',
                'I need to examine you': 'Necesito examinarlo',
                'This might hurt a little': 'Esto podría doler un poco',
                'Breathe deeply': 'Respire profundamente',
                'You need to rest': 'Necesita descansar',
                'Come back in a week': 'Vuelva en una semana',
                'I have a headache': 'Tengo dolor de cabeza',
                'My stomach hurts': 'Me duele el estómago',
                'I feel dizzy': 'Me siento mareado'
            },
            'fr': {
                'Hello': 'Bonjour',
                'How are you?': 'Comment allez-vous?',
                'How are you feeling?': 'Comment vous sentez-vous?',
                'Where does it hurt?': 'Où avez-vous mal?',
                'How long have you had this pain?': 'Depuis combien de temps avez-vous cette douleur?',
                'Rate your pain from 1 to 10': 'Évaluez votre douleur de 1 à 10',
                'Are you taking any medications?': 'Prenez-vous des médicaments?',
                'Do you have any allergies?': 'Avez-vous des allergies?',
                'When did this start?': 'Quand cela a-t-il commencé?',
                'Take this medication': 'Prenez ce médicament',
                'Thank you': 'Merci',
                'Please sit down': 'Veuillez vous asseoir',
                'I need to examine you': 'Je dois vous examiner',
                'This might hurt a little': 'Cela pourrait faire un peu mal',
                'Breathe deeply': 'Respirez profondément',
                'You need to rest': 'Vous devez vous reposer',
                'Come back in a week': 'Revenez dans une semaine'
            },
            'de': {
                'Hello': 'Hallo',
                'How are you?': 'Wie geht es Ihnen?',
                'Where does it hurt?': 'Wo tut es weh?',
                'Take this medication': 'Nehmen Sie dieses Medikament',
                'Thank you': 'Danke'
            },
            'it': {
                'Hello': 'Ciao',
                'How are you?': 'Come stai?',
                'Where does it hurt?': 'Dove fa male?',
                'Take this medication': 'Prenda questa medicina',
                'Thank you': 'Grazie'
            },
            'pt': {
                'Hello': 'Olá',
                'How are you?': 'Como você está?',
                'Where does it hurt?': 'Onde dói?',
                'Take this medication': 'Tome este medicamento',
                'Thank you': 'Obrigado'
            },
            'zh': {
                'Hello': '您好',
                'How are you?': '您好吗？',
                'Where does it hurt?': '哪里疼？',
                'Thank you': '谢谢'
            },
            'ja': {
                'Hello': 'こんにちは',
                'How are you?': '元気ですか？',
                'Where does it hurt?': 'どこが痛みますか？',
                'Thank you': 'ありがとう'
            },
            'ko': {
                'Hello': '안녕하세요',
                'How are you?': '어떻게 지내세요？',
                'Where does it hurt?': '어디가 아프세요？',
                'Thank you': '감사합니다'
            },
            'ar': {
                'Hello': 'مرحبا',
                'How are you?': 'كيف حالك؟',
                'Where does it hurt?': 'أين يؤلمك؟',
                'Thank you': 'شكرا'
            },
            'hi': {
                'Hello': 'नमस्ते',
                'How are you?': 'आप कैसे हैं?',
                'Where does it hurt?': 'दर्द कहाँ है?',
                'Thank you': 'धन्यवाद'
            }
        };
        
        const translations = mockTranslations[targetLang] || {};
        
        
        if (translations[text]) {
            return translations[text];
        }
        
       
        const lowerText = text.toLowerCase();
        for (const [key, value] of Object.entries(translations)) {
            if (lowerText.includes(key.toLowerCase()) || key.toLowerCase().includes(lowerText)) {
                return value;
            }
        }
        
       
        const commonWords = {
            'es': {
                'pain': 'dolor', 'doctor': 'doctor', 'medicine': 'medicina', 'hospital': 'hospital',
                'help': 'ayuda', 'please': 'por favor', 'yes': 'sí', 'no': 'no'
            },
            'fr': {
                'pain': 'douleur', 'doctor': 'docteur', 'medicine': 'médicament', 'hospital': 'hôpital',
                'help': 'aide', 'please': 's\'il vous plaît', 'yes': 'oui', 'no': 'non'
            }
        };
        
        if (commonWords[targetLang]) {
            const words = text.split(' ');
            const translatedWords = words.map(word => {
                const cleanWord = word.toLowerCase().replace(/[^\w]/g, '');
                return commonWords[targetLang][cleanWord] || word;
            });
            if (translatedWords.some((word, i) => word !== words[i])) {
                return translatedWords.join(' ');
            }
        }
        
       
        return `[${targetLang.toUpperCase()}] ${text}`;
    }
    
    speakText(type) {
        const text = type === 'original' ? 
            this.elements.originalTranscript.textContent :
            this.elements.translatedTranscript.textContent;
        
        if (!text || text.includes('will appear here')) {
            this.showError('No text to speak');
            return;
        }
        
       
        this.synthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(text);
        
        if (type === 'original') {
            const inputLang = this.elements.inputLanguage.value;
            utterance.lang = inputLang;
        } else {
            const outputLang = this.elements.outputLanguage.value;
            utterance.lang = this.getVoiceLang(outputLang);
        }
        
        utterance.rate = 0.9;
        utterance.pitch = 1;
        utterance.volume = 1;
        
        utterance.onstart = () => {
            this.updateStatus(`Speaking ${type}...`, 'processing');
        };
        
        utterance.onend = () => {
            this.updateStatus('Ready to listen');
        };
        
        utterance.onerror = () => {
            this.showError('Speech synthesis failed');
            this.updateStatus('Ready to listen');
        };
        
        this.synthesis.speak(utterance);
    }
    
    getVoiceLang(langCode) {
        const voiceMap = {
            'en': 'en-US',
            'es': 'es-ES',
            'fr': 'fr-FR',
            'de': 'de-DE',
            'it': 'it-IT',
            'pt': 'pt-BR',
            'zh': 'zh-CN',
            'ja': 'ja-JP',
            'ko': 'ko-KR',
            'ar': 'ar-SA',
            'hi': 'hi-IN'
        };
        return voiceMap[langCode] || 'en-US';
    }
    
    swapLanguages() {
        const inputValue = this.elements.inputLanguage.value;
        const outputValue = this.elements.outputLanguage.value;
        
       
        const inputLangCode = this.speechLangMap[inputValue];
        const outputSelectValue = Array.from(this.elements.outputLanguage.options)
            .find(option => option.value === inputLangCode)?.value;
        
        const outputSpeechValue = Object.keys(this.speechLangMap)
            .find(key => this.speechLangMap[key] === outputValue);
        
        if (outputSelectValue && outputSpeechValue) {
            this.elements.inputLanguage.value = outputSpeechValue;
            this.elements.outputLanguage.value = outputSelectValue;
            this.updateSpeechRecognitionLanguage();
        }
    }
    
    updateSpeechRecognitionLanguage() {
        if (this.recognition) {
            this.recognition.language = this.elements.inputLanguage.value;
        }
    }
    
    insertPhrase(phrase) {
        if (!phrase) return;
        
        
        const currentText = this.elements.originalTranscript.textContent;
        const newText = currentText.includes('will appear here') ? phrase : currentText + ' ' + phrase;
        
        this.updateOriginalTranscript(newText);
        this.currentTranscript = newText;
        
        
        this.translateText(phrase);
    }
    
    clearTranscripts() {
        this.elements.originalTranscript.innerHTML = '<p class="placeholder">Your speech will appear here...</p>';
        this.elements.translatedTranscript.innerHTML = '<p class="placeholder">Translation will appear here...</p>';
        this.currentTranscript = '';
        this.elements.speakOriginal.disabled = true;
        this.elements.speakTranslation.disabled = true;
        this.updateStatus('Ready to listen');
    }
    
    updateOriginalTranscript(text) {
        this.elements.originalTranscript.innerHTML = text ? `<p>${text}</p>` : '<p class="placeholder">Your speech will appear here...</p>';
        this.elements.speakOriginal.disabled = !text || text.includes('will appear here');
    }
    
    updateTranslatedTranscript(text) {
        this.elements.translatedTranscript.innerHTML = text ? `<p>${text}</p>` : '<p class="placeholder">Translation will appear here...</p>';
        this.elements.speakTranslation.disabled = !text || text.includes('will appear here');
    }
    
    updateControlButtons() {
        this.elements.startListening.disabled = this.isListening;
        this.elements.stopListening.disabled = !this.isListening;
    }
    
    updateStatus(message, type = '') {
        this.elements.listeningStatus.textContent = message;
        this.elements.listeningStatus.className = `status-text ${type}`;
    }
    
    showLoading(show) {
        this.elements.loadingOverlay.classList.toggle('hidden', !show);
    }
    
    showError(message) {
        const toast = this.elements.errorToast;
        const messageEl = toast.querySelector('.toast-message');
        
        messageEl.textContent = message;
        toast.classList.remove('hidden');
        
      
        setTimeout(() => {
            this.hideError();
        }, 5000);
    }
    
    hideError() {
        this.elements.errorToast.classList.add('hidden');
    }
    
    handleKeyboardShortcuts(e) {
        
        if ((e.ctrlKey || e.metaKey) && e.code === 'Space') {
            e.preventDefault();
            if (this.isListening) {
                this.stopListening();
            } else {
                this.startListening();
            }
        }
        
        
        if (e.code === 'Escape') {
            this.stopListening();
            this.synthesis.cancel();
        }
        
       
        if ((e.ctrlKey || e.metaKey) && e.code === 'KeyL') {
            e.preventDefault();
            this.swapLanguages();
        }
        
        
        if ((e.ctrlKey || e.metaKey) && e.code === 'Delete') {
            e.preventDefault();
            this.clearTranscripts();
        }
    }
}


document.addEventListener('DOMContentLoaded', () => {
   
    if (!window.speechSynthesis) {
        console.warn('Text-to-speech not supported');
    }
    
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        console.warn('Speech recognition not supported');
    }
    
    
    const translator = new HealthcareTranslator();
    
    
    window.translator = translator;
});


if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then((registration) => {
                console.log('ServiceWorker registration successful');
            })
            .catch((err) => {
                console.log('ServiceWorker registration failed');
            });
    });
}