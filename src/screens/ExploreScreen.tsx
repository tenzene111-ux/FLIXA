import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';
import { NAV_FOOTPRINT } from '../navigation/LiquidTabBar';
import { useAuth } from '../context/AuthContext';
import { useUserProfile } from '../hooks/useUserProfile';
import { logEvent } from '../services/analytics';
import { getPopularCreators, type PopularCreator } from '../services/explore';
import { getRecentPosts } from '../services/posts';
import { getActiveLiveStreams } from '../services/live';
import { followUser, subscribeToFollowState, unfollowUser } from '../services/follows';
import {
  subscribeToSearchHistory,
  recordSearchHistory,
  removeSearchHistoryItem,
  clearSearchHistory,
  type SearchHistoryItem,
} from '../services/searchHistory';
import {
  getAutocompleteSuggestions,
  getTrendingSearches,
  getTopHashtags,
  getRisingHashtags,
  getTopSounds,
  getRisingCreators,
  searchAll,
  BHUTAN_REGIONS,
  EXPLORE_CATEGORIES,
  type AutocompleteSuggestion,
  type TrendingSearchItem,
  type HashtagStat,
  type SoundStat,
  type SearchResults,
  type RisingCreator,
} from '../services/search';
import type { Post } from '../types/post';
import type { LiveStream } from '../types/liveStream';
import type { ExploreStackParamList } from '../navigation/ExploreStackNavigator';

const RESULT_TABS = ['Top', 'Videos', 'Creators', 'LIVE', 'Sounds', 'Hashtags'] as const;
type ResultTab = (typeof RESULT_TABS)[number];
type VideoSort = 'Relevant' | 'Latest' | 'Popular';

