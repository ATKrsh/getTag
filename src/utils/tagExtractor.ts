// Ultra-High-Performance Video Filename Tokenizer & Keyword Extraction Engine
// Built for 10,000+ Massive File Batches with Zero-Lag Memory Architecture & 100% Case-Insensitivity

export interface ExtractedTag {
  word: string; // strictly lowercase word
  count: number;
  sources: string[]; // capped sample sources to prevent memory bloat
  firstSeenIndex: number;
}

export interface FileProcessResult {
  fileName: string;
  filePath: string;
  rawNameWithoutExt: string;
  extractedWords: string[];
  newUniqueWordsCount: number;
}

// Common HTML entities to strip
const HTML_ENTITY_REGEX = /&(?:amp|quot|apos|lt|gt|#39|#x27|#039|agrave|eacute|egrave|ouml|uuml|auml|ccedil|icirc|ocirc|ucirc|ntilde);?/gi;

// Bracketed tags, warez groups, site domain advertising
const BRACKET_WAREZ_REGEX = /\[(?:1080p|720p|480p|2160p|4k|uhd|fhd|hevc|x264|x265|h264|h265|yts(?:\.mx|\.lt)?|yify|rarbg|eztv|1337x|tgx|psa|torrenting|www\.[^\]]+|[^\]]*\.(?:com|org|net|me|to|io|in|tv|cc|xyz))\]/gi;
const DOMAIN_URL_REGEX = /\b(?:https?:\/\/\S+|www\.[a-z0-9.\-_]+\.[a-z]{2,}|[a-z0-9.\-_]+\.(?:com|org|net|me|io|co|in|tv|cc|xyz))\b/gi;

// Comprehensive Stop-Words & Filler List (100% Case-Insensitive)
export const STOP_WORDS = new Set([
  // Explicitly requested fillers:
  'in', 'as', 'on', 'the', 'for', 'this', 'that', 'to', 'they', 'them',
  // Common pronouns & possessives:
  'he', 'she', 'it', 'its', 'him', 'her', 'his', 'hers', 'you', 'your', 'yours',
  'we', 'us', 'our', 'ours', 'i', 'me', 'my', 'mine', 'their', 'theirs',
  'who', 'whom', 'whose', 'which', 'what', 'whatever', 'whoever',
  // Conjunctions & prepositions:
  'and', 'or', 'nor', 'but', 'if', 'then', 'else', 'so', 'yet',
  'of', 'off', 'at', 'by', 'from', 'with', 'without', 'within',
  'into', 'onto', 'upon', 'over', 'under', 'above', 'below', 'between',
  'through', 'during', 'before', 'after', 'about', 'against', 'among',
  'via', 'per', 'vs', 'versus', 'like', 'along', 'across', 'behind',
  // Auxiliaries & verbs:
  'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'having',
  'do', 'does', 'did', 'done', 'doing',
  'can', 'could', 'will', 'would', 'shall', 'should', 'may', 'might', 'must',
  // Quantifiers, adverbs & general fillers:
  'a', 'an', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other',
  'some', 'such', 'no', 'not', 'only', 'own', 'same', 'than', 'too', 'very',
  'just', 'now', 'there', 'here', 'where', 'when', 'why', 'how',
  'also', 'well', 'even', 'back', 'much', 'many', 'way', 'made', 'make',
  'part', 'see', 'get', 'got', 'let', 'lets', 'said', 'say', 'says',
  'tell', 'told', 'take', 'took', 'taken', 'put', 'give', 'given', 'gave',
  'know', 'knew', 'known', 'want', 'wants', 'wanted', 'need', 'needed',
  'use', 'used', 'using', 'find', 'found', 'look', 'looks', 'looked',
  'come', 'came', 'go', 'went', 'gone', 'good', 'new', 'first', 'last',
  // Release noise & codec tokens:
  '1080p', '720p', '480p', '2160p', '4k', 'uhd', 'fhd', 'hdrip', 'webrip', 'webdl', 'web-dl',
  'bluray', 'bdrip', 'brrip', 'remux', 'x264', 'x265', 'h264', 'h265', 'hevc', 'avc', 'av1', 'vp9',
  'aac', 'ac3', 'dts', 'atmos', 'mp3', 'mp4', 'mkv', 'avi', 'flv', 'sample', 'repack', 'proper',
  'unrated', 'extended', 'criterion', 'yify', 'yts', 'rarbg', 'eztv', '1337x', 'tgx',
  'sub', 'subs', 'multi', 'dual', 'ita', 'eng', 'ger', 'fra', 'spa', 'rus', 'jpn', 'kor',
  'chs', 'cht', 'rip', 'encode', 'pdf', 'doc', 'docx', 'file', 'video', 'audio', 'track', 'disc', 'cd',
  'episode', 'season', 'remastered', 'complete', 'version', 'volume', 'chapter', 'section'
]);

