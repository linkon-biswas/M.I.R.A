import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  ExternalLink, 
  BarChart3, 
  Heart, 
  MessageSquare, 
  Share2, 
  Bookmark, 
  MousePointer, 
  Eye, 
  Users, 
  TrendingUp,
  Image as ImageIcon,
  RefreshCw,
  Award,
  Info,
  Smile,
  Globe,
  Layers,
  Filter,
  CheckCircle2
} from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { apiService } from '../services/api';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import { formatDate } from '../utils/formatters';

export default function PostDetailsPage() {
  const { postId } = useParams();

  const [post, setPost] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const [comparisonMetric, setComparisonMetric] = useState('reach');
  const [showAllPlatforms, setShowAllPlatforms] = useState(true);
  const [activityFilter, setActivityFilter] = useState('all');

  const loadPostData = async (forceRefresh = false) => {
    if (forceRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const [postRes, analyticsRes, timelineRes] = await Promise.allSettled([
        apiService.getPostById(postId),
        apiService.getPostAnalytics(postId, forceRefresh),
        apiService.getPostTimeline(postId, forceRefresh),
      ]);

      if (postRes.status === 'fulfilled' && postRes.value?.post) {
        setPost(postRes.value.post);
      }

      if (analyticsRes.status === 'fulfilled' && analyticsRes.value) {
        setAnalytics(analyticsRes.value);
      }

      if (timelineRes.status === 'fulfilled' && timelineRes.value?.timeline) {
        setTimeline(timelineRes.value.timeline);
      }
    } catch (err) {
      setError('Failed to load post analytics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (postId) {
      loadPostData(false);
    }
  }, [postId]);

  if (loading) {
    return <LoadingSpinner text="Retrieving post identity mapping & analytics snapshot..." />;
  }

  if (!post && (!analytics || analytics.error || analytics.status === 404)) {
    return (
      <div className="space-y-6">
        <div>
          <Link
            to="/posts"
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Content Repository
          </Link>
        </div>
        <EmptyState
          title="Post Not Found"
          description={`No social post or analytics mapping found for ID: ${postId}`}
          actionButton={
            <Link
              to="/posts"
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition-all shadow-md"
            >
              Return to Posts
            </Link>
          }
        />
      </div>
    );
  }

  const metrics = analytics?.metrics || {
    impressions: 0,
    reach: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    saves: 0,
    clicks: 0,
    views: 0,
    engagementRate: 0,
  };

  const isNoData = analytics?.status === 'no_data_yet';

  return (
    <div className="space-y-6">
      {/* Back Button & Navigation */}
      <div>
        <Link
          to="/posts"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Content Repository
        </Link>
      </div>

      {/* Header Banner */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-slate-100 font-mono">
              {post?.internalPostId || postId}
            </h1>
            <StatusBadge status={post?.status || analytics?.status} />
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Created on {formatDate(post?.createdAt || analytics?.fetchedAt)}
          </p>
        </div>

        {/* Upstream Links & Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => loadPostData(true)}
            disabled={refreshing || loading}
            aria-label="Refresh Data"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors focus:ring-2 focus:ring-blue-400 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh Data'}
          </button>
          {post?.platforms?.[0]?.platformPostUrl && (
            <a
              href={post.platforms[0].platformPostUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 text-xs font-semibold border border-blue-500/20 transition-all"
            >
              Open Live Social Post <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>

      {/* Post Metadata Card */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Post Caption / Body</h3>
          <p className="text-sm text-slate-200 bg-slate-900/60 p-4 rounded-xl border border-slate-800 leading-relaxed">
            {post?.caption || '(No caption text provided for this post)'}
          </p>

          {/* Identity Mappings Display */}
          <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800">
              <span className="text-slate-400 block">Zernio Provider Post ID</span>
              <code className="text-blue-400 font-mono font-medium">{post?.providerPostId || 'Mapped in Database'}</code>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800">
              <span className="text-slate-400 block">Platform Post ID</span>
              <code className="text-emerald-400 font-mono font-medium">{post?.platforms?.[0]?.platformPostId || 'Resolved'}</code>
            </div>
          </div>
        </div>

        {/* Media Preview if URL exists */}
        {post?.imageUrl ? (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5 text-blue-400" /> Media Attachment
            </h3>
            <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-900">
              <img src={post.imageUrl} alt="Post Attachment" className="w-full h-48 object-cover" />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-6 rounded-xl bg-slate-900/40 border border-slate-800 text-center text-slate-500 text-xs">
            <ImageIcon className="w-8 h-8 mb-2 opacity-50" />
            <span>Text-only Social Post</span>
          </div>
        )}
      </div>

      {/* No Data Yet Banner */}
      {isNoData && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs space-y-1">
          <p className="font-semibold text-amber-200">Analytics Data Being Processed</p>
          <p className="text-amber-300/80">
            This post was published recently. Upstream metric snapshots are being aggregated by Zernio.
          </p>
        </div>
      )}

      {/* Key Analytics KPI Metrics Grid */}
      <div>
        <h2 className="text-base font-semibold text-slate-100 mb-4 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-blue-400" /> Performance Metrics
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard title="Impressions" value={metrics.impressions} icon={Eye} color="blue" />
          <StatCard title="Unique Reach" value={metrics.reach} icon={Users} color="purple" />
          <StatCard title="Likes" value={metrics.likes} icon={Heart} color="emerald" />
          <StatCard title="Engagement Rate" value={`${metrics.engagementRate}%`} icon={TrendingUp} color="amber" />
          <StatCard title="Comments" value={metrics.comments} icon={MessageSquare} color="indigo" />
          <StatCard title="Shares" value={metrics.shares} icon={Share2} color="blue" />
          <StatCard title="Saves" value={metrics.saves} icon={Bookmark} color="emerald" />
          <StatCard title="Link Clicks" value={metrics.clicks} icon={MousePointer} color="purple" />
        </div>
      </div>

      {/* Timeline Trend Graph */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800">
        <h3 className="text-base font-semibold text-slate-100 mb-4">Historical Engagement Timeline</h3>
        {timeline && timeline.length > 0 ? (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorImpressions" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '12px' }} />
                <Area type="monotone" dataKey="impressions" stroke="#3b82f6" strokeWidth={2} fill="url(#colorImpressions)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState
            title="No timeline series data available."
            description="Timeline points will appear as analytics snapshots are collected over time."
          />
        )}
      </div>

      {/* Feature 1: Cross-Platform Performance Comparison Dashboard & Graph */}
      {(() => {
        const ALL_CHANNELS = [
          { id: 'facebook', label: 'Facebook', color: '#1877F2', bg: 'bg-blue-600/10', border: 'border-blue-500/30', text: 'text-blue-400' },
          { id: 'instagram', label: 'Instagram', color: '#E4405F', bg: 'bg-pink-600/10', border: 'border-pink-500/30', text: 'text-pink-400' },
          { id: 'tiktok', label: 'TikTok', color: '#00F2FE', bg: 'bg-cyan-600/10', border: 'border-cyan-500/30', text: 'text-cyan-400' },
          { id: 'youtube', label: 'YouTube', color: '#FF0000', bg: 'bg-red-600/10', border: 'border-red-500/30', text: 'text-red-400' },
          { id: 'x', label: 'X (Twitter)', color: '#38bdf8', bg: 'bg-sky-600/10', border: 'border-sky-500/30', text: 'text-sky-400' },
          { id: 'linkedin', label: 'LinkedIn', color: '#0A66C2', bg: 'bg-indigo-600/10', border: 'border-indigo-500/30', text: 'text-indigo-400' },
        ];

        const platformComparisonData = ALL_CHANNELS.map((ch) => {
          const breakdown = analytics?.platformBreakdown?.find(
            (b) => b.platform.toLowerCase() === ch.id.toLowerCase()
          );
          const localPlatform = post?.platforms?.find(
            (p) => p.platform?.toLowerCase() === ch.id.toLowerCase()
          );
          const isTargeted = breakdown
            ? breakdown.status !== 'not_targeted'
            : Boolean(localPlatform);

          const plMetrics = breakdown?.metrics || (isTargeted ? metrics : {
            impressions: 0, reach: 0, likes: 0, comments: 0, shares: 0, saves: 0, clicks: 0, views: 0, engagementRate: 0,
          });

          return {
            id: ch.id,
            label: ch.label,
            color: ch.color,
            bg: ch.bg,
            border: ch.border,
            text: ch.text,
            status: isTargeted ? 'published' : 'not_targeted',
            platformPostId: breakdown?.platformPostId || localPlatform?.platformPostId,
            platformPostUrl: breakdown?.platformPostUrl || localPlatform?.platformPostUrl,
            reach: plMetrics.reach || 0,
            impressions: plMetrics.impressions || 0,
            likes: plMetrics.likes || 0,
            comments: plMetrics.comments || 0,
            shares: plMetrics.shares || 0,
            clicks: plMetrics.clicks || 0,
            engagementRate: plMetrics.engagementRate || 0,
          };
        });

        const displayedPlatforms = showAllPlatforms
          ? platformComparisonData
          : platformComparisonData.filter((p) => p.status === 'published');

        const publishedChannels = platformComparisonData.filter((p) => p.status === 'published');
        const topPerformer = publishedChannels.length > 0
          ? publishedChannels.reduce((max, cur) => cur[comparisonMetric] > max[comparisonMetric] ? cur : max, publishedChannels[0])
          : null;

        const metricTabs = [
          { id: 'reach', label: 'Reach' },
          { id: 'impressions', label: 'Impressions' },
          { id: 'likes', label: 'Likes' },
          { id: 'engagementRate', label: 'Engagement Rate (%)' },
          { id: 'comments', label: 'Comments' },
          { id: 'shares', label: 'Shares' },
          { id: 'clicks', label: 'Clicks' },
        ];

        return (
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-6">
            {/* Header + Badges + Toggle */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-blue-400" />
                  Cross-Platform Performance Comparison
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Side-by-side metric comparison across all major social media channels for this post
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Best Performing Platform Badge */}
                {topPerformer && topPerformer[comparisonMetric] > 0 && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-medium">
                    <Award className="w-3.5 h-3.5 text-amber-400" />
                    <span>Top Performer: <strong className="text-amber-200">{topPerformer.label}</strong> ({topPerformer[comparisonMetric]}{comparisonMetric === 'engagementRate' ? '%' : ''})</span>
                  </div>
                )}

                {/* Toggle All vs Targeted */}
                <button
                  type="button"
                  onClick={() => setShowAllPlatforms(!showAllPlatforms)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors"
                >
                  <Layers className="w-3.5 h-3.5 text-blue-400" />
                  {showAllPlatforms ? 'Showing All 6 Channels' : 'Targeted Channels Only'}
                </button>
              </div>
            </div>

            {/* Metric Selector Tabs */}
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
              <span className="text-xs font-medium text-slate-400 mr-1">Compare by:</span>
              {metricTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setComparisonMetric(tab.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    comparisonMetric === tab.id
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Recharts Bar Chart */}
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={displayedPlatforms} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                  <XAxis dataKey="label" stroke="#94a3b8" fontSize={12} />
                  <YAxis stroke="#94a3b8" fontSize={12} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '12px' }}
                    formatter={(val, name, item) => [
                      `${val}${comparisonMetric === 'engagementRate' ? '%' : ''} (${item.payload.status === 'published' ? 'Live' : 'Not Targeted'})`,
                      metricTabs.find((m) => m.id === comparisonMetric)?.label || comparisonMetric
                    ]}
                  />
                  <Bar dataKey={comparisonMetric} radius={[8, 8, 0, 0]}>
                    {displayedPlatforms.map((entry) => (
                      <Cell
                        key={`cell-${entry.id}`}
                        fill={entry.status === 'published' ? entry.color : '#475569'}
                        opacity={entry.status === 'published' ? 0.9 : 0.3}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Platform Comparison Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
              {displayedPlatforms.map((pl) => (
                <div
                  key={pl.id}
                  className={`p-4 rounded-xl border transition-all ${
                    pl.status === 'published'
                      ? 'bg-slate-900/60 border-slate-700/80 shadow-sm'
                      : 'bg-slate-900/20 border-slate-800/60 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: pl.color }} />
                      {pl.label}
                    </span>
                    <span
                      className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
                        pl.status === 'published'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {pl.status === 'published' ? 'Active Target' : 'Not Targeted'}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="p-2 rounded-lg bg-slate-800/40 border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">Reach</span>
                      <span className="font-semibold text-slate-200">{pl.reach}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-800/40 border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">Likes</span>
                      <span className="font-semibold text-emerald-400">{pl.likes}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-800/40 border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">Eng. Rate</span>
                      <span className="font-semibold text-amber-400">{pl.engagementRate}%</span>
                    </div>
                  </div>

                  {pl.platformPostUrl && (
                    <div className="mt-3 pt-2 border-t border-slate-800 flex justify-end">
                      <a
                        href={pl.platformPostUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        View Platform Post <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Feature 2: Reaction Breakdown & Engagement Activity Log */}
      {(() => {
        const reactions = [
          { key: 'like', emoji: '👍', label: 'Like', count: analytics?.reactionBreakdown?.like ?? metrics.likes },
          { key: 'love', emoji: '❤️', label: 'Love', count: analytics?.reactionBreakdown?.love ?? 0 },
          { key: 'haha', emoji: '😆', label: 'Haha', count: analytics?.reactionBreakdown?.haha ?? 0 },
          { key: 'wow', emoji: '😮', label: 'Wow', count: analytics?.reactionBreakdown?.wow ?? 0 },
          { key: 'sad', emoji: '😢', label: 'Sad', count: analytics?.reactionBreakdown?.sad ?? 0 },
          { key: 'angry', emoji: '😡', label: 'Angry', count: analytics?.reactionBreakdown?.angry ?? 0 },
        ];
        const totalReactions = reactions.reduce((sum, r) => sum + r.count, 0);

        const activities = analytics?.engagementActivity || [];
        const filteredActivities = activities.filter((item) => {
          if (activityFilter === 'reactions') return item.actionType !== 'comment';
          if (activityFilter === 'comments') return item.actionType === 'comment';
          return true;
        });

        return (
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-6">
            {/* Section Header */}
            <div>
              <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                <Heart className="w-4 h-4 text-rose-400" />
                Reactions & Audience Engagement Activity
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Audience reactions, interactions, and chronological activity feed for this post
              </p>
            </div>

            {/* Reaction Type Breakdown Pills */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-medium">Reaction Breakdown</span>
                <span>Total Reactions: <strong className="text-slate-200">{totalReactions}</strong></span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                {reactions.map((r) => (
                  <div
                    key={r.key}
                    className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between"
                  >
                    <span className="flex items-center gap-1.5 text-sm">
                      <span>{r.emoji}</span>
                      <span className="text-xs font-medium text-slate-300">{r.label}</span>
                    </span>
                    <span className="text-xs font-bold text-slate-100 font-mono">
                      {r.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Privacy Disclaimer Banner */}
            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs flex items-start gap-3">
              <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-blue-200">Meta Privacy Protection Notice: </span>
                <span className="text-blue-300/80">
                  Meta's Graph API aggregates interaction data to protect user privacy. Individual reactor names require additional Facebook Page permissions (Page Inbox or Comments API).
                </span>
              </div>
            </div>

            {/* Chronological Engagement Activity Log */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <Filter className="w-3.5 h-3.5 text-blue-400" />
                  Activity Stream ({filteredActivities.length})
                </h4>

                {/* Filter Tabs */}
                <div className="flex items-center gap-1.5">
                  {[
                    { id: 'all', label: `All (${activities.length})` },
                    { id: 'reactions', label: `Reactions (${activities.filter((a) => a.actionType !== 'comment').length})` },
                    { id: 'comments', label: `Comments (${activities.filter((a) => a.actionType === 'comment').length})` },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setActivityFilter(f.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                        activityFilter === f.id
                          ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30 font-semibold'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {filteredActivities.length > 0 ? (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {filteredActivities.map((act) => (
                    <div
                      key={act.id}
                      className="p-3 rounded-xl bg-slate-900/40 border border-slate-800 flex items-start justify-between gap-3 hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        {/* Avatar */}
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {act.actorName
                            .split(' ')
                            .map((n) => n[0])
                            .slice(0, 2)
                            .join('')
                            .toUpperCase()}
                        </div>

                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-semibold text-slate-200">
                              {act.actorName}
                            </span>
                            {act.isAggregatedPrivacyFallback && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                                Verified Audience
                              </span>
                            )}
                            <span className="text-[11px] font-semibold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                              {act.reactionLabel || act.actionType}
                            </span>
                          </div>

                          {act.commentText && (
                            <p className="text-xs text-slate-300 mt-1 italic bg-slate-950/40 p-2 rounded-lg border border-slate-800/80">
                              "{act.commentText}"
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          {act.platform}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {formatDate(act.timestamp)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 rounded-xl bg-slate-900/20 border border-slate-800 text-slate-500 text-xs">
                  No engagement activity items found for the selected filter.
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
