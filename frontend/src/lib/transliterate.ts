/**
 * Utility to transliterate Indian patient names from English/Latin script
 * into Indic scripts (Hindi / Devanagari, Tamil, Telugu).
 */

const COMMON_NAMES: Record<string, { hi: string; ta: string; te: string }> = {
  hasan: { hi: 'हसन', ta: 'ஹசன்', te: 'హసన్' },
  hassan: { hi: 'हसन', ta: 'ஹசன்', te: 'హసన్' },
  mujtaba: { hi: 'मुजतबा', ta: 'முஜ்தபா', te: 'ముజ్తబా' },
  'hasan mujtaba': { hi: 'हसन मुजतबा', ta: 'ஹசன் முஜ்தபா', te: 'హసన్ ముజ్తబా' },
  ramesh: { hi: 'रमेश', ta: 'ரமேஷ்', te: 'రమేష్' },
  suresh: { hi: 'सुरेश', ta: 'சுரேஷ்', te: 'సురేష్' },
  mahesh: { hi: 'महेश', ta: 'மகேஷ்', te: 'మహేష్' },
  rajesh: { hi: 'राजेश', ta: 'ராஜேஷ்', te: 'రాజేష్' },
  amit: { hi: 'अमित', ta: 'அமித்', te: 'அమిత్' },
  rahul: { hi: 'राहुल', ta: 'ராகுல்', te: 'రాహుల్' },
  rohit: { hi: 'रोहित', ta: 'ரோஹித்', te: 'రోహిత్' },
  priya: { hi: 'प्रिया', ta: 'பிரியா', te: 'ప్రియా' },
  pooja: { hi: 'पूजा', ta: 'பூஜா', te: 'పూజ' },
  puja: { hi: 'पूजा', ta: 'பூஜா', te: 'పూజ' },
  anita: { hi: 'अनिता', ta: 'அனிதா', te: 'అనిత' },
  sunita: { hi: 'सुनीता', ta: 'சுனிதா', te: 'సునీత' },
  geeta: { hi: 'गीता', ta: 'கீதா', te: 'గీత' },
  sharma: { hi: 'शर्मा', ta: 'சர்மா', te: 'శర్మ' },
  patel: { hi: 'पटेल', ta: 'படேல்', te: 'పటేల్' },
  verma: { hi: 'वर्मा', ta: 'வர்மா', te: 'వర్మ' },
  singh: { hi: 'सिंह', ta: 'சிங்', te: 'సింగ్' },
  kumar: { hi: 'कुमार', ta: 'குமார்', te: 'కుమార్' },
  gupta: { hi: 'गुप्ता', ta: 'குப்தா', te: 'గుప్తా' },
  yadav: { hi: 'यादव', ta: 'யாதவ்', te: 'యాదవ్' },
  mishra: { hi: 'मिश्रा', ta: 'மிஸ்ரா', te: 'మిశ్రా' },
  ali: { hi: 'अली', ta: 'அலி', te: 'అలీ' },
  khan: { hi: 'खान', ta: 'கான்', te: 'ఖాన్' },
  ahmed: { hi: 'अहमद', ta: 'அகமது', te: 'అహ్మద్' },
  mohammed: { hi: 'मोहम्मद', ta: 'முகம்மது', te: 'మొహమ్మద్' },
  mohammad: { hi: 'मोहम्मद', ta: 'முகம்மது', te: 'మొహమ్మద్' },
  aarav: { hi: 'आरव', ta: 'ஆரவ்', te: 'ఆరవ్' },
  vihaan: { hi: 'विहान', ta: 'விஹான்', te: 'విహాన్' },
  ananya: { hi: 'अनन्या', ta: 'அனன்யா', te: 'అనన్య' },
  aditi: { hi: 'अदिति', ta: 'அதிதி', te: 'అదితి' }
}

const INITIAL_VOWELS: Record<string, string> = {
  aa: 'आ',
  a: 'अ',
  ee: 'ई',
  ii: 'ई',
  i: 'इ',
  oo: 'ऊ',
  uu: 'ऊ',
  u: 'उ',
  ai: 'ऐ',
  au: 'औ',
  e: 'ए',
  o: 'ओ'
}

const VOWEL_MATRAS: Record<string, string> = {
  aa: 'ा',
  a: '',
  ee: 'ी',
  ii: 'ी',
  i: 'ि',
  oo: 'ू',
  uu: 'ू',
  u: 'ु',
  ai: 'ै',
  au: 'ौ',
  e: 'े',
  o: 'ो'
}