// Comprehensive Adult / Porn / NSFW Keyword Dictionary (100% Case-Insensitive)
export const NSFW_WORDS = new Set([
  'nsfw', 'porn', 'xxx', 'sex', 'hentai', 'erotic', 'adult', 'milf', 'anal', 'creampie',
  'blowjob', 'fetish', 'bdsm', 'lesbian', 'gay', 'cum', 'pussy', 'dick', 'cock', 'hardcore',
  'softcore', 'amateur', 'uncensored', 'jav', 'sensual', 'stripper', 'strip', 'masturbation',
  'masturbate', 'orgasm', 'slut', 'whore', 'tits', 'boobs', 'boob', 'lingerie', 'playboy',
  'penthouse', 'cam', 'camgirl', 'leaked', 'onlyfans', 'fap', 'escort', 'taboo', 'incest',
  'stepmom', 'stepsister', 'stepdaughter', 'stepbrother', 'stepsibling', 'babe', 'hot',
  'mature', 'threesome', 'orgy', 'gangbang', 'facial', 'squirt', 'swinger', 'voyeur',
  'peeping', 'shemale', 'trans', 'transgender', 'seduction', 'sexy', 'erotica', 'ecchi',
  'bitch', 'ass', 'butt', 'booty', 'clit', 'clitoris', 'vagina', 'penis', 'dildo', 'vibrator',
  'horny', 'lust', 'nude', 'naked', 'nudity', 'striptease', 'escorts', 'bondage', 'domination',
  'submissive', 'harem', 'doujin', 'doujinshi', 'bikini', 'swimsuit', 'cleavage', 'upskirt',
  'downblouse', 'nip', 'nipple', 'nipples', 'deepthroat', 'bukkake', 'swallow', 'gagging',
  'femdom', 'maledom', 'pegging', 'strap', 'strapon', 'cuckold', 'cuck', 'gloryhole',
  'masturbating', 'penetration', 'orgasms', 'topless', 'bottomless', 'intercourse', 'sperm',
  'ejaculation', 'fingering', 'handjob', 'footjob', 'titfuck', 'paizuri', 'analsex',
  'squirting', 'foursome', 'groupsex', 'creampies', 'blowjobs', 'cumshot', 'cumshots',
  'hardsex', 'roughsex', 'bdsmsex', 'sexparty', 'casting', 'castingcouch', 'bangbros',
  'brazzers', 'naughty', 'spanking', 'sensualmassage', 'eroticmassage', 'nudemodel', 'glamour'
]);

export function isNsfwWord(word: string): boolean {
  if (!word || typeof word !== 'string') return false;
  const lower = word.toLowerCase().trim();
  if (NSFW_WORDS.has(lower)) return true;
  for (const nsfw of NSFW_WORDS) {
    if (nsfw.length >= 4 && lower.includes(nsfw)) return true;
  }
  return false;
}

/**
 * Clean a single raw filename, split into lowercase words, filter fillers, and return deduplicated words.
 * Strictly Case-Insensitive.
 */
export function extractWordsFromFileName(filename: string): string[] {
  if (!filename || typeof filename !== 'string') return [];

  try {
    // 1. Remove file extension (e.g., .mp4, .mkv, .webm)
    let clean = filename.replace(/\.[a-zA-Z0-9]{1,8}$/, '');

    // 2. Remove HTML entities
    clean = clean.replace(HTML_ENTITY_REGEX, ' ');

    // 3. Remove bracketed release info & URLs
    clean = clean.replace(BRACKET_WAREZ_REGEX, ' ');
    clean = clean.replace(DOMAIN_URL_REGEX, ' ');

    // 4. Split camelCase words (e.g., "TheDarkKnight" -> "the dark knight")
    clean = clean.replace(/([a-z])([A-Z])/g, '$1 $2');
    clean = clean.replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');

    // 5. Replace separators (dots, underscores, hyphens, pluses, brackets, symbols) with spaces
    clean = clean.replace(/[^a-zA-Z0-9\s]/g, ' ');

    const rawTokens = clean.split(/\s+/);
    const fileWords: string[] = [];
    const fileSeen = new Set<string>();

    for (let i = 0; i < rawTokens.length; i++) {
      const token = rawTokens[i];
      if (!token || token.length < 2 || token.length > 40) continue;
      const lower = token.toLowerCase().trim();

      // Word must be at least 2 characters, strictly alphabetic (skip pure numbers), and not in STOP_WORDS
      if (/^[a-zA-Z]+$/.test(token) && !STOP_WORDS.has(lower)) {
        if (!fileSeen.has(lower)) {
          fileSeen.add(lower);
          fileWords.push(lower);
        }
      }
    }

    return fileWords;
  } catch (_) {
    return [];
  }
}

/**
 * Ultra-Efficient Accumulator designed for 10,000+ files with low memory footprint
 */
export class TagAccumulator {
  private tagMap = new Map<string, ExtractedTag>(); // key: lowercase word
  private insertionOrder: string[] = [];
  private totalFilesProcessedCount = 0;
  private processedFileNames = new Set<string>();

