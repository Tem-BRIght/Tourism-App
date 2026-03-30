import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonIcon,
  IonModal,
  IonList,
  IonItem,
  IonLabel,
  IonToggle,
  IonSelect,
  IonSelectOption,
  IonButtons,
  IonBackButton,
  IonToast,
  IonButton
} from '@ionic/react';
import {
  mic, micOff, send, settingsOutline, search,
  location, star, map, close, volumeHighOutline,
  pauseCircleOutline, playCircleOutline, chatbubblesOutline
} from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { fetchDestinations } from '../../services/destinationService';
import { Destination } from '../../types';
import './AIGuide.css';

// ─── Env / Config ─────────────────────────────────────────────────────────────

const GROQ_API_KEY      = import.meta.env.VITE_GROQ_API_KEY as string | undefined;
const GROQ_API_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL        = 'llama-3.3-70b-versatile';

// ─── Types ────────────────────────────────────────────────────────────────────

type PlaceCategory =
  | 'historical' | 'food' | 'park' | 'religious'
  | 'shopping' | 'entertainment' | 'museum' | 'church'
  | 'restaurant' | 'mall';

interface ChatMessage {
  text: string;
  sender: 'ai' | 'user';
  timestamp: Date;
  places?: PlaceSuggestion[];
}

interface PlaceSuggestion {
  id: string;
  title: string;
  image: string;
  rating: number;
  reviews: number;
  distance: string;
  address: string;
  type: string;
  category: PlaceCategory;
  tags: string[];
  lat: number | null;
  lng: number | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const WELCOME_MESSAGE = "Hello! I'm ALI, your Pasig City guide\nHow can i help you explore today?";

const SUGGESTED_QUESTIONS = [
  'What are the top 5 must-see places in Pasig?',
  'Recommend historical sites near me',
  'Where can I eat the best food in Pasig?',
  'Find family-friendly spots in Pasig',
  'What churches can I visit?',
  'Suggest parks for relaxation',
  'Where to go shopping?',
];

const PLACE_KEYWORDS = [
  'where', 'place', 'spot', 'location', 'go', 'visit', 'see',
  'recommend', 'suggest', 'find', 'looking for', 'show',
  'museum', 'park', 'church', 'restaurant', 'cafe', 'mall',
  'eat', 'food', 'shop', 'historical', 'heritage', 'tour',
];

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  historical: ['historical', 'history', 'heritage', 'museum', 'culture', 'old'],
  museum:     ['museum', 'exhibit', 'gallery', 'artifacts'],
  church:     ['church', 'cathedral', 'religious', 'spiritual', 'mass', 'prayer'],
  food:       ['food', 'restaurant', 'eat', 'cafe', 'dining', 'kainan', 'coffee', 'meal'],
  park:       ['park', 'nature', 'outdoor', 'garden', 'relax', 'picnic', 'walk'],
  shopping:   ['shop', 'mall', 'buy', 'shopping', 'store', 'market'],
  family:     ['family', 'kids', 'children', 'child-friendly'],
};

const FALLBACK_PROFILE_PIC = '/assets/images/Temporary.png';
const AI_AVATAR            = '/assets/images/AI/ALI 2.png';
const PLACEHOLDER_IMAGE    = '/assets/images/placeholder.jpg';

// ─── Geolocation helpers ───────────────────────────────────────────────────────

/** Haversine formula — returns distance in km between two lat/lng points */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R    = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

// ─── Language detection ────────────────────────────────────────────────────────

const TAGALOG_WORDS = new Set([
  'ang', 'ng', 'sa', 'ay', 'ito', 'ko', 'mo', 'siya', 'tayo', 'kayo', 'sila',
  'po', 'opo', 'oo', 'hindi', 'wala', 'meron', 'gusto', 'pumunta', 'kainan',
  'saan', 'paano', 'magkano', 'bakit', 'kailan', 'sino', 'anong', 'may',
  'nasa', 'dito', 'doon', 'roon', 'akin', 'iyo', 'kanya', 'atin', 'inyo', 'kanila',
  'naman', 'talaga', 'lang', 'pa', 'na', 'ba', 'kasi', 'din', 'rin', 'kung',
  'para', 'aking', 'iyong', 'kaniyang', 'aming', 'inyong', 'kanilang',
  'ikaw', 'ka', 'ako', 'kami', 'kita', 'niya', 'nila', 'natin',
  'yung', 'ung', 'mga', 'eto', 'ganito', 'ganyan', 'gano', 'parang',
  'medyo', 'sana', 'kaya', 'pala', 'yata', 'daw', 'raw', 'umalis', 'kumain',
  'uminom', 'matulog', 'maglakad', 'maglaro', 'magpahinga', 'maganda',
  'masarap', 'mura', 'mahal', 'mainit', 'malamig', 'maulan', 'maaraw',
  'diyan', 'kanan', 'kaliwa', 'deretso', 'liko', 'tabi',
  'gilid', 'loob', 'labas', 'itaas', 'ibaba', 'harap', 'likod',
]);