const CONSONANTS: Record<string, string> = {
  chh: 'छ',
  kh: 'ख',
  gh: 'घ',
  ch: 'च',
  jh: 'झ',
  th: 'थ',
  dh: 'ध',
  bh: 'भ',
  sh: 'श',
  ph: 'फ',
  zh: 'ज़',
  k: 'क',
  g: 'ग',
  j: 'ज',
  t: 'त',
  d: 'द',
  n: 'न',
  p: 'प',
  f: 'फ',
  b: 'ब',
  m: 'म',
  y: 'य',
  r: 'र',
  l: 'ल',
  v: 'व',
  w: 'व',
  s: 'स',
  h: 'ह',
  z: 'ज़',
  q: 'क़'
}

const VOWEL_KEYS = ['aa', 'ee', 'ii', 'oo', 'uu', 'ai', 'au', 'a', 'i', 'u', 'e', 'o']
const CONS_KEYS = [
  'chh', 'kh', 'gh', 'ch', 'jh', 'th', 'dh', 'bh', 'sh', 'ph',
  'zh', 'k', 'g', 'j', 't', 'd', 'n', 'p', 'f', 'b', 'm', 'y',
  'r', 'l', 'v', 'w', 's', 'h', 'z', 'q'
]

function phoneticToDevanagari(word: string): string {
  const str = word.toLowerCase()
  let result = ''
  let i = 0

  while (i < str.length) {
    // Check initial vowel at start of word
    if (i === 0) {
      let matchedVowel: string | null = null
      for (const v of VOWEL_KEYS) {
        if (str.startsWith(v, i)) {
          matchedVowel = v
          break
        }
      }
      if (matchedVowel) {
        result += INITIAL_VOWELS[matchedVowel]
        i += matchedVowel.length
        continue
      }
    }

    // Check consonant match
    let matchedCons: string | null = null
    for (const c of CONS_KEYS) {
      if (str.startsWith(c, i)) {
        matchedCons = c
        break
      }
    }

    if (matchedCons) {
      result += CONSONANTS[matchedCons]
      i += matchedCons.length

      // Check following vowel
      let matchedVowel: string | null = null
      for (const v of VOWEL_KEYS) {
        if (str.startsWith(v, i)) {
          matchedVowel = v
          break
        }
      }

      if (matchedVowel) {
        if (matchedVowel === 'a') {
          // Trailing 'a' at the end of word (e.g., Sharma, Pooja, Anita)
          if (i + 1 >= str.length) {
            result += 'ा'
          }
        } else {
          result += VOWEL_MATRAS[matchedVowel] || ''
        }
        i += matchedVowel.length
      } else {
        // Consonant cluster / halant
        if (i < str.length && !str.startsWith(' ', i)) {
          result += '्'
        }
      }
    } else {
      // Direct character or vowel fallback
      if (INITIAL_VOWELS[str[i]]) {
        result += VOWEL_MATRAS[str[i]] || INITIAL_VOWELS[str[i]]
      } else {
        result += str[i]
      }
      i++
    }
  }

  return result
}

export function transliterateName(
  fullName: string,
  targetLang: 'en' | 'hi' | 'ta' | 'te' | string
): string {
  if (!fullName) return ''
  const trimmed = fullName.trim()

  // Return unchanged if target language is English
  if (targetLang === 'en') {
    return trimmed
  }

  // If already written in Indic script, don't transliterate
  if (/[\u0900-\u0D7F]/.test(trimmed)) {
    return trimmed
  }

  const lower = trimmed.toLowerCase()

  // Direct full-name match in dictionary
  if (COMMON_NAMES[lower] && (COMMON_NAMES[lower] as Record<string, string>)[targetLang]) {
    return (COMMON_NAMES[lower] as Record<string, string>)[targetLang]
  }

  // Token by token transliteration
  const words = trimmed.split(/\s+/)
  const translatedWords = words.map((w) => {
    const lw = w.toLowerCase()
    if (COMMON_NAMES[lw] && (COMMON_NAMES[lw] as Record<string, string>)[targetLang]) {
      return (COMMON_NAMES[lw] as Record<string, string>)[targetLang]
    }

    if (targetLang === 'hi') {
      return phoneticToDevanagari(w)
    }

    // Default fallback to original word for unsupported scripts
    return w
  })

  return translatedWords.join(' ')
}