  constructor(initialTags?: ExtractedTag[], initialFileCount = 0) {
    this.totalFilesProcessedCount = initialFileCount;
    if (Array.isArray(initialTags)) {
      for (let i = 0; i < initialTags.length; i++) {
        const tag = initialTags[i];
        if (tag && typeof tag.word === 'string') {
          const key = tag.word.toLowerCase().trim();
          if (key && !this.tagMap.has(key)) {
            this.tagMap.set(key, {
              word: key,
              count: typeof tag.count === 'number' ? tag.count : 1,
              sources: Array.isArray(tag.sources) ? tag.sources.slice(0, 5) : [],
              firstSeenIndex: this.insertionOrder.length,
            });
            this.insertionOrder.push(key);
          }
        }
      }
    }
  }

  /**
   * Process a single video file in sub-millisecond time.
   */
  public processFile(fileName: string, filePath: string): FileProcessResult {
    const safeName = (fileName && typeof fileName === 'string') ? fileName : '';
    const safePath = (filePath && typeof filePath === 'string') ? filePath : '';
    
    if (safeName && !this.processedFileNames.has(safeName)) {
      this.processedFileNames.add(safeName);
      this.totalFilesProcessedCount += 1;
    }

    const extractedWords = extractWordsFromFileName(safeName);
    let newUniqueWordsCount = 0;

    for (let i = 0; i < extractedWords.length; i++) {
      const word = extractedWords[i];
      if (!word) continue;
      const key = word.toLowerCase();
      const existing = this.tagMap.get(key);

      if (existing) {
        existing.count += 1;
        if (safeName && existing.sources.length < 5 && !existing.sources.includes(safeName)) {
          existing.sources.push(safeName);
        }
      } else {
        newUniqueWordsCount += 1;
        const newTag: ExtractedTag = {
          word: key,
          count: 1,
          sources: safeName ? [safeName] : [],
          firstSeenIndex: this.insertionOrder.length,
        };
        this.tagMap.set(key, newTag);
        this.insertionOrder.push(key);
      }
    }

    return {
      fileName: safeName,
      filePath: safePath,
      rawNameWithoutExt: safeName.replace(/\.[a-zA-Z0-9]+$/, ''),
      extractedWords,
      newUniqueWordsCount,
    };
  }

  /**
   * Fast Ingestion from existing tags.txt content
   */
  public ingestFromTxt(txtContent: string): number {
    if (!txtContent || typeof txtContent !== 'string') return 0;
    const lines = txtContent.split(/[\r\n]+/).map(l => l.trim().toLowerCase()).filter(Boolean);
    let added = 0;
    for (const line of lines) {
      if (!this.tagMap.has(line) && !STOP_WORDS.has(line) && /^[a-z]+$/.test(line)) {
        this.tagMap.set(line, {
          word: line,
          count: 1,
          sources: [],
          firstSeenIndex: this.insertionOrder.length,
        });
        this.insertionOrder.push(line);
        added++;
      }
    }
    return added;
  }

  /**
   * Generate clean formatted TXT list (one word per line)
   */
  public toTxtString(sortBy: 'order' | 'alpha' | 'frequency' = 'order'): string {
    const all = this.getTags(sortBy);
    return all.map(t => t.word).join('\n');
  }

  /**
   * Get total unique files processed across sessions
   */
  public getProcessedFilesCount(): number {
    return Math.max(this.totalFilesProcessedCount, this.processedFileNames.size);
  }

  /**
   * Get all extracted tags with sorting options (strictly case-insensitive, optimized fast sort)
   */
  public getTags(sortBy: 'order' | 'alpha' | 'frequency' = 'order'): ExtractedTag[] {
    const all = Array.from(this.tagMap.values());

    if (sortBy === 'alpha') {
      return all.sort((a, b) => (a.word < b.word ? -1 : a.word > b.word ? 1 : 0));
    }
    if (sortBy === 'frequency') {
      return all.sort((a, b) => b.count - a.count || (a.word < b.word ? -1 : a.word > b.word ? 1 : 0));
    }
    // Default: insertion order
    return all.sort((a, b) => a.firstSeenIndex - b.firstSeenIndex);
  }

  /**
   * Get total unique words count
   */
  public getUniqueCount(): number {
    return this.tagMap.size;
  }

  /**
   * Get total word occurrences across all files
   */
  public getTotalOccurrences(): number {
    let total = 0;
    for (const tag of this.tagMap.values()) {
      total += tag.count;
    }
    return total;
  }

  /**
   * Remove a specific tag
   */
  public removeTag(word: string): boolean {
    const key = word.toLowerCase();
    const removed = this.tagMap.delete(key);
    if (removed) {
      this.insertionOrder = this.insertionOrder.filter(k => k !== key);
    }
    return removed;
  }

  /**
   * Clear all stored tags and files telemetry
   */
  public clear(): void {
    this.tagMap.clear();
    this.insertionOrder = [];
    this.processedFileNames.clear();
    this.totalFilesProcessedCount = 0;
  }
}