function detectLanguage(text: string): 'en' | 'tl' | 'mixed' {
  const words = text.toLowerCase().split(/\s+/);
  const tagalogCount = words.filter(w => TAGALOG_WORDS.has(w)).length;
  const ratio = tagalogCount / Math.max(words.length, 1);
  if (ratio > 0.25) return 'tl';
  if (ratio > 0.1)  return 'mixed';
  return 'en';
}

// ─── System prompts ────────────────────────────────────────────────────────────

const BASE_SYSTEM_PROMPT_EN =
  'You are ALI, a friendly and knowledgeable AI tourism guide for Pasig City, Philippines. ' +
  'You help tourists and locals discover the best places, food, culture, and activities in Pasig City. ' +
  'Keep responses concise (1-3 sentences), warm, and helpful. ' +
  'Always mention specific place names when relevant.';

const BASE_SYSTEM_PROMPT_TL =
  'Ikaw si ALI, isang magiliw at matalinong AI tour guide para sa Pasig City, Philippines. ' +
  'Tumutulong ka sa mga turista at lokal na alamin ang pinakamagagandang lugar, pagkain, kultura, at aktibidad sa Pasig. ' +
  'Panatilihing maikli ang sagot (1-3 pangungusap lang), mainit, at nakakatulong. ' +
  'Palaging banggitin ang mga partikular na pangalan ng lugar kung may kaugnayan. ' +
  'Magsalita ka sa natural na Taglish – parang kausap mo lang ang isang kaibigan. ' +
  'Huwag masyadong pormal; gumamit ng mga salitang ginagamit ng mga Pilipino sa pang-araw-araw na usapan.';

// ─── Message formatter ─────────────────────────────────────────────────────────

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*{1,2}[^*]+\*{1,2})/g);
  return parts.map((part, i) => {
    if (/^\*\*(.+)\*\*$/.test(part)) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (/^\*(.+)\*$/.test(part))     return <em key={i}>{part.slice(1, -1)}</em>;
    return part;
  });
}

function formatAIMessage(text: string): React.ReactNode {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];
  let listKey = 0;

  const flushList = () => {
    if (listItems.length === 0) return;
    elements.push(
      <ul key={`list-${listKey++}`} className="ai-msg-list">
        {listItems.map((item, i) => <li key={i}>{renderInline(item)}</li>)}
      </ul>
    );
    listItems = [];
  };

  lines.forEach((line, idx) => {
    const t = line.trim();
    if (/^[-*•]\s+/.test(t) || /^\d+\.\s+/.test(t)) {
      listItems.push(t.replace(/^[-*•]\s+/, '').replace(/^\d+\.\s+/, ''));
      return;
    }
    flushList();
    if (!t) return;
    if (/^[A-Z].{0,48}:$/.test(t)) {
      elements.push(<p key={idx} className="ai-msg-heading">{t}</p>);
      return;
    }
    elements.push(<p key={idx} className="ai-msg-para">{renderInline(t)}</p>);
  });
  flushList();
  return <>{elements}</>;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Strip markdown so TTS reads clean text */
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/^[-*•]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .trim();
}

// ─── Component ────────────────────────────────────────────────────────────────

