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
  RefreshCw
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
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
    </div>
  );
}