function formatCount(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

const SEARCH_LOG_DEBOUNCE_MS = 700;
const AUTOCOMPLETE_DEBOUNCE_MS = 250;

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<ExploreStackParamList>>();
  const { user } = useAuth();
  const inputRef = useRef<TextInput>(null);
  const searchLogTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autocompleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [queryText, setQueryText] = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const [submittedQuery, setSubmittedQuery] = useState<string | null>(null);
  const [results, setResults] = useState<SearchResults | null>(null);
  const [searching, setSearching] = useState(false);
  const [resultTab, setResultTab] = useState<ResultTab>('Top');
  const [videoSort, setVideoSort] = useState<VideoSort>('Relevant');

  const [autocomplete, setAutocomplete] = useState<AutocompleteSuggestion[]>([]);
  const [recentSearches, setRecentSearches] = useState<SearchHistoryItem[]>([]);
  const [trendingSearches, setTrendingSearches] = useState<TrendingSearchItem[]>([]);

  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [liveStreams, setLiveStreams] = useState<LiveStream[]>([]);
  const [popularVideos, setPopularVideos] = useState<Post[]>([]);
  const [popularCreators, setPopularCreators] = useState<PopularCreator[]>([]);
  const [risingCreators, setRisingCreators] = useState<RisingCreator[]>([]);
  const [topSounds, setTopSounds] = useState<SoundStat[]>([]);
  const [topHashtags, setTopHashtags] = useState<HashtagStat[]>([]);
  const [risingHashtags, setRisingHashtags] = useState<HashtagStat[]>([]);

  useEffect(() => {
    if (!user) return;
    return subscribeToSearchHistory(user.uid, setRecentSearches);
  }, [user]);

  useEffect(() => {
    getTrendingSearches(10).then(setTrendingSearches).catch(() => {});
  }, []);

  useEffect(() => {
    setDashboardLoading(true);
    Promise.all([
      getActiveLiveStreams(10),
      getRecentPosts(60),
      getPopularCreators(),
      getRisingCreators(10),
      getTopSounds(10),
      getTopHashtags(12),
      getRisingHashtags(8),
    ])
      .then(([live, recent, popular, rising, sounds, hashtags, risingTags]) => {
        setLiveStreams(live);
        setPopularVideos([...recent].sort((a, b) => b.likesCount + b.commentsCount * 2 - (a.likesCount + a.commentsCount * 2)).slice(0, 20));
        setPopularCreators(popular);
        setRisingCreators(rising);
        setTopSounds(sounds);
        setTopHashtags(hashtags);
        setRisingHashtags(risingTags);
      })
      .catch(() => {})
      .finally(() => setDashboardLoading(false));
  }, []);

  useEffect(() => {
    return () => {
      if (searchLogTimer.current) clearTimeout(searchLogTimer.current);
      if (autocompleteTimer.current) clearTimeout(autocompleteTimer.current);
    };
  }, []);

  const handleChangeText = (text: string) => {
    setQueryText(text);
    if (submittedQuery) setSubmittedQuery(null);

    if (autocompleteTimer.current) clearTimeout(autocompleteTimer.current);
    if (!text.trim()) {
      setAutocomplete([]);
      return;
    }
    autocompleteTimer.current = setTimeout(() => {
      getAutocompleteSuggestions(text).then(setAutocomplete).catch(() => {});
    }, AUTOCOMPLETE_DEBOUNCE_MS);
  };

  const runSearch = useCallback(
    async (rawQuery: string) => {
      const trimmed = rawQuery.trim();
      if (!trimmed) return;
      setQueryText(trimmed);
      setSubmittedQuery(trimmed);
      setResultTab('Top');
      setVideoSort('Relevant');
      setSearching(true);
      inputRef.current?.blur();

      if (user) {
        recordSearchHistory(user.uid, trimmed).catch(() => {});
        if (searchLogTimer.current) clearTimeout(searchLogTimer.current);
        searchLogTimer.current = setTimeout(() => logEvent('search', user.uid, { query: trimmed }), SEARCH_LOG_DEBOUNCE_MS);
      }

      try {
        const found = await searchAll(trimmed);
        setResults(found);
      } finally {
        setSearching(false);
      }
    },
    [user]
  );

  const goToUser = (uid: string) => navigation.navigate('UserProfile', { uid });
  const goToHashtag = (tag: string) => navigation.navigate('Hashtag', { tag });
  const goToSound = (musicTitle: string) => navigation.navigate('Sound', { musicTitle });
  const goToVideo = (postId: string) => navigation.navigate('SingleVideo', { postId });
  const goToLive = (streamId: string) =>
    (navigation as any).getParent()?.navigate('Home', {
      screen: 'LiveViewer',
      params: { streamId },
    });

  const clearSearch = () => {
    setQueryText('');
    setSubmittedQuery(null);
    setResults(null);
    setAutocomplete([]);
    inputRef.current?.blur();
  };

  const onVoiceSearch = () => {
    Alert.alert(
      'Voice search',
      "Voice search isn't wired up yet — it needs on-device speech recognition, which isn't part of this build."
    );
  };

  const showDashboard = !inputFocused && !submittedQuery;
  const showSuggestState = inputFocused && !submittedQuery && !queryText.trim();
  const showAutocomplete = inputFocused && !submittedQuery && !!queryText.trim();
  const showResults = !!submittedQuery;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        {showResults || inputFocused ? (
          <TouchableOpacity onPress={clearSearch} hitSlop={8} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
        ) : null}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={17} color={colors.textMuted} />
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            placeholder="Search FLIXA..."
            placeholderTextColor={colors.textDim}
            value={queryText}
            onChangeText={handleChangeText}
            onFocus={() => setInputFocused(true)}
            onSubmitEditing={() => runSearch(queryText)}
            returnKeyType="search"
            autoCapitalize="none"
          />
          {queryText.length > 0 ? (
            <TouchableOpacity onPress={() => handleChangeText('')} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={colors.textDim} />
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity onPress={onVoiceSearch} hitSlop={8}>
            <Ionicons name="mic-outline" size={18} color={colors.cyan} />
          </TouchableOpacity>
        </View>
      </View>

      {showResults ? (
        <SearchResultsView
          query={submittedQuery!}
          results={results}
          searching={searching}
          activeTab={resultTab}
          onChangeTab={setResultTab}
          videoSort={videoSort}
          onChangeVideoSort={setVideoSort}
          trendingSearches={trendingSearches}
          onPressWord={(w) => runSearch(w)}
          goToUser={goToUser}
          goToHashtag={goToHashtag}
          goToSound={goToSound}
          goToVideo={goToVideo}
          goToLive={goToLive}
        />
      ) : showAutocomplete ? (
        <AutocompleteView
          suggestions={autocomplete}
          onPressSuggestion={(s) => runSearch(s.label.replace(/^#/, ''))}
        />
      ) : showSuggestState ? (
        <RecentTrendingView
          recentSearches={recentSearches}
          trendingSearches={trendingSearches}
          onPressQuery={(q) => runSearch(q)}
          onRemoveRecent={(id) => user && removeSearchHistoryItem(user.uid, id)}
          onClearAll={() => user && clearSearchHistory(user.uid)}
        />
      ) : (
        <ExploreDashboard
          loading={dashboardLoading}
          liveStreams={liveStreams}
          popularVideos={popularVideos}
          popularCreators={popularCreators}
          risingCreators={risingCreators}
          topSounds={topSounds}
          topHashtags={topHashtags}
          risingHashtags={risingHashtags}
          trendingSearches={trendingSearches}
          onPressQuery={(q) => runSearch(q)}
          goToUser={goToUser}
          goToHashtag={goToHashtag}
          goToSound={goToSound}
          goToVideo={goToVideo}
          goToLive={goToLive}
        />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------
// Recent + Trending searches (shown when the search bar is focused with
// no text yet — spec §3/§4)
// ---------------------------------------------------------------------
function RecentTrendingView({
  recentSearches,
  trendingSearches,
  onPressQuery,
  onRemoveRecent,
  onClearAll,
}: {
  recentSearches: SearchHistoryItem[];
  trendingSearches: TrendingSearchItem[];
  onPressQuery: (q: string) => void;
  onRemoveRecent: (id: string) => void;
  onClearAll: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + NAV_FOOTPRINT + 24 }]}
      keyboardShouldPersistTaps="handled"
    >
      {recentSearches.length > 0 ? (
        <>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Recent Searches</Text>
            <TouchableOpacity onPress={onClearAll} hitSlop={6}>
              <Text style={styles.clearAllLabel}>Clear all</Text>
            </TouchableOpacity>
          </View>
          {recentSearches.map((item) => (
            <View key={item.id} style={styles.historyRow}>
              <TouchableOpacity style={styles.historyRowLeft} onPress={() => onPressQuery(item.query)}>
                <Ionicons name="time-outline" size={17} color={colors.textDim} />
                <Text style={styles.historyLabel}>{item.query}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => onRemoveRecent(item.id)} hitSlop={8}>
                <Ionicons name="close" size={16} color={colors.textDim} />
              </TouchableOpacity>
            </View>
          ))}
        </>
      ) : null}

      <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>🔥 Trending Searches</Text>
      {trendingSearches.length === 0 ? (
        <Text style={styles.emptyText}>Nothing trending yet</Text>
      ) : (
        trendingSearches.map((item, index) => (
          <TouchableOpacity key={item.query} style={styles.trendRow} onPress={() => onPressQuery(item.query)}>
            <Text style={styles.trendRank}>{index + 1}</Text>
            <Text style={styles.trendLabel}>{item.query}</Text>
            {item.growth > 0 ? <Text style={styles.trendGrowth}>🔥 Rising</Text> : null}
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
}

// ---------------------------------------------------------------------
// Autocomplete dropdown (spec §2)
// ---------------------------------------------------------------------
const KIND_ICON: Record<AutocompleteSuggestion['kind'], keyof typeof Ionicons.glyphMap> = {
  query: 'search',
  hashtag: 'pricetag-outline',
  sound: 'musical-notes-outline',
  creator: 'person-outline',
};

function AutocompleteView({
  suggestions,
  onPressSuggestion,
}: {
  suggestions: AutocompleteSuggestion[];
  onPressSuggestion: (s: AutocompleteSuggestion) => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + NAV_FOOTPRINT + 24 }]}
      keyboardShouldPersistTaps="handled"
    >
      {suggestions.length === 0 ? (
        <Text style={styles.emptyText}>Keep typing…</Text>
      ) : (
        suggestions.map((s) => (
          <TouchableOpacity key={s.id} style={styles.autocompleteRow} onPress={() => onPressSuggestion(s)}>
            <Ionicons name={KIND_ICON[s.kind]} size={17} color={colors.textMuted} />
            <Text style={styles.autocompleteLabel}>{s.label}</Text>
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
}

// ---------------------------------------------------------------------
// Explore dashboard (spec §5/§6)
// ---------------------------------------------------------------------
function ExploreDashboard(props: {
  loading: boolean;
  liveStreams: LiveStream[];
  popularVideos: Post[];
  popularCreators: PopularCreator[];
  risingCreators: RisingCreator[];
  topSounds: SoundStat[];
  topHashtags: HashtagStat[];
  risingHashtags: HashtagStat[];
  trendingSearches: TrendingSearchItem[];
  onPressQuery: (q: string) => void;
  goToUser: (uid: string) => void;
  goToHashtag: (tag: string) => void;
  goToSound: (musicTitle: string) => void;
  goToVideo: (postId: string) => void;
  goToLive: (streamId: string) => void;
}) {
  const {
    loading,
    liveStreams,
    popularVideos,
    popularCreators,
    risingCreators,
    topSounds,
    topHashtags,
    risingHashtags,
    trendingSearches,
    onPressQuery,
    goToUser,
    goToHashtag,
    goToSound,
    goToVideo,
    goToLive,
  } = props;
  const insets = useSafeAreaInsets();

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.dashboardContent, { paddingBottom: insets.bottom + NAV_FOOTPRINT + 24 }]}
      showsVerticalScrollIndicator={false}
    >
      {trendingSearches.length > 0 ? (
        <Section title="🔥 Trending Now">
          <View style={styles.chipWrap}>
            {trendingSearches.slice(0, 8).map((t) => (
              <Chip key={t.query} label={t.query} onPress={() => onPressQuery(t.query)} highlight={t.growth > 0} />
            ))}
          </View>
        </Section>
      ) : null}

      {liveStreams.length > 0 ? (
        <Section title="🔴 LIVE Now">
          <HorizontalList
            data={liveStreams}
            keyExtractor={(s) => s.id}
            renderItem={(s) => <LiveCard stream={s} onPress={() => goToLive(s.id)} />}
          />
        </Section>
      ) : null}

      <Section title="🎬 Popular Videos">
        <HorizontalList
          data={popularVideos}
          keyExtractor={(p) => p.id}
          renderItem={(p) => <VideoThumb post={p} onPress={() => goToVideo(p.id)} />}
        />
      </Section>

      <Section title="👥 Creators You May Like">
        <HorizontalList
          data={popularCreators}
          keyExtractor={(c) => c.uid}
          renderItem={(c) => <CreatorChip uid={c.uid} onPress={() => goToUser(c.uid)} />}
        />
      </Section>

      {risingCreators.length > 0 ? (
        <Section title="🚀 Rising Creators">
          <HorizontalList
            data={risingCreators}
            keyExtractor={(c) => c.uid}
            renderItem={(c) => <CreatorChip uid={c.uid} onPress={() => goToUser(c.uid)} badge="Rising" />}
          />
        </Section>
      ) : null}

      {topSounds.length > 0 ? (
        <Section title="🎵 Trending Sounds">
          <View style={styles.chipWrap}>
            {topSounds.map((s) => (
              <Chip
                key={s.musicTitle}
                label={s.musicTitle}
                sub={`${formatCount(s.count)} videos`}
                onPress={() => goToSound(s.musicTitle)}
                highlight={s.growth > 0}
              />
            ))}
          </View>
        </Section>
      ) : null}

      {topHashtags.length > 0 ? (
        <Section title="#️⃣ Trending Hashtags">
          <View style={styles.chipWrap}>
            {topHashtags.map((h) => (
              <Chip
                key={h.tag}
                label={`#${h.tag}`}
                sub={`${formatCount(h.count)} videos`}
                onPress={() => goToHashtag(h.tag)}
                highlight={h.growth > 0}
              />
            ))}
          </View>
        </Section>
      ) : null}

      <Section title="🇧🇹 Bhutan Explore">
        <View style={styles.chipWrap}>
          {BHUTAN_REGIONS.map((region) => (
            <Chip key={region} label={region} onPress={() => goToHashtag(region.toLowerCase().replace(/\s+/g, ''))} />
          ))}
        </View>
      </Section>

      {risingHashtags.length > 0 ? (
        <Section title="🆕 New & Rising">
          <View style={styles.chipWrap}>
            {risingHashtags.map((h) => (
              <Chip key={h.tag} label={`#${h.tag}`} onPress={() => goToHashtag(h.tag)} highlight />
            ))}
          </View>
        </Section>
      ) : null}

      <Section title="Browse Categories">
        <View style={styles.chipWrap}>
          {EXPLORE_CATEGORIES.map((c) => (
            <Chip key={c.label} label={c.label} onPress={() => goToHashtag(c.hashtags[0])} />
          ))}
        </View>
      </Section>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------
// Search results (spec §7-13, §24)
// ---------------------------------------------------------------------
function SearchResultsView(props: {
  query: string;
  results: SearchResults | null;
  searching: boolean;
  activeTab: ResultTab;
  onChangeTab: (t: ResultTab) => void;
  videoSort: VideoSort;
  onChangeVideoSort: (s: VideoSort) => void;
  trendingSearches: TrendingSearchItem[];
  onPressWord: (w: string) => void;
  goToUser: (uid: string) => void;
  goToHashtag: (tag: string) => void;
  goToSound: (musicTitle: string) => void;
  goToVideo: (postId: string) => void;
  goToLive: (streamId: string) => void;
}) {
  const { query, results, searching, activeTab, onChangeTab, videoSort, onChangeVideoSort, trendingSearches, onPressWord } = props;
  const { goToUser, goToHashtag, goToSound, goToVideo, goToLive } = props;
  const insets = useSafeAreaInsets();
  const navPad = { paddingBottom: insets.bottom + NAV_FOOTPRINT + 24 };

  if (searching || !results) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const isEmpty =
    results.videos.length === 0 &&
    results.creators.length === 0 &&
    results.live.length === 0 &&
    results.sounds.length === 0 &&
    results.hashtags.length === 0;

  if (isEmpty) {
    const relatedWords = Array.from(new Set(query.toLowerCase().split(/\s+/).filter((w) => w.length >= 3)));
    return (
      <ScrollView contentContainerStyle={[styles.listContent, navPad]}>
        <View style={styles.zeroState}>
          <Ionicons name="search-outline" size={40} color={colors.textDim} />
          <Text style={styles.zeroTitle}>We couldn't find that.</Text>
          <Text style={styles.zeroSubtitle}>Try a different search, or one of these:</Text>
        </View>
        {relatedWords.length > 1 ? (
          <>
            <Text style={styles.sectionTitle}>Related</Text>
            <View style={styles.chipWrap}>
              {relatedWords.map((w) => (
                <Chip key={w} label={w} onPress={() => onPressWord(w)} />
              ))}
            </View>
          </>
        ) : null}
        {trendingSearches.length > 0 ? (
          <>
            <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>🔥 Trending Searches</Text>
            <View style={styles.chipWrap}>
              {trendingSearches.slice(0, 8).map((t) => (
                <Chip key={t.query} label={t.query} onPress={() => onPressWord(t.query)} />
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>
    );
  }

  const sortedVideos = (() => {
    const copy = [...results.videos];
    if (videoSort === 'Latest') return copy.sort((a, b) => b.createdAt - a.createdAt);
    if (videoSort === 'Popular') return copy.sort((a, b) => b.likesCount - a.likesCount);
    return copy;
  })();

  return (
    <View style={{ flex: 1 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.resultTabRow} contentContainerStyle={styles.resultTabRowContent}>
        {RESULT_TABS.map((tab) => (
          <TouchableOpacity key={tab} style={[styles.resultTab, activeTab === tab && styles.resultTabActive]} onPress={() => onChangeTab(tab)}>
            <Text style={[styles.resultTabLabel, activeTab === tab && styles.resultTabLabelActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {activeTab === 'Top' ? (
        <ScrollView contentContainerStyle={[styles.listContent, navPad]}>
          {results.creators.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>Creators</Text>
              {results.creators.slice(0, 3).map((c) => (
                <CreatorRow key={c.uid} profile={c} onPress={() => goToUser(c.uid)} />
              ))}
            </>
          ) : null}
          {results.live.length > 0 ? (
            <>
              <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>LIVE</Text>
              <HorizontalList data={results.live.slice(0, 4)} keyExtractor={(s) => s.id} renderItem={(s) => <LiveCard stream={s} onPress={() => goToLive(s.id)} />} />
            </>
          ) : null}
          {results.hashtags.length > 0 ? (
            <>
              <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>Hashtags</Text>
              <View style={styles.chipWrap}>
                {results.hashtags.slice(0, 6).map((h) => (
                  <Chip key={h.tag} label={`#${h.tag}`} onPress={() => goToHashtag(h.tag)} />
                ))}
              </View>
            </>
          ) : null}
          {results.sounds.length > 0 ? (
            <>
              <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>Sounds</Text>
              <View style={styles.chipWrap}>
                {results.sounds.slice(0, 6).map((s) => (
                  <Chip key={s.musicTitle} label={s.musicTitle} onPress={() => goToSound(s.musicTitle)} />
                ))}
              </View>
            </>
          ) : null}
          {results.videos.length > 0 ? (
            <>
              <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>Videos</Text>
              <VideoGrid videos={sortedVideos} onPress={goToVideo} />
            </>
          ) : null}
        </ScrollView>
      ) : activeTab === 'Videos' ? (
        <ScrollView contentContainerStyle={[styles.listContent, navPad]}>
          <View style={styles.sortRow}>
            {(['Relevant', 'Latest', 'Popular'] as VideoSort[]).map((s) => (
              <TouchableOpacity key={s} style={[styles.sortChip, videoSort === s && styles.sortChipActive]} onPress={() => onChangeVideoSort(s)}>
                <Text style={[styles.sortChipLabel, videoSort === s && styles.sortChipLabelActive]}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {sortedVideos.length === 0 ? <Text style={styles.emptyText}>No videos found</Text> : <VideoGrid videos={sortedVideos} onPress={goToVideo} />}
        </ScrollView>
      ) : activeTab === 'Creators' ? (
        <ScrollView contentContainerStyle={[styles.listContent, navPad]}>
          {results.creators.length === 0 ? (
            <Text style={styles.emptyText}>No creators found</Text>
          ) : (
            results.creators.map((c) => <CreatorRow key={c.uid} profile={c} onPress={() => goToUser(c.uid)} />)
          )}
        </ScrollView>
      ) : activeTab === 'LIVE' ? (
        <ScrollView contentContainerStyle={[styles.listContent, navPad]}>
          {results.live.length === 0 ? (
            <Text style={styles.emptyText}>No LIVE streams found</Text>
          ) : (
            <View style={styles.liveGrid}>
              {results.live.map((s) => (
                <View key={s.id} style={styles.liveGridItem}>
                  <LiveCard stream={s} onPress={() => goToLive(s.id)} fullWidth />
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      ) : activeTab === 'Sounds' ? (
        <ScrollView contentContainerStyle={[styles.listContent, navPad]}>
          {results.sounds.length === 0 ? (
            <Text style={styles.emptyText}>No sounds found</Text>
          ) : (
            results.sounds.map((s) => (
              <TouchableOpacity key={s.musicTitle} style={styles.statRow} onPress={() => goToSound(s.musicTitle)}>
                <View style={styles.statIcon}>
                  <Ionicons name="musical-notes" size={16} color={colors.cyan} />
                </View>
                <View style={styles.statInfo}>
                  <Text style={styles.statName} numberOfLines={1}>
                    {s.musicTitle}
                  </Text>
                  <Text style={styles.statCount}>{formatCount(s.count)} videos {s.growth > 0 ? '· 🔥 Rising' : ''}</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={[styles.listContent, navPad]}>
          {results.hashtags.length === 0 ? (
            <Text style={styles.emptyText}>No hashtags found</Text>
          ) : (
            results.hashtags.map((h) => (
              <TouchableOpacity key={h.tag} style={styles.statRow} onPress={() => goToHashtag(h.tag)}>
                <View style={styles.statIcon}>
                  <Text style={styles.statIconLabel}>#</Text>
                </View>
                <View style={styles.statInfo}>
                  <Text style={styles.statName}>#{h.tag}</Text>
                  <Text style={styles.statCount}>{formatCount(h.count)} videos {h.growth > 0 ? '· 🔥 Rising' : ''}</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------
// Shared small pieces
// ---------------------------------------------------------------------
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function HorizontalList<T>({
  data,
  keyExtractor,
  renderItem,
}: {
  data: T[];
  keyExtractor: (item: T) => string;
  renderItem: (item: T) => React.ReactElement;
}) {
  return (
    <FlatList
      horizontal
      data={data}
      keyExtractor={keyExtractor}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.horizontalListContent}
      renderItem={({ item }) => renderItem(item)}
    />
  );
}

function Chip({ label, sub, onPress, highlight }: { label: string; sub?: string; onPress: () => void; highlight?: boolean }) {
  return (
    <TouchableOpacity style={[styles.chip, highlight && styles.chipHighlight]} onPress={onPress}>
      <Text style={[styles.chipLabel, highlight && styles.chipLabelHighlight]} numberOfLines={1}>
        {highlight ? '🔥 ' : ''}
        {label}
      </Text>
      {sub ? <Text style={styles.chipSub}>{sub}</Text> : null}
    </TouchableOpacity>
  );
}

function VideoThumb({ post, onPress }: { post: Post; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.videoThumb} onPress={onPress} activeOpacity={0.85}>
      <Image source={{ uri: post.thumbnailUrl }} style={StyleSheet.absoluteFill} />
      <View style={styles.videoThumbLikes}>
        <Ionicons name="heart" size={11} color={colors.text} />
        <Text style={styles.videoThumbLikesLabel}>{formatCount(post.likesCount)}</Text>
      </View>
    </TouchableOpacity>
  );
}

function VideoGrid({ videos, onPress }: { videos: Post[]; onPress: (id: string) => void }) {
  return (
    <View style={styles.videoGrid}>
      {videos.map((p) => (
        <TouchableOpacity key={p.id} style={styles.videoGridItem} onPress={() => onPress(p.id)} activeOpacity={0.85}>
          <Image source={{ uri: p.thumbnailUrl }} style={StyleSheet.absoluteFill} />
          <View style={styles.videoThumbLikes}>
            <Ionicons name="heart" size={11} color={colors.text} />
            <Text style={styles.videoThumbLikesLabel}>{formatCount(p.likesCount)}</Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function LiveCard({ stream, onPress, fullWidth }: { stream: LiveStream; onPress: () => void; fullWidth?: boolean }) {
  return (
    <TouchableOpacity style={[styles.liveCard, fullWidth && styles.liveCardFull]} onPress={onPress} activeOpacity={0.85}>
      {stream.coverUrl ? <Image source={{ uri: stream.coverUrl }} style={StyleSheet.absoluteFill} /> : null}
      <View style={styles.liveCardScrim} />
      <View style={styles.liveCardBadge}>
        <Text style={styles.liveCardBadgeLabel}>LIVE</Text>
      </View>
      {stream.viewerCount > 0 ? (
        <View style={styles.liveCardViewers}>
          <Ionicons name="eye" size={10} color={colors.text} />
          <Text style={styles.liveCardViewersLabel}>{formatCount(stream.viewerCount)}</Text>
        </View>
      ) : null}
      <Text style={styles.liveCardTitle} numberOfLines={2}>
        {stream.title}
      </Text>
      <Text style={styles.liveCardHost} numberOfLines={1}>
        @{stream.hostUsername}
      </Text>
    </TouchableOpacity>
  );
}

function CreatorChip({ uid, onPress, badge }: { uid: string; onPress: () => void; badge?: string }) {
  const profile = useUserProfile(uid);
  return (
    <TouchableOpacity style={styles.creatorChip} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.creatorChipAvatar}>
        {profile?.photoURL ? (
          <Image source={{ uri: profile.photoURL }} style={styles.creatorChipAvatarImage} />
        ) : (
          <Text style={styles.creatorChipInitial}>{(profile?.username ?? '?').charAt(0).toUpperCase()}</Text>
        )}
      </View>
      <Text style={styles.creatorChipName} numberOfLines={1}>
        @{profile?.username ?? '...'}
      </Text>
      {badge ? <Text style={styles.creatorChipBadge}>🚀 {badge}</Text> : null}
    </TouchableOpacity>
  );
}

function CreatorRow({ profile, onPress }: { profile: { uid: string; username: string; displayName: string; photoURL: string | null; followersCount: number }; onPress: () => void }) {
  const { user } = useAuth();
  const viewerProfile = useUserProfile(user?.uid);
  const [isFollowing, setIsFollowing] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    return subscribeToFollowState(user.uid, profile.uid, setIsFollowing);
  }, [user, profile.uid]);

  const handleToggleFollow = async () => {
    if (!user || !viewerProfile || busy || user.uid === profile.uid) return;
    setBusy(true);
    try {
      if (isFollowing) {
        await unfollowUser({ followerUid: user.uid, followingUid: profile.uid });
      } else {
        await followUser({ followerUid: user.uid, followerUsername: viewerProfile.username, followingUid: profile.uid });
        logEvent('follow', user.uid, { targetUid: profile.uid });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <TouchableOpacity style={styles.creatorRow} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.creatorRowAvatar}>
        {profile.photoURL ? (
          <Image source={{ uri: profile.photoURL }} style={styles.creatorChipAvatarImage} />
        ) : (
          <Text style={styles.creatorChipInitial}>{profile.username.charAt(0).toUpperCase()}</Text>
        )}
      </View>
      <View style={styles.creatorRowInfo}>
        <Text style={styles.creatorRowName}>{profile.displayName}</Text>
        <Text style={styles.creatorRowHandle}>
          @{profile.username} · {formatCount(profile.followersCount)} followers
        </Text>
      </View>
      {user && user.uid !== profile.uid ? (
        <TouchableOpacity
          style={[styles.followBtn, isFollowing && styles.followBtnActive]}
          onPress={handleToggleFollow}
          disabled={busy}
        >
          <Text style={[styles.followBtnLabel, isFollowing && styles.followBtnLabelActive]}>{isFollowing ? 'Following' : 'Follow'}</Text>
        </TouchableOpacity>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  backBtn: {
    padding: 2,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  dashboardContent: {
    paddingBottom: 40,
  },
  section: {
    marginTop: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
    marginLeft: 16,
  },
  sectionTitleSpaced: {
    marginTop: 22,
  },
  clearAllLabel: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 8,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  historyRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  historyLabel: {
    color: colors.text,
    fontSize: 14,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  trendRank: {
    color: colors.textDim,
    fontSize: 14,
    fontWeight: '700',
    width: 18,
  },
  trendLabel: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
  },
  trendGrowth: {
    color: colors.pink,
    fontSize: 11,
    fontWeight: '700',
  },
  autocompleteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  autocompleteLabel: {
    color: colors.text,
    fontSize: 14,
  },
  horizontalListContent: {
    paddingHorizontal: 16,
    gap: 10,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
  },
  chip: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 13,
    paddingVertical: 8,
    maxWidth: 200,
  },
  chipHighlight: {
    borderColor: colors.pink,
  },
  chipLabel: {
    color: colors.text,
    fontSize: 12.5,
    fontWeight: '600',
  },
  chipLabelHighlight: {
    color: colors.text,
  },
  chipSub: {
    color: colors.textDim,
    fontSize: 10.5,
    marginTop: 2,
  },
  videoThumb: {
    width: 110,
    height: 165,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'flex-end',
  },
  videoThumbLikes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    margin: 6,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  videoThumbLikesLabel: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '700',
  },
  videoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  videoGridItem: {
    width: '32%',
    aspectRatio: 0.66,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'flex-end',
  },
  liveCard: {
    width: 130,
    height: 175,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'flex-end',
    padding: 10,
  },
  liveCardFull: {
    width: '100%',
    height: 190,
  },
  liveCardScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(4,3,15,0.35)',
  },
  liveCardBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: colors.pink,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  liveCardBadgeLabel: {
    color: colors.text,
    fontSize: 9.5,
    fontWeight: '800',
  },
  liveCardViewers: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  liveCardViewersLabel: {
    color: colors.text,
    fontSize: 9.5,
    fontWeight: '700',
  },
  liveCardTitle: {
    color: colors.text,
    fontSize: 12.5,
    fontWeight: '700',
  },
  liveCardHost: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  liveGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  liveGridItem: {
    width: '48%',
  },
  creatorChip: {
    width: 90,
    alignItems: 'center',
  },
  creatorChipAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 6,
  },
  creatorChipAvatarImage: {
    width: '100%',
    height: '100%',
  },
  creatorChipInitial: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  creatorChipName: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  creatorChipBadge: {
    color: colors.cyan,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  creatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  creatorRowAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  creatorRowInfo: {
    flex: 1,
  },
  creatorRowName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  creatorRowHandle: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  followBtn: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  followBtnActive: {
    borderColor: colors.border,
  },
  followBtnLabel: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  followBtnLabelActive: {
    color: colors.textMuted,
  },
  resultTabRow: {
    flexGrow: 0,
    marginBottom: 8,
  },
  resultTabRowContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  resultTab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: colors.surfaceAlt,
  },
  resultTabActive: {
    backgroundColor: colors.primary,
  },
  resultTabLabel: {
    color: colors.textMuted,
    fontSize: 12.5,
    fontWeight: '600',
  },
  resultTabLabelActive: {
    color: colors.text,
  },
  sortRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  sortChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  sortChipActive: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.cyan,
  },
  sortChipLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  sortChipLabelActive: {
    color: colors.text,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statIconLabel: {
    color: colors.cyan,
    fontSize: 18,
    fontWeight: '700',
  },
  statInfo: {
    flex: 1,
  },
  statName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  statCount: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  zeroState: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 6,
  },
  zeroTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 6,
  },
  zeroSubtitle: {
    color: colors.textMuted,
    fontSize: 13,
  },
});