const AIGuide: React.FC = () => {
  const history = useHistory();
  const { user } = useAuth();

  // ── State ──────────────────────────────────────────────────────────────────

  const [messages, setMessages] = useState<ChatMessage[]>([
    { text: WELCOME_MESSAGE, sender: 'ai', timestamp: new Date() },
  ]);
  const [input, setInput]               = useState('');
  const [isTyping, setIsTyping]         = useState(false);
  const [isListening, setIsListening]   = useState(false);
  const [isSpeaking, setIsSpeaking]     = useState(false);
  const [isPaused, setIsPaused]         = useState(false);
  const [isSearching, setIsSearching]   = useState(false);
  const [isThinking, setIsThinking]     = useState(false);
  const [voiceSpeed, setVoiceSpeed]     = useState(1.0);
  const [showSettings, setShowSettings] = useState(false);
  const [isMuted, setIsMuted]           = useState(false);
  const [voiceGender, setVoiceGender]   = useState<'any' | 'female' | 'male'>('female');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showErrorToast, setShowErrorToast] = useState(false);
  const [showVoiceIndicator, setShowVoiceIndicator] = useState(false);
  const [speakingMessageId, setSpeakingMessageId]   = useState<number | null>(null);
  const [pausedMessageId, setPausedMessageId]       = useState<number | null>(null);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());

  // Destinations
  const [places, setPlaces]             = useState<PlaceSuggestion[]>([]);
  const [placesLoading, setPlacesLoading] = useState(true);
  const [placesError, setPlacesError]   = useState<string | null>(null);

  // User geolocation
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  // ── Refs ───────────────────────────────────────────────────────────────────

  const recognitionRef  = useRef<any>(null);
  const speechSynthRef  = useRef<SpeechSynthesisUtterance | null>(null);
  const messagesEndRef  = useRef<HTMLDivElement>(null);
  const inputRef        = useRef<HTMLInputElement>(null);
  const mountedRef      = useRef(true);
  const isSendingRef    = useRef(false);

  // Stable refs for values used inside callbacks/effects
  const isMutedRef      = useRef(isMuted);
  const voiceSpeedRef   = useRef(voiceSpeed);
  const voiceGenderRef  = useRef(voiceGender);
  const messagesRef     = useRef(messages);

  useEffect(() => { isMutedRef.current    = isMuted;    }, [isMuted]);
  useEffect(() => { voiceSpeedRef.current  = voiceSpeed;  }, [voiceSpeed]);
  useEffect(() => { voiceGenderRef.current = voiceGender; }, [voiceGender]);
  useEffect(() => { messagesRef.current    = messages;    }, [messages]);

  // ── Load voices once ───────────────────────────────────────────────────────

  useEffect(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
    }
  }, []);

  // ── Request user location once ────────────────────────────────────────────

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      pos => {
        if (!mountedRef.current) return;
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      err => console.warn('Geolocation unavailable:', err.message),
      { enableHighAccuracy: true, timeout: 10_000 }
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch destinations ─────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setPlacesLoading(true);
        const data: Destination[] = await fetchDestinations();
        if (cancelled) return;

        const mapped: PlaceSuggestion[] = data.map(dest => {
          const lat = dest.location?.lat ?? null;
          const lng = dest.location?.lng ?? null;
          const distanceKm =
            userLocation && lat !== null && lng !== null
              ? haversineKm(userLocation.lat, userLocation.lng, lat, lng)
              : null;

          return {
            id:       dest.id,
            title:    dest.name || dest.title || 'Unknown Place',
            image:    dest.imageUrl || dest.image || PLACEHOLDER_IMAGE,
            rating:   dest.rating   ?? 0,
            reviews:  dest.reviews  ?? 0,
            distance: distanceKm !== null ? formatDistance(distanceKm) : (dest.distance ?? ''),
            address:  dest.address  || '',
            type:     dest.category || 'attraction',
            category: (dest.category as PlaceCategory) || 'historical',
            tags:     [],
            lat,
            lng,
          };
        });

        setPlaces(mapped);
        setPlacesError(null);
      } catch (err) {
        if (!cancelled) {
          console.error('Error loading destinations:', err);
          setPlacesError('Failed to load places.');
        }
      } finally {
        if (!cancelled) setPlacesLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  // ── Recompute distances when location arrives after places load ───────────

  useEffect(() => {
    if (!userLocation || places.length === 0) return;
    setPlaces(prev =>
      prev.map(p => {
        if (p.lat === null || p.lng === null) return p;
        const km = haversineKm(userLocation.lat, userLocation.lng, p.lat, p.lng);
        return { ...p, distance: formatDistance(km) };
      })
    );
  }, [userLocation]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Cleanup on unmount ─────────────────────────────────────────────────────

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopSpeaking();
      recognitionRef.current?.stop();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-scroll ────────────────────────────────────────────────────────────

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping, isThinking, isSearching]);

  // ── Profile pic ────────────────────────────────────────────────────────────

  const userProfilePic = localStorage.getItem('profilePic') || FALLBACK_PROFILE_PIC;

  const handleImageError = useCallback((placeId: string) => {
    setImageErrors(prev => new Set(prev).add(placeId));
  }, []);

  // ── Speech synthesis ───────────────────────────────────────────────────────

  const stopSpeaking = useCallback(() => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setIsPaused(false);
    setSpeakingMessageId(null);
    setPausedMessageId(null);
  }, []);

  const pickVoice = useCallback((): SpeechSynthesisVoice | undefined => {
    const voices = window.speechSynthesis.getVoices();
    const gender = voiceGenderRef.current;
    let voice: SpeechSynthesisVoice | undefined;

    if (gender === 'female') {
      voice = voices.find(v => /female|zira|susan|karen|hazel|samantha|victoria/i.test(v.name));
    } else if (gender === 'male') {
      voice = voices.find(v => /male|david|mark|paul|alex|james|robert/i.test(v.name));
    } else {
      voice = voices.find(v => v.lang.startsWith('en') && v.default);
    }

    return voice ?? voices.find(v => v.lang.startsWith('en'));
  }, []);

  const speakMessage = useCallback((rawText: string, messageIndex: number) => {
    if (isMutedRef.current || !window.speechSynthesis) return;

    window.speechSynthesis.cancel();

    try {
      const text = stripMarkdown(rawText);
      const utterance = new SpeechSynthesisUtterance(text);
      const voice = pickVoice();
      if (voice) utterance.voice = voice;

      utterance.rate   = voiceSpeedRef.current;
      utterance.pitch  = 1.0;
      utterance.volume = 1.0;

      utterance.onstart  = () => { if (!mountedRef.current) return; setIsSpeaking(true);  setIsPaused(false); setSpeakingMessageId(messageIndex); setPausedMessageId(null); };
      utterance.onend    = () => { if (!mountedRef.current) return; setIsSpeaking(false); setIsPaused(false); setSpeakingMessageId(null);         setPausedMessageId(null); };
      utterance.onerror  = () => { if (!mountedRef.current) return; setIsSpeaking(false); setIsPaused(false); setSpeakingMessageId(null);         setPausedMessageId(null); };
      utterance.onpause  = () => { if (!mountedRef.current) return; setIsSpeaking(false); setIsPaused(true); };
      utterance.onresume = () => { if (!mountedRef.current) return; setIsSpeaking(true);  setIsPaused(false); };

      speechSynthRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.error('TTS error:', err);
      setIsSpeaking(false);
      setIsPaused(false);
      setSpeakingMessageId(null);
      setPausedMessageId(null);
    }
  }, [pickVoice]);

  const togglePlayPause = useCallback((messageIndex: number, messageText?: string) => {
    if (!window.speechSynthesis) return;

    const isThisMessage = speakingMessageId === messageIndex || pausedMessageId === messageIndex;

    if (isThisMessage) {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
        setIsSpeaking(true);
        setIsPaused(false);
        setSpeakingMessageId(messageIndex);
        setPausedMessageId(null);
      } else if (window.speechSynthesis.speaking) {
        window.speechSynthesis.pause();
        setIsSpeaking(false);
        setIsPaused(true);
        setSpeakingMessageId(null);
        setPausedMessageId(messageIndex);
      }
    } else if (messageText) {
      stopSpeaking();
      speakMessage(messageText, messageIndex);
    }
  }, [speakingMessageId, pausedMessageId, stopSpeaking, speakMessage]);

  // ── Speech recognition setup ───────────────────────────────────────────────

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) return;

    const rec = new SpeechRecognition();
    rec.continuous     = false;
    rec.interimResults = true;
    rec.lang           = 'fil-PH';

    rec.onresult = (event: any) => {
      if (!mountedRef.current) return;
      const last       = event.results[event.results.length - 1];
      const transcript = last[0].transcript;
      setInput(transcript);

      if (last.isFinal) {
        // Use ref to avoid stale closure — sendMessageRef always points to the
        // latest sendMessageImpl even though this handler was set up once.
        sendMessageRef.current(transcript);
        setIsListening(false);
        setShowVoiceIndicator(false);
      }
    };

    rec.onstart = () => {
      if (!mountedRef.current) return;
      setShowVoiceIndicator(true);
      setIsListening(true);
    };

    rec.onerror = (event: any) => {
      if (!mountedRef.current) return;
      const msgs: Record<string, string> = {
        'not-allowed': 'Microphone access denied. Please allow access.',
        'no-speech':   'No speech detected. Try again.',
      };
      showError(msgs[event.error] ?? 'Voice input error. Please try again.');
      setIsListening(false);
      setShowVoiceIndicator(false);
    };

    rec.onend = () => {
      if (!mountedRef.current) return;
      // onend fires after onresult(isFinal), so always clean up here safely
      setIsListening(false);
      setShowVoiceIndicator(false);
    };

    recognitionRef.current = rec;
  // sendMessage is defined below; use ref pattern to avoid stale closure
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Error helper ───────────────────────────────────────────────────────────

  const showError = (msg: string) => {
    setErrorMessage(msg);
    setShowErrorToast(true);
  };

  // ── Place suggestion logic ─────────────────────────────────────────────────

  const shouldShowPlaceSuggestions = useCallback((query: string): boolean => {
    const q = query.toLowerCase();
    return PLACE_KEYWORDS.some(kw => q.includes(kw));
  }, []);

  const getRelevantPlaces = useCallback((userQuery: string, maxPlaces = 5): PlaceSuggestion[] => {
    if (!shouldShowPlaceSuggestions(userQuery) || places.length === 0) return [];

    const q = userQuery.toLowerCase();

    // Helper: sort by real distance when location is available, else by rating
    const sortByProximityOrRating = (arr: PlaceSuggestion[]) => {
      if (userLocation) {
        return [...arr].sort((a, b) => {
          const distA = a.lat !== null && a.lng !== null
            ? haversineKm(userLocation.lat, userLocation.lng, a.lat, a.lng)
            : Infinity;
          const distB = b.lat !== null && b.lng !== null
            ? haversineKm(userLocation.lat, userLocation.lng, b.lat, b.lng)
            : Infinity;
          return distA - distB;
        });
      }
      return [...arr].sort((a, b) => b.rating - a.rating);
    };

    if (['top', 'best', 'must-see', 'famous', 'popular'].some(kw => q.includes(kw))) {
      return [...places].sort((a, b) => b.rating - a.rating).slice(0, maxPlaces);
    }

    if (['near', 'nearby', 'closest', 'nearest'].some(kw => q.includes(kw))) {
      return sortByProximityOrRating(places).slice(0, maxPlaces);
    }

    const matched = new Set<string>();
    for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      if (keywords.some(kw => q.includes(kw))) matched.add(cat);
    }

    if (matched.size > 0) {
      const seen    = new Set<string>();
      const results: PlaceSuggestion[] = [];
      for (const place of sortByProximityOrRating(places)) {
        if (!seen.has(place.id) && (matched.has(place.category) || place.tags.some(t => matched.has(t)))) {
          seen.add(place.id);
          results.push(place);
        }
      }
      if (results.length > 0) return results.slice(0, maxPlaces);
    }

    if (['recommend', 'suggest', 'where'].some(kw => q.includes(kw))) {
      return sortByProximityOrRating(places).slice(0, maxPlaces);
    }

    return [];
  }, [places, userLocation, shouldShowPlaceSuggestions]);

  // ── AI response ────────────────────────────────────────────────────────────

  const generateAIResponse = useCallback(async (
    userMessage: string,
    conversationHistory: ChatMessage[]
  ): Promise<{ text: string; places: PlaceSuggestion[] }> => {
    setIsSearching(true);
    setIsThinking(true);

    try {
      if (!GROQ_API_KEY) {
        return { text: 'API key not configured. Please set the VITE_GROQ_API_KEY environment variable.', places: [] };
      }

      await new Promise(res => setTimeout(res, 600));

      const relevantPlaces = getRelevantPlaces(userMessage, 5);

      let placeContext = '';
      if (relevantPlaces.length > 0) {
        placeContext =
          '\n\nHere are some places in Pasig that might match the user\'s interest:\n' +
          relevantPlaces.map(p => `- ${p.title}: ${p.type}, ${p.rating}⭐, ${p.distance} away. ${p.address}`).join('\n') +
          '\n\nWhen recommending places, refer to these specific locations.';
      }

      const lang         = detectLanguage(userMessage);
      const basePrompt   = (lang === 'tl' || lang === 'mixed') ? BASE_SYSTEM_PROMPT_TL : BASE_SYSTEM_PROMPT_EN;

      const locationContext = userLocation
        ? `\n\nThe user's current GPS coordinates are: ${userLocation.lat.toFixed(5)}, ${userLocation.lng.toFixed(5)}. ` +
          `Use the distances already listed with each place (they are calculated from the user's exact location) ` +
          `when mentioning how far away a place is. Always refer to real distances, never guess or fabricate them.`
        : '\n\nThe user\'s exact location is unknown; omit specific distance claims.';

      const systemPrompt = basePrompt + locationContext + placeContext;

      // Keep last 6 turns for context (trimmed to avoid token bloat)
      const historyMessages = conversationHistory.slice(-6).map(msg => ({
        role:    (msg.sender === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: msg.text,
      }));

      const response = await fetch(GROQ_API_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization:  `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model:       GROQ_MODEL,
          messages:    [{ role: 'system', content: systemPrompt }, ...historyMessages, { role: 'user', content: userMessage }],
          temperature: 0.7,
          max_tokens:  200,
          top_p:       0.9,
          stream:      false,
        }),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`GROQ API ${response.status}: ${body}`);
      }

      const data    = await response.json();
      const aiText: string | undefined = data.choices?.[0]?.message?.content;

      if (!aiText) return { text: 'I received an unexpected response. Please try again.', places: [] };

      return { text: aiText.trim(), places: relevantPlaces.slice(0, 3) };
    } catch (error: any) {
      console.error('Error generating AI response:', error);

      // Surface API errors helpfully
      if (error?.message?.includes('401')) {
        return { text: 'API key is invalid. Please check your configuration.', places: [] };
      }
      if (error?.message?.includes('429')) {
        return { text: 'Rate limit reached. Please wait a moment and try again.', places: [] };
      }
      return {
        text: "Hmm, I'm having trouble connecting right now. Please check your internet and try again.",
        places: [],
      };
    } finally {
      setIsSearching(false);
      setIsThinking(false);
    }
  }, [getRelevantPlaces, userLocation]);

  // ── Send message ───────────────────────────────────────────────────────────

  // Use a ref-wrapped version so the voice recognition onresult can call it without
  // capturing a stale closure (recognition is set up in a one-time effect).
  const sendMessageImpl = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isSendingRef.current) return;

    isSendingRef.current = true;
    stopSpeaking();
    setInput('');

    const userMessage: ChatMessage = { text: trimmed, sender: 'user', timestamp: new Date() };
    const updatedMessages = [...messagesRef.current, userMessage];
    setMessages(updatedMessages);
    setIsTyping(true);

    try {
      const { text: aiText, places: suggestedPlaces } =
        await generateAIResponse(trimmed, updatedMessages);

      if (!mountedRef.current) return;

      setMessages(prev => {
        const aiMessage: ChatMessage = {
          text:      aiText,
          sender:    'ai',
          timestamp: new Date(),
          places:    suggestedPlaces,
        };
        const updated = [...prev, aiMessage];

        if (!isMutedRef.current) {
          setTimeout(() => speakMessage(aiText, updated.length - 1), 0);
        }

        return updated;
      });
    } catch (err) {
      console.error('Send message error:', err);
      if (mountedRef.current) {
        showError('Something went wrong. Please try again.');
      }
    } finally {
      if (mountedRef.current) {
        setIsTyping(false);
        setIsSearching(false);
        setIsThinking(false);
      }
      isSendingRef.current = false;
    }
  }, [generateAIResponse, speakMessage, stopSpeaking]);

  const sendMessageRef = useRef(sendMessageImpl);
  useEffect(() => { sendMessageRef.current = sendMessageImpl; }, [sendMessageImpl]);

  // Stable wrapper for JSX onClick / recognition onresult
  const sendMessage = useCallback((text: string) => {
    sendMessageRef.current(text);
  }, []);

  // ── Voice input controls ───────────────────────────────────────────────────

  const toggleListening = useCallback(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      showError('Voice input is not supported in this browser. You can still type.');
      return;
    }

    if (!recognitionRef.current) {
      showError('Voice recognition is not ready. Please try again.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      setShowVoiceIndicator(false);
    } else {
      try {
        setInput('');
        // Abort any lingering session before starting fresh
        try { recognitionRef.current.abort(); } catch { /* ignore */ }
        recognitionRef.current.start();
      } catch (err: any) {
        // "already started" — just update UI to reflect running state
        if (err?.name === 'InvalidStateError') {
          setIsListening(true);
          setShowVoiceIndicator(true);
        } else {
          showError('Could not start voice recognition. Please try again.');
        }
      }
    }
  }, [isListening]);

  const stopVoiceInput = useCallback(() => {
    recognitionRef.current?.stop();
    setShowVoiceIndicator(false);
    setIsListening(false);
  }, []);

  // ── Navigation ─────────────────────────────────────────────────────────────

  const handlePlaceClick = useCallback((place: PlaceSuggestion) => {
    stopSpeaking();
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    history.push(`/destination/${place.id}`, place);
  }, [history, stopSpeaking]);

  // ── Message tap (play/pause) ───────────────────────────────────────────────

  const handleMessageClick = useCallback((msg: ChatMessage, index: number) => {
    if (msg.sender !== 'ai') return;
    togglePlayPause(index, msg.text);
  }, [togglePlayPause]);

  // ── Keyboard handler ───────────────────────────────────────────────────────

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }, [input, sendMessage]);

  // ── Derived state ──────────────────────────────────────────────────────────

  const isBusy    = isTyping || isThinking || isSearching;
  const canSend   = input.trim().length > 0 && !isBusy && !isListening;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <IonPage>
      {/* Header */}
      <IonHeader className="ai-header">
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/Home" />
          </IonButtons>
          <IonTitle>
            <div className="title">AI Pasig Guide</div>
            <div className="subtitle">Assistant for Pasig City</div>
          </IonTitle>
          <IonButtons slot="end">
            <IonButton fill="clear" onClick={() => setShowSettings(true)} aria-label="Open settings">
              <IonIcon icon={settingsOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      {/* Voice indicator overlay */}
      {showVoiceIndicator && (
        <div className="voice-indicator" role="status" aria-live="polite">
          <div className="voice-wave" aria-hidden="true">
            <span /><span /><span /><span /><span />
          </div>
          <span className="voice-text">Listening…</span>
          <button className="voice-stop-btn" onClick={stopVoiceInput} aria-label="Stop voice input">
            <IonIcon icon={close} />
          </button>
        </div>
      )}

      {/* Settings modal */}
      <IonModal isOpen={showSettings} onDidDismiss={() => setShowSettings(false)}>
        <IonHeader>
          <IonToolbar>
            <IonTitle>Settings</IonTitle>
            <IonButtons slot="end">
              <IonButton fill="clear" onClick={() => setShowSettings(false)}>Close</IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <IonList>
            <IonItem>
              <IonLabel>Mute Voice</IonLabel>
              <IonToggle
                checked={isMuted}
                onIonChange={e => {
                  setIsMuted(e.detail.checked);
                  if (e.detail.checked) stopSpeaking();
                }}
              />
            </IonItem>
            <IonItem>
              <IonLabel>Voice Gender</IonLabel>
              <IonSelect value={voiceGender} onIonChange={e => setVoiceGender(e.detail.value)}>
                <IonSelectOption value="any">Any</IonSelectOption>
                <IonSelectOption value="male">Male</IonSelectOption>
                <IonSelectOption value="female">Female</IonSelectOption>
              </IonSelect>
            </IonItem>
            <IonItem>
              <IonLabel>Voice Speed</IonLabel>
              <IonSelect value={voiceSpeed} onIonChange={e => setVoiceSpeed(parseFloat(e.detail.value))}>
                <IonSelectOption value={0.8}>Slow</IonSelectOption>
                <IonSelectOption value={1.0}>Normal</IonSelectOption>
                <IonSelectOption value={1.2}>Fast</IonSelectOption>
              </IonSelect>
            </IonItem>
          </IonList>
        </IonContent>
      </IonModal>

      {/* Main content */}
      <IonContent className="chat-content">
        <div className="chat-area">
          {messages.map((msg, i) => (
            <div key={i}>
              <div className={`message-container ${msg.sender}${i === 0 && msg.sender === 'ai' ? ' welcome' : ''}`}>
                {msg.sender === 'ai' && (
                  <img src={AI_AVATAR} alt="ALI, your AI guide" className="profile-img" />
                )}

                <div className="bubble-col">
                  {/* Speaking / paused pill */}
                  {msg.sender === 'ai' && (speakingMessageId === i || pausedMessageId === i) && (
                    <div className="speaking-indicator" aria-live="polite">
                      <IonIcon
                        icon={isPaused && pausedMessageId === i ? pauseCircleOutline : volumeHighOutline}
                      />
                      <span>{isPaused && pausedMessageId === i ? 'Paused' : 'Speaking'}</span>
                    </div>
                  )}

                  <div
                    className={`bubble ${msg.sender}${
                      (isSpeaking && speakingMessageId === i) || (isPaused && pausedMessageId === i)
                        ? ' speaking'
                        : ''
                    }`}
                    onClick={() => handleMessageClick(msg, i)}
                    role={msg.sender === 'ai' ? 'button' : undefined}
                    tabIndex={msg.sender === 'ai' ? 0 : undefined}
                    onKeyDown={e => msg.sender === 'ai' && e.key === 'Enter' && handleMessageClick(msg, i)}
                    aria-label={
                      msg.sender === 'ai'
                        ? `AI message. Tap to ${speakingMessageId === i ? 'pause' : 'play'}.`
                        : undefined
                    }
                  >
                    {msg.sender === 'ai' ? formatAIMessage(msg.text) : msg.text}

                    <time
                      className="message-timestamp"
                      dateTime={msg.timestamp.toISOString()}
                      aria-label={`Sent at ${msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                    >
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </time>
                  </div>
                </div>

                {msg.sender === 'user' && (
                  <img src={userProfilePic} alt="You" className="profile-img" />
                )}
              </div>

              {/* Place cards */}
              {msg.places && msg.places.length > 0 && (
                <div className="place-suggestion-container">
                  <div className="place-suggestion-header">
                    <IonIcon icon={map} aria-hidden="true" /> Recommended Places
                  </div>
                  {msg.places.map(place => (
                    <div
                      key={place.id}
                      className="place-card"
                      onClick={() => handlePlaceClick(place)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={e => e.key === 'Enter' && handlePlaceClick(place)}
                      aria-label={`View details for ${place.title}`}
                    >
                      <img
                        src={imageErrors.has(place.id) ? PLACEHOLDER_IMAGE : place.image}
                        alt={place.title}
                        className="place-card-image"
                        onError={() => handleImageError(place.id)}
                        loading="lazy"
                      />
                      <div className="place-card-info">
                        <h4>{place.title}</h4>
                        <p>
                          <IonIcon icon={location} aria-hidden="true" /> {place.address}
                        </p>
                        <div className="place-card-rating">
                          <IonIcon icon={star} aria-hidden="true" /> {place.rating}
                          <span>({place.reviews} reviews) · {place.distance}</span>
                        </div>
                        <span className="place-badge">{place.type}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* State indicators — only show one at a time (priority: searching > thinking > typing) */}
          {isSearching && (
            <div className="message-container ai" role="status" aria-live="polite">
              <img src={AI_AVATAR} alt="" className="profile-img" aria-hidden="true" />
              <div className="searching-state">
                <IonIcon icon={search} className="searching-pulse" aria-hidden="true" />
                <span>Searching for places…</span>
              </div>
            </div>
          )}

          {isThinking && !isSearching && (
            <div className="message-container ai" role="status" aria-live="polite">
              <img src={AI_AVATAR} alt="" className="profile-img" aria-hidden="true" />
              <div className="thinking-indicator">
                <div className="thinking-spinner" aria-hidden="true" />
                <span>Thinking…</span>
              </div>
            </div>
          )}

          {isTyping && !isThinking && !isSearching && (
            <div className="message-container ai" role="status" aria-live="polite">
              <img src={AI_AVATAR} alt="" className="profile-img" aria-hidden="true" />
              <div className="bubble ai typing" aria-label="ALI is typing">
                <div className="typing-dot" />
                <div className="typing-dot" />
                <div className="typing-dot" />
              </div>
            </div>
          )}

          {/* Suggested questions — only on fresh conversation */}
          {messages.length === 1 && !isBusy && (
            <div className="suggestions" role="complementary" aria-label="Suggested questions">
              <p className="suggest-title">
                <IonIcon icon={chatbubblesOutline} aria-hidden="true" /> Try asking…
              </p>
              {SUGGESTED_QUESTIONS.map((q, i) => (
                <button key={i} onClick={() => sendMessage(q)} disabled={isBusy}>
                  {q}
                </button>
              ))}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input bar */}
        <div className="input-area" role="search" aria-label="Chat input">
          <button
            className={`icon-btn${isListening ? ' listening' : ''}`}
            onClick={toggleListening}
            aria-label={isListening ? 'Stop listening' : 'Start voice input'}
            aria-pressed={isListening}
            disabled={isBusy && !isListening}
          >
            <IonIcon icon={isListening ? micOff : mic} />
          </button>

          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={isListening ? 'Listening…' : 'Ask about Pasig City…'}
            onKeyDown={handleKeyDown}
            disabled={isListening}
            aria-label="Message input"
            maxLength={500}
          />

          <button
            className="send-btn"
            onClick={() => sendMessage(input)}
            disabled={!canSend}
            aria-label="Send message"
          >
            <IonIcon icon={send} />
          </button>
        </div>

        <IonToast
          isOpen={showErrorToast}
          onDidDismiss={() => { setShowErrorToast(false); setErrorMessage(null); }}
          message={errorMessage ?? 'An error occurred'}
          duration={4000}
          color="danger"
          buttons={[{ text: 'Dismiss', role: 'cancel' }]}
        />
      </IonContent>
    </IonPage>
  );
};

export default AIGuide;